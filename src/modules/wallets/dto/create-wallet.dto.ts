import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  icon?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
