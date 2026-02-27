import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { Category } from './category.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  walletId: string;

  @Column({ nullable: true })
  @Index()
  categoryId?: string;

  @Column({ type: 'enum', enum: TransactionType })
  @Index()
  type: TransactionType;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ nullable: true, length: 500 })
  note?: string;

  @Column({ type: 'timestamptz' })
  @Index()
  transactionDate: Date;

  @Column({ nullable: true })
  receiptImage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @ManyToOne(() => Category, (category) => category.transactions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;
}
