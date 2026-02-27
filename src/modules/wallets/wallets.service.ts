import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';

const DEFAULT_WALLETS = [
  { name: 'Tiền mặt', icon: '💵', isDefault: true  },
  { name: 'Ngân hàng', icon: '🏦', isDefault: false },
  { name: 'Momo',      icon: '📱', isDefault: false },
];

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async seedDefaults(userId: string) {
    const existing = await this.walletsRepository.find({ where: { userId } });

    if (existing.length === 0) {
      // Lần đầu: tạo 3 ví mặc định
      const wallets = DEFAULT_WALLETS.map((w) =>
        this.walletsRepository.create({ ...w, userId, currency: 'VND' }),
      );
      await this.walletsRepository.save(wallets);
      return;
    }

    // Đổi tên "Ví chính" → "Tiền mặt" (nếu tồn tại)
    const viChinh = existing.find((w) => w.name === 'Ví chính');
    if (viChinh) {
      await this.walletsRepository.update(viChinh.id, {
        name: 'Tiền mặt',
        icon: '💵',
        isDefault: true,
      });
    }

    // Thêm ví còn thiếu trong danh sách mặc định
    const existingNames = existing.map((w) =>
      w.name === 'Ví chính' ? 'Tiền mặt' : w.name,
    );
    const missing = DEFAULT_WALLETS.filter(
      (w) => !existingNames.includes(w.name),
    );
    if (missing.length > 0) {
      await this.walletsRepository.save(
        missing.map((w) =>
          this.walletsRepository.create({ ...w, userId, currency: 'VND' }),
        ),
      );
    }
  }

  async create(userId: string, dto: CreateWalletDto) {
    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault) {
        await manager.update(
          Wallet,
          { userId, isDefault: true },
          { isDefault: false },
        );
      }

      const wallet = manager.create(Wallet, {
        userId,
        name: dto.name,
        icon: dto.icon,
        currency: dto.currency ?? 'VND',
        isDefault: dto.isDefault ?? false,
      });

      return manager.save(wallet);
    });
  }

  findAllByUser(userId: string) {
    return this.walletsRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }
}
