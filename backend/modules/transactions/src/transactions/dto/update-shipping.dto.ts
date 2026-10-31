import { IsNumber, IsString, IsIn, IsOptional, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingAddressDto } from './create-order.dto';

export class UpdateShippingDto {
  /**
   * Display hint only — the authoritative shipping fee is always recomputed
   * server-side from the listing's weight profile and destination postcode.
   * Retained for backwards compatibility; never used to charge the buyer.
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingFee?: number;

  @IsString()
  @IsIn(['TRACKED_24', 'TRACKED_48', 'SPECIAL_DELIVERY_1PM'])
  shippingService: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  donationAmount?: number;

  @IsString()
  @IsOptional()
  @IsIn(['HOME', 'CLICK_AND_COLLECT'])
  deliveryMethod?: string;

  /** Sanitised server-side to a bounded set of string fields. */
  @IsOptional()
  @IsObject()
  collectionPoint?: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
}
