import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildBaseQuery(
    userId: string,
    query: QueryTransactionsDto,
  ): SelectQueryBuilder<Transaction> {
    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.wallet', 'wallet')
      .where('t.userId = :userId', { userId });

    if (query.walletId) {
      qb.andWhere('t.walletId = :walletId', { walletId: query.walletId });
    }

    if (query.categoryId) {
      qb.andWhere('t.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    // Lọc theo tháng + năm (ưu tiên hơn from/to nếu có)
    if (query.month && query.year) {
      qb.andWhere(
        "EXTRACT(MONTH FROM t.transactionDate) = :month AND EXTRACT(YEAR FROM t.transactionDate) = :year",
        { month: query.month, year: query.year },
      );
    } else if (query.year) {
      qb.andWhere("EXTRACT(YEAR FROM t.transactionDate) = :year", {
        year: query.year,
      });
    } else {
      if (query.from) {
        qb.andWhere('t.transactionDate >= :from', { from: query.from });
      }

      if (query.to) {
        qb.andWhere('t.transactionDate <= :to', { to: query.to });
      }
    }

    return qb;
  }

  // ─── Tạo giao dịch ────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTransactionDto) {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: dto.walletId, userId },
      });

      if (!wallet) {
        throw new NotFoundException('Ví tiền không tồn tại');
      }

      const currentBalance = parseFloat(wallet.balance);
      const amount = dto.amount;

      if (dto.type === TransactionType.EXPENSE && currentBalance < amount) {
        throw new BadRequestException('Số dư ví không đủ');
      }

      const newBalance =
        dto.type === TransactionType.INCOME
          ? currentBalance + amount
          : currentBalance - amount;

      await manager.update(Wallet, { id: wallet.id }, { balance: newBalance.toFixed(2) });

      const transaction = manager.create(Transaction, {
        userId,
        walletId: dto.walletId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: amount.toString(),
        transactionDate: new Date(dto.transactionDate),
        note: dto.note,
        receiptImage: dto.receiptImage,
      });

      const saved = await manager.save(transaction);

      return manager.findOne(Transaction, {
        where: { id: saved.id },
        relations: { category: true, wallet: true },
      });
    });
  }

  // ─── Cập nhật giao dịch ───────────────────────────────────────────────────

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Transaction, {
        where: { id, userId },
      });

      if (!existing) {
        throw new NotFoundException('Giao dịch không tồn tại');
      }

      const oldAmount = parseFloat(existing.amount);
      const oldType = existing.type;
      const walletId = dto.walletId ?? existing.walletId;

      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId, userId },
      });

      if (!wallet) {
        throw new NotFoundException('Ví tiền không tồn tại');
      }

      let balance = parseFloat(wallet.balance);

      if (existing.walletId === walletId) {
        balance =
          oldType === TransactionType.INCOME
            ? balance - oldAmount
            : balance + oldAmount;
      }

      const newAmount = dto.amount ?? oldAmount;
      const newType = dto.type ?? oldType;

      if (newType === TransactionType.EXPENSE && balance < newAmount) {
        throw new BadRequestException('Số dư ví không đủ');
      }

      balance =
        newType === TransactionType.INCOME
          ? balance + newAmount
          : balance - newAmount;

      await manager.update(Wallet, { id: walletId }, { balance: balance.toFixed(2) });

      await manager.update(Transaction, { id }, {
        ...(dto.walletId && { walletId: dto.walletId }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.type && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: dto.amount.toString() }),
        ...(dto.transactionDate && {
          transactionDate: new Date(dto.transactionDate),
        }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.receiptImage !== undefined && {
          receiptImage: dto.receiptImage,
        }),
      });

      return manager.findOne(Transaction, {
        where: { id },
        relations: { category: true, wallet: true },
      });
    });
  }

  // ─── Lấy danh sách phẳng (flat list) ─────────────────────────────────────

  findAllByUser(userId: string, query: QueryTransactionsDto) {
    return this.buildBaseQuery(userId, query)
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getMany();
  }

  // ─── Lịch sử nhóm theo ngày ───────────────────────────────────────────────

  async findHistory(userId: string, query: QueryTransactionsDto) {
    const transactions = await this.buildBaseQuery(userId, query)
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getMany();

    // Nhóm theo ngày (YYYY-MM-DD)
    const grouped: Record<
      string,
      {
        date: string;
        totalIncome: number;
        totalExpense: number;
        transactions: Transaction[];
      }
    > = {};

    for (const tx of transactions) {
      const dateKey = tx.transactionDate.toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          totalIncome: 0,
          totalExpense: 0,
          transactions: [],
        };
      }

      const amount = parseFloat(tx.amount);

      if (tx.type === TransactionType.INCOME) {
        grouped[dateKey].totalIncome += amount;
      } else {
        grouped[dateKey].totalExpense += amount;
      }

      grouped[dateKey].transactions.push(tx);
    }

    return {
      month: query.month,
      year: query.year,
      groups: Object.values(grouped),
    };
  }

  // ─── Tổng kết thu/chi theo kỳ ─────────────────────────────────────────────

  async getSummary(userId: string, query: QueryTransactionsDto) {
    const rawResult = await this.buildBaseQuery(userId, query)
      .select('t.type', 'type')
      .addSelect('SUM(CAST(t.amount AS DECIMAL))', 'total')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy('t.type')
      .getRawMany<{ type: TransactionType; total: string; count: string }>();

    const income = rawResult.find((r) => r.type === TransactionType.INCOME);
    const expense = rawResult.find((r) => r.type === TransactionType.EXPENSE);

    const totalIncome = parseFloat(income?.total ?? '0');
    const totalExpense = parseFloat(expense?.total ?? '0');

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeCount: parseInt(income?.count ?? '0', 10),
      expenseCount: parseInt(expense?.count ?? '0', 10),
      totalCount:
        parseInt(income?.count ?? '0', 10) +
        parseInt(expense?.count ?? '0', 10),
    };
  }

  // ─── Chi tiết ─────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
      relations: { category: true, wallet: true },
    });

    if (!transaction) {
      throw new NotFoundException('Giao dịch không tồn tại');
    }

    return transaction;
  }

  // ─── Xoá giao dịch ────────────────────────────────────────────────────────

  async remove(id: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { id, userId },
      });

      if (!transaction) {
        throw new NotFoundException('Giao dịch không tồn tại');
      }

      const wallet = await manager.findOne(Wallet, {
        where: { id: transaction.walletId, userId },
      });

      if (wallet) {
        const amount = parseFloat(transaction.amount);
        const newBalance =
          transaction.type === TransactionType.INCOME
            ? parseFloat(wallet.balance) - amount
            : parseFloat(wallet.balance) + amount;

        await manager.update(
          Wallet,
          { id: wallet.id },
          { balance: newBalance.toFixed(2) },
        );
      }

      await manager.delete(Transaction, { id });
    });
  }
}
