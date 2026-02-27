import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryType } from '../../common/enums/category-type.enum';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';

@Entity({ name: 'categories' })
@Index(['userId', 'type', 'name'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'enum', enum: CategoryType })
  @Index()
  type: CategoryType;

  @Column({ nullable: true, length: 10 })
  icon?: string;

  @Column({ nullable: true, length: 20 })
  color?: string;

  // Danh mục mặc định (seed sẵn) — không cho phép xoá
  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Transaction, (transaction) => transaction.category)
  transactions: Transaction[];
}
