import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { Transaction } from '../../database/entities/transaction.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepo: Repository<Transaction>,
  ) {}

  // Biểu đồ tròn: breakdown theo danh mục trong tháng
  async getByCategory(
    userId: string,
    month: number,
    year: number,
    type: TransactionType,
  ) {
    const rows = await this.transactionsRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .select('t.categoryId', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('category.icon', 'categoryIcon')
      .addSelect('category.color', 'categoryColor')
      .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .addSelect('COUNT(t.id)', 'count')
      .where('t.userId = :userId', { userId })
      .andWhere('t.type = :type', { type })
      .andWhere('EXTRACT(MONTH FROM t.transactionDate) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM t.transactionDate) = :year', { year })
      .groupBy('t.categoryId')
      .addGroupBy('category.name')
      .addGroupBy('category.icon')
      .addGroupBy('category.color')
      .orderBy('total', 'DESC')
      .getRawMany<{
        categoryId: string | null;
        categoryName: string | null;
        categoryIcon: string | null;
        categoryColor: string | null;
        total: string;
        count: string;
      }>();

    const grandTotal = rows.reduce((sum, r) => sum + parseFloat(r.total), 0);

    return {
      month,
      year,
      type,
      grandTotal,
      items: rows.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? 'Không phân loại',
        categoryIcon: r.categoryIcon ?? '📦',
        categoryColor: r.categoryColor ?? '#B0BEC5',
        total: parseFloat(r.total),
        count: parseInt(r.count, 10),
        percentage:
          grandTotal > 0
            ? Math.round((parseFloat(r.total) / grandTotal) * 10000) / 100
            : 0,
      })),
    };
  }

  // Biểu đồ cột: thu/chi 12 tháng trong năm
  async getByMonth(userId: string, year: number) {
    const rows = await this.transactionsRepo
      .createQueryBuilder('t')
      .select('EXTRACT(MONTH FROM t.transactionDate)::int', 'month')
      .addSelect('t.type', 'type')
      .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .where('t.userId = :userId', { userId })
      .andWhere('EXTRACT(YEAR FROM t.transactionDate) = :year', { year })
      .groupBy('EXTRACT(MONTH FROM t.transactionDate)::int')
      .addGroupBy('t.type')
      .orderBy('month', 'ASC')
      .getRawMany<{ month: number; type: TransactionType; total: string }>();

    // Tạo mảng đủ 12 tháng
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const incomeRow = rows.find((r) => r.month === m && r.type === TransactionType.INCOME);
      const expenseRow = rows.find((r) => r.month === m && r.type === TransactionType.EXPENSE);
      const income = parseFloat(incomeRow?.total ?? '0');
      const expense = parseFloat(expenseRow?.total ?? '0');

      return {
        month: m,
        income,
        expense,
        net: income - expense,
      };
    });

    const totalIncome = months.reduce((s, m) => s + m.income, 0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);

    return {
      year,
      totalIncome,
      totalExpense,
      months,
    };
  }

  // Thống kê tổng hợp all-time cho trang hồ sơ
  async getAllTimeStats(userId: string) {
    const rows = await this.transactionsRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
      .addSelect('COUNT(t.id)', 'count')
      .where('t.userId = :userId', { userId })
      .groupBy('t.type')
      .getRawMany<{ type: TransactionType; total: string; count: string }>();

    const income  = rows.find(r => r.type === TransactionType.INCOME);
    const expense = rows.find(r => r.type === TransactionType.EXPENSE);

    const totalIncome  = parseFloat(income?.total  ?? '0');
    const totalExpense = parseFloat(expense?.total  ?? '0');
    const incomeCount  = parseInt(income?.count  ?? '0', 10);
    const expenseCount = parseInt(expense?.count ?? '0', 10);

    // Tháng hoạt động (số tháng đã có giao dịch)
    const monthsResult = await this.transactionsRepo
      .createQueryBuilder('t')
      .select("TO_CHAR(t.transactionDate, 'YYYY-MM')", 'ym')
      .where('t.userId = :userId', { userId })
      .groupBy("TO_CHAR(t.transactionDate, 'YYYY-MM')")
      .getRawMany<{ ym: string }>();

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeCount,
      expenseCount,
      totalCount: incomeCount + expenseCount,
      activeMonths: monthsResult.length,
      savingsRate: totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 10000) / 100
        : 0,
    };
  }

  // So sánh tháng này vs tháng trước
  async compareMonths(userId: string, month: number, year: number) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const fetchMonth = async (m: number, y: number) => {
      const rows = await this.transactionsRepo
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0)', 'total')
        .addSelect('COUNT(t.id)', 'count')
        .where('t.userId = :userId', { userId })
        .andWhere('EXTRACT(MONTH FROM t.transactionDate) = :month', { month: m })
        .andWhere('EXTRACT(YEAR FROM t.transactionDate) = :year', { year: y })
        .groupBy('t.type')
        .getRawMany<{ type: TransactionType; total: string; count: string }>();

      const income = parseFloat(rows.find((r) => r.type === TransactionType.INCOME)?.total ?? '0');
      const expense = parseFloat(rows.find((r) => r.type === TransactionType.EXPENSE)?.total ?? '0');
      const incomeCount = parseInt(rows.find((r) => r.type === TransactionType.INCOME)?.count ?? '0', 10);
      const expenseCount = parseInt(rows.find((r) => r.type === TransactionType.EXPENSE)?.count ?? '0', 10);

      return { month: m, year: y, income, expense, net: income - expense, incomeCount, expenseCount };
    };

    const [current, previous] = await Promise.all([
      fetchMonth(month, year),
      fetchMonth(prevMonth, prevYear),
    ]);

    const calcChange = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 10000) / 100;

    return {
      current,
      previous,
      changes: {
        income: calcChange(current.income, previous.income),
        expense: calcChange(current.expense, previous.expense),
        net: calcChange(current.net, previous.net),
      },
    };
  }
}
