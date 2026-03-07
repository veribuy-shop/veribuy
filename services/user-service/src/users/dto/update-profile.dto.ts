import { IsString, IsOptional, MaxLength, IsUrl, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g. +14155552671)',
  })
  phone?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, {
    message: 'avatarUrl must be a valid HTTPS URL',
  })
  @MaxLength(2048)
  avatarUrl?: string;
}

