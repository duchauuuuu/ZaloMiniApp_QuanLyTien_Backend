import { IsObject, IsOptional, IsString } from 'class-validator';

export class ZaloUserInfoDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class ZaloLoginDto {
  // zaloId lấy từ getUserID() — luôn có khi chạy trong Zalo
  @IsString()
  zaloId: string;

  // accessToken để backend verify (tuỳ chọn)
  @IsOptional()
  @IsString()
  accessToken?: string;

  // userInfo từ getUserInfo() — có tên + avatar (cần quyền scope.userInfo)
  @IsOptional()
  @IsObject()
  userInfo?: ZaloUserInfoDto;
}
