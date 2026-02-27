import { CategoryType } from '../../common/enums/category-type.enum';

export interface DefaultCategory {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Chi tiêu
  { name: 'Ăn uống',     type: CategoryType.EXPENSE, icon: '🍜', color: '#FF6B6B' },
  { name: 'Di chuyển',   type: CategoryType.EXPENSE, icon: '🚗', color: '#4ECDC4' },
  { name: 'Hóa đơn',     type: CategoryType.EXPENSE, icon: '📄', color: '#45B7D1' },
  { name: 'Giải trí',    type: CategoryType.EXPENSE, icon: '🎮', color: '#96CEB4' },
  { name: 'Mua sắm',     type: CategoryType.EXPENSE, icon: '🛍️', color: '#FFEAA7' },
  { name: 'Sức khỏe',    type: CategoryType.EXPENSE, icon: '💊', color: '#DDA0DD' },
  { name: 'Giáo dục',    type: CategoryType.EXPENSE, icon: '📚', color: '#98D8C8' },
  { name: 'Khác',         type: CategoryType.EXPENSE, icon: '📦', color: '#B0BEC5' },

  // Thu nhập
  { name: 'Lương',        type: CategoryType.INCOME, icon: '💰', color: '#66BB6A' },
  { name: 'Thưởng',       type: CategoryType.INCOME, icon: '🎁', color: '#FFA726' },
  { name: 'Đầu tư',       type: CategoryType.INCOME, icon: '📈', color: '#42A5F5' },
  { name: 'Khác',         type: CategoryType.INCOME, icon: '💵', color: '#AB47BC' },
];
