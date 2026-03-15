import { 
  IsString, 
  IsNumber, 
  IsNotEmpty, 
  IsOptional, 
  ValidateNested,
  IsIn,
  Min,
  Length
} from 'class-validator';
import { Type } from 'class-transformer';

class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 200)
  line1: string;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  state: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  postal_code: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  country: string; // ISO 3166-1 alpha-2 country code
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  buyerId: string;

  @IsString()
  @IsNotEmpty()
  sellerId: string;

  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingFee?: number;

  @IsString()
  @IsOptional()
  @IsIn(['TRACKED_24', 'TRACKED_48'])
  shippingService?: string;

  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'ZAR', 'KES'])
  @IsOptional()
  currency?: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsOptional()
  shippingAddress?: ShippingAddressDto;
}
