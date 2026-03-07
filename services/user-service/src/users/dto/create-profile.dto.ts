import { IsString, IsOptional, MaxLength, IsUrl, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProfileDto {
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName: string;

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
}
