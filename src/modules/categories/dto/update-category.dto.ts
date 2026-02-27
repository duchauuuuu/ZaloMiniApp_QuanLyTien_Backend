import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  icon?: string;

  @IsOptional()
  @IsString()
  @Length(4, 20)
  color?: string;
}
