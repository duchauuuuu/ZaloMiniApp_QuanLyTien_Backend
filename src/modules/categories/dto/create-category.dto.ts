import { CategoryType } from '../../../common/enums/category-type.enum';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  icon?: string;

  @IsOptional()
  @IsString()
  @Length(4, 20)
  color?: string;
}
