import { IsNumber, IsString, IsIn, IsOptional, Min } from 'class-validator';

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
}
