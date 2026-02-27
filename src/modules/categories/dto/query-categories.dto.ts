import { CategoryType } from '../../../common/enums/category-type.enum';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryCategoriesDto {
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;
}
