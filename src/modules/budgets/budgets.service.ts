import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { Budget } from '../../database/entities/budget.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

// Ngưỡng cảnh báo: >= 80% đã dùng
const WARN_THRESHOLD = 80;
// Ngưỡng nguy hiểm: >= 100% đã dùng
const DANGER_THRESHOLD = 100;

export type BudgetStatus = 'safe' | 'warning' | 'exceeded';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetsRepo: Repository<Budget>,
    @InjectRepository(Transaction)
    private readonly transactionsRepo: Repository<Transaction>,
  ) {}

  create(userId: string, dto: CreateBudgetDto) {
    const budget = this.budgetsRepo.create({
      userId,
      categoryId: dto.categoryId,
      amount: dto.amount.toString(),
      period: dto.period,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });

    return this.budgetsRepo.save(budget);
  }

  async update(id: string, userId: string, dto: UpdateBudgetDto) {
    const budget = await this.budgetsRepo.findOne({ where: { id, userId } });

    if (!budget) {
      throw new NotFoundException('Ngân sách không tồn tại');
    }

    await this.budgetsRepo.update(id, {
      ...(dto.amount !== undefined && { amount: dto.amount.toString() }),
      ...(dto.period && { period: dto.period }),
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
    });

    return this.budgetsRepo.findOne({ where: { id } });
  }

  async remove(id: string, userId: string) {
    const budget = await this.budgetsRepo.findOne({ where: { id, userId } });

    if (!budget) {
      throw new NotFoundException('Ngân sách không tồn tại');
    }

    await this.budgetsRepo.delete({ id, userId });
  }

  findAllByUser(userId: string) {
    return this.budgetsRepo.find({
      where: { userId },
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Tính số tiền đã chi trong kỳ của 1 budget
  private async calcSpent(budget: Budget, userId: string): Promise<number> {
    const now = new Date();

    // Xác định khoảng thời gian của kỳ hiện tại
    let from: Date;
    let to: Date = now;

    if (budget.period === 'CUSTOM') {
      // Kỳ tùy chỉnh: dùng startDate và endDate của budget
      from = budget.startDate;
      to   = budget.endDate ?? now;
    } else if (budget.endDate && budget.endDate < now) {
      from = budget.startDate;
      to   = budget.endDate;
    } else {
      // Lấy kỳ hiện tại dựa trên period
      switch (budget.period) {
        case 'WEEKLY': {
          const day = now.getDay();
          from = new Date(now);
          from.setDate(now.getDate() - day);
          from.setHours(0, 0, 0, 0);
          break;
        }
        case 'YEARLY':
          from = new Date(now.getFullYear(), 0, 1);
          break;
        case 'MONTHLY':
        default:
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }

    const result = await this.transactionsRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.EXPENSE })
      .andWhere(budget.categoryId ? 't.categoryId = :categoryId' : '1=1', {
        categoryId: budget.categoryId,
      })
      .andWhere('t.transactionDate >= :from', { from })
      .andWhere('t.transactionDate <= :to', { to })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }

  // Trả về tất cả ngân sách kèm trạng thái sử dụng
  async getBudgetStatus(userId: string) {
    const budgets = await this.budgetsRepo.find({
      where: { userId },
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });

    const statuses = await Promise.all(
      budgets.map(async (budget) => {
        const limit = parseFloat(budget.amount);
        const spent = await this.calcSpent(budget, userId);
        const remaining = Math.max(0, limit - spent);
        const usagePercent = limit > 0 ? Math.round((spent / limit) * 10000) / 100 : 0;

        let status: BudgetStatus = 'safe';
        if (usagePercent >= DANGER_THRESHOLD) status = 'exceeded';
        else if (usagePercent >= WARN_THRESHOLD) status = 'warning';

        return {
          id: budget.id,
          category: budget.category
            ? {
                id: budget.category.id,
                name: budget.category.name,
                icon: budget.category.icon,
                color: budget.category.color,
              }
            : null,
          period: budget.period,
          startDate: budget.startDate?.toISOString(),
          endDate: budget.endDate?.toISOString(),
          limit,
          spent,
          remaining,
          usagePercent,
          status,
          // Thông báo cảnh báo
          alert:
            status === 'exceeded'
              ? `⚠️ Đã vượt ngân sách ${budget.category?.name ?? ''} (${usagePercent}%)`
              : status === 'warning'
                ? `🟡 Sắp vượt ngân sách ${budget.category?.name ?? ''} (${usagePercent}%)`
                : null,
        };
      }),
    );

    const exceeded = statuses.filter((s) => s.status === 'exceeded');
    const warnings = statuses.filter((s) => s.status === 'warning');

    return {
      budgets: statuses,
      summary: {
        total: statuses.length,
        exceeded: exceeded.length,
        warning: warnings.length,
        safe: statuses.filter((s) => s.status === 'safe').length,
      },
      alerts: [...exceeded, ...warnings]
        .map((s) => s.alert)
        .filter(Boolean),
    };
  }
}
