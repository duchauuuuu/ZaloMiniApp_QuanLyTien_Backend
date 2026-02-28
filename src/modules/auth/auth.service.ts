import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Verify access token với Zalo Graph API — chỉ lấy id để xác minh
  private async verifyZaloToken(accessToken: string): Promise<string> {
    const { data } = await axios.get<{ id: string }>(
      'https://graph.zalo.me/v2.0/me',
      {
        params: { access_token: accessToken, fields: 'id' },
        timeout: 5000,
      },
    );
    if (!data?.id) throw new Error('Token không hợp lệ');
    return data.id;
  }

  private generateJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  async zaloLogin(
    zaloIdFromClient: string,
    accessToken?: string,
    userInfoFromClient?: { id: string; name: string; avatar?: string },
  ) {
    let zaloId: string = zaloIdFromClient;
    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    const isProd = this.configService.get('NODE_ENV') === 'production';

    if (accessToken) {
      // Cố verify token với Zalo Graph API (tăng bảo mật)
      try {
        const verifiedId = await this.verifyZaloToken(accessToken);
        if (verifiedId !== zaloIdFromClient) {
          if (isProd) {
            throw new UnauthorizedException('zaloId không khớp với access token');
          }
        } else {
          zaloId = verifiedId;
        }
      } catch (error: unknown) {
        if (error instanceof UnauthorizedException) throw error;
        // Verify fail → dùng zaloId từ getUserID() (SDK chạy trong Zalo WebView)
        this.logger.warn('Verify Zalo token thất bại, dùng zaloId từ getUserID()');
      }
    }

    // 2. Lấy tên và avatar từ userInfo (đến từ getUserInfo SDK)
    if (userInfoFromClient) {
      displayName = userInfoFromClient.name;
      avatarUrl = userInfoFromClient.avatar;
    }

    // 3. Tạo hoặc cập nhật user trong DB
    const user = await this.usersService.upsert({
      zaloId,
      displayName,
      avatarUrl,
    });

    // 4. Ký JWT (bao gồm avatarUrl để getMe() trả về đầy đủ)
    const payload: JwtPayload = {
      sub: user.id,
      zaloId: user.zaloId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };

    const token = this.generateJwt(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        zaloId: user.zaloId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // Dev-only login — tạo/đăng nhập user test, không cần Zalo token
  async devLogin() {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev login không khả dụng trên production');
    }

    const user = await this.usersService.upsert({
      zaloId: 'dev_test_user_001',
      displayName: 'Dev Tester',
      avatarUrl: undefined,
    });

    const payload: JwtPayload = {
      sub: user.id,
      zaloId: user.zaloId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };

    return {
      accessToken: this.generateJwt(payload),
      user: {
        id: user.id,
        zaloId: user.zaloId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refreshToken(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User không tồn tại');
    }

    const payload: JwtPayload = {
      sub: user.id,
      zaloId: user.zaloId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };

    return {
      accessToken: this.generateJwt(payload),
    };
  }
}
