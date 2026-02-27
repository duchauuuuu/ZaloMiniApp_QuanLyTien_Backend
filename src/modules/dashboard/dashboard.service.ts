import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { Transaction } from '../../database/entities/transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletsRepo: Repository<Wallet>,
  ) {}

  async getOverview(userId: string, month: number, year: number) {
    // Tổng thu/chi tháng hiện tại
    const currentMonthRaw = await this.transactionsRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM t.transactionDate) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM t.transactionDate) = :year', { year })
      .groupBy('t.type')
      .getRawMany<{ type: TransactionType; total: string }>();

    const incomeRow = currentMonthRaw.find((r) => r.type === TransactionType.INCOME);
    const expenseRow = currentMonthRaw.find((r) => r.type === TransactionType.EXPENSE);

    const totalIncome = parseFloat(incomeRow?.total ?? '0');
    const totalExpense = parseFloat(expenseRow?.total ?? '0');

    // Tháng trước để so sánh
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const prevMonthRaw = await this.transactionsRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM t.transactionDate) = :month', { month: prevMonth })
      .andWhere('EXTRACT(YEAR FROM t.transactionDate) = :year', { year: prevYear })
      .groupBy('t.type')
      .getRawMany<{ type: TransactionType; total: string }>();

    const prevIncome = parseFloat(
      prevMonthRaw.find((r) => r.type === TransactionType.INCOME)?.total ?? '0',
    );
    const prevExpense = parseFloat(
      prevMonthRaw.find((r) => r.type === TransactionType.EXPENSE)?.total ?? '0',
    );

    // Số dư tất cả ví
    const wallets = await this.walletsRepo.find({ where: { userId } });
    const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0);

    // % thay đổi so tháng trước
    const incomeChange = prevIncome === 0 ? null : ((totalIncome - prevIncome) / prevIncome) * 100;
    const expenseChange =
      prevExpense === 0 ? null : ((totalExpense - prevExpense) / prevExpense) * 100;

    return {
      month,
      year,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalWalletBalance: totalBalance,
      walletCount: wallets.length,
      comparedToPrevMonth: {
        incomeChange: incomeChange !== null ? Math.round(incomeChange * 100) / 100 : null,
        expenseChange: expenseChange !== null ? Math.round(expenseChange * 100) / 100 : null,
        prevIncome,
        prevExpense,
      },
    };
  }
}
