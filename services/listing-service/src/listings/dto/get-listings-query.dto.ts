import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeviceType, ListingStatus, TrustLensStatus } from '.prisma/listing-client';
import { PaginationDto } from '@veribuy/common';

export class GetListingsQueryDto extends PaginationDto {
  @IsEnum(DeviceType)
  @IsOptional()
  deviceType?: DeviceType;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;

  @IsEnum(TrustLensStatus)
  @IsOptional()
  trustLensStatus?: TrustLensStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  sellerId?: string;
}
