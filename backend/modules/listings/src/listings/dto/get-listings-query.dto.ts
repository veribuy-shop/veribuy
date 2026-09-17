import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceType, ListingStatus, TrustLensStatus, ListingFormat } from '.prisma/veribuy-client';
import { PaginationDto } from '@veribuy/common';

export class GetListingsQueryDto extends PaginationDto {
  @IsEnum(DeviceType)
  @IsOptional()
  deviceType?: DeviceType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsEnum(ListingFormat)
  format?: ListingFormat;

  @IsOptional()
  @IsString()
  status?: ListingStatus | 'ALL';

  @IsEnum(TrustLensStatus)
  @IsOptional()
  trustLensStatus?: TrustLensStatus;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @IsString()
  @IsOptional()
  @MaxLength(36)
  sellerId?: string;

  @IsEnum(['price', 'createdAt', 'endingSoonest', 'mostBids'])
  @IsOptional()
  sortBy?: 'price' | 'createdAt' | 'endingSoonest' | 'mostBids';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  // conditionGrade: accept single string or repeated params (?conditionGrade=A&conditionGrade=B)
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  conditionGrade?: string[];

  @IsString()
  @IsOptional()
  minPrice?: string;

  @IsString()
  @IsOptional()
  maxPrice?: string;
}
