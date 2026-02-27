import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/zalo-login
  // FE gửi zaloId (từ getUserID) + accessToken (tuỳ chọn) + userInfo (tuỳ chọn)
  @Post('zalo-login')
  zaloLogin(@Body() dto: ZaloLoginDto) {
    return this.authService.zaloLogin(dto.zaloId, dto.accessToken, dto.userInfo);
  }

  // POST /api/auth/dev-login — Đăng nhập test (chỉ dùng khi dev)
  @Post('dev-login')
  devLogin() {
    return this.authService.devLogin();
  }

  // POST /api/auth/refresh — Lấy JWT mới (khi sắp hết hạn)
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.refreshToken(user.id);
  }

  // GET /api/auth/me — Lấy thông tin user hiện tại từ JWT
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      zaloId: user.zaloId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
