import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SocialAuthDto {
  @IsIn(['GOOGLE', 'APPLE'])
  provider: 'GOOGLE' | 'APPLE';

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsOptional()
  @IsIn(['login', 'register'])
  action?: 'login' | 'register';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
