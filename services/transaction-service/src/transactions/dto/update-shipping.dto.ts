import { IsNumber, IsString, IsIn, Min } from 'class-validator';

export class UpdateShippingDto {
  @IsNumber()
  @Min(0)
  shippingFee: number;

  @IsString()
  @IsIn(['TRACKED_24', 'TRACKED_48'])
  shippingService: string;
}
