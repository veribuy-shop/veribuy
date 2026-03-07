import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumberString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateVerificationRequestDto {
  @IsUUID('4')
  listingId: string;

  @IsUUID('4')
  sellerId: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  conditionGrade?: 'A' | 'B' | 'C';

  @IsOptional()
  @IsBoolean()
  imeiProvided?: boolean;

  @IsOptional()
  @IsBoolean()
  serialProvided?: boolean;

  /**
   * IMEI must be 14–16 digits (standard IMEI is 15 digits).
   * We accept a small range to handle edge cases.
   */
  @IsOptional()
  @IsNumberString()
  @Length(14, 16)
  imei?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  brand?: string;
}
