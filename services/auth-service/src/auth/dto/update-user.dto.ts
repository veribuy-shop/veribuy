import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

enum AdminRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsEnum(AdminRole, { message: 'role must be one of: BUYER, SELLER, ADMIN' })
  role?: 'BUYER' | 'SELLER' | 'ADMIN';
}
