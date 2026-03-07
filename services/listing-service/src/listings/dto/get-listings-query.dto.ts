import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceType, ListingStatus, TrustLensStatus } from '.prisma/listing-client';
import { PaginationDto } from '@veribuy/common';

export class GetListingsQueryDto extends PaginationDto {
  @IsEnum(DeviceType)
  @IsOptional()
  deviceType?: DeviceType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;

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
}
