import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity';
import { CategoryType } from '../../common/enums/category-type.enum';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DEFAULT_CATEGORIES } from './categories.constants';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async seedDefaults(userId: string) {
    const existing = await this.categoriesRepository.find({ where: { userId, isDefault: true } });

    if (existing.length === 0) {
      // Lần đầu: tạo mới toàn bộ danh mục mặc định
      const defaults = DEFAULT_CATEGORIES.map((cat) =>
        this.categoriesRepository.create({ ...cat, userId, isDefault: true }),
      );
      await this.categoriesRepository.save(defaults);
      return;
    }

    // Cập nhật tên/icon/color nếu constants đã thay đổi
    for (const def of DEFAULT_CATEGORIES) {
      const match = existing.find(
        (e) => e.type === def.type && (e.name === def.name || e.name.startsWith(def.name.split(' ')[0])),
      );
      if (match && match.name !== def.name) {
        await this.categoriesRepository.update(match.id, { name: def.name, icon: def.icon, color: def.color });
      }
    }
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const exists = await this.categoriesRepository.findOne({
      where: { userId, type: dto.type, name: dto.name },
    });

    if (exists) {
      throw new ConflictException(`Danh mục "${dto.name}" đã tồn tại`);
    }

    const category = this.categoriesRepository.create({
      userId,
      name: dto.name,
      type: dto.type,
      icon: dto.icon,
      color: dto.color,
      isDefault: false,
    });

    return this.categoriesRepository.save(category);
  }

  findAllByUser(userId: string, query: QueryCategoriesDto) {
    return this.categoriesRepository.find({
      where: {
        userId,
        ...(query.type ? { type: query.type } : {}),
      },
      order: { isDefault: 'DESC', type: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    return category;
  }

  async update(id: string, userId: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id, userId);

    if (dto.name && dto.name !== category.name) {
      const exists = await this.categoriesRepository.findOne({
        where: { userId, type: category.type, name: dto.name },
      });

      if (exists) {
        throw new ConflictException(`Danh mục "${dto.name}" đã tồn tại`);
      }
    }

    await this.categoriesRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
    });

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const category = await this.findOne(id, userId);

    if (category.isDefault) {
      throw new BadRequestException('Không thể xoá danh mục mặc định');
    }

    await this.categoriesRepository.delete({ id, userId });
  }

  findByType(userId: string, type: CategoryType) {
    return this.categoriesRepository.find({
      where: { userId, type },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }
}
