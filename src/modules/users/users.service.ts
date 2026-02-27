import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

export interface UpsertUserPayload {
  zaloId: string;
  displayName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByZaloId(zaloId: string) {
    return this.usersRepository.findOne({ where: { zaloId } });
  }

  // Tạo mới hoặc cập nhật user từ thông tin Zalo
  async upsert(payload: UpsertUserPayload): Promise<User> {
    let user = await this.findByZaloId(payload.zaloId);

    if (user) {
      await this.usersRepository.update(user.id, {
        displayName: payload.displayName ?? user.displayName,
        avatarUrl: payload.avatarUrl ?? user.avatarUrl,
      });

      return this.usersRepository.findOne({ where: { id: user.id } }) as Promise<User>;
    }

    user = this.usersRepository.create({
      zaloId: payload.zaloId,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
    });

    return this.usersRepository.save(user);
  }

  async getProfile(id: string) {
    return this.usersRepository.findOne({
      where: { id },
      select: ['id', 'zaloId', 'displayName', 'avatarUrl', 'email', 'phoneNumber', 'createdAt'],
    });
  }
}
