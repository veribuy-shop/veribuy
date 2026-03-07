import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  MinLength,
  IsUUID,
  Matches,
} from 'class-validator';
import { DeviceType, ConditionGrade } from '.prisma/listing-client';

export class CreateListingDto {
  @IsUUID()
  @IsNotEmpty()
  sellerId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  @MaxLength(2000)
  description: string;

  @IsEnum(DeviceType)
  @IsNotEmpty()
  deviceType: DeviceType;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(ConditionGrade)
  @IsOptional()
  conditionGrade?: ConditionGrade;

  @IsString()
  @IsOptional()
  @Matches(/^\d{15}$/, { message: 'IMEI must be exactly 15 digits' })
  imei?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;
}
