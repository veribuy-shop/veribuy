import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { DeviceType, ConditionGrade } from '.prisma/veribuy-client';

export class CreateListingDto {
  // sellerId is NOT accepted from the request body — it is injected from the JWT in the controller.
  // Decorated (optional + UUID) so the global forbidding whitelist allows its absence, while
  // never accepting a client-supplied value (the controller overrides it from the JWT anyway).
  @IsOptional()
  @IsUUID()
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
  @MaxLength(100)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsEnum(ConditionGrade)
  @IsOptional()
  conditionGrade?: ConditionGrade;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, { message: 'IMEI must be exactly 15 digits' })
  imei?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}
