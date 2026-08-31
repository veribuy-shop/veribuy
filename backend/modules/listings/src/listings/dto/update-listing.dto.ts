import { IsString, IsOptional, IsNumber, Min, MaxLength, IsEnum } from 'class-validator';
import { ConditionGrade, ListingStatus } from '.prisma/veribuy-client';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(ConditionGrade)
  conditionGrade?: ConditionGrade;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  storageCapacity?: string;
}
