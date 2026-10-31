import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateOfferDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RespondToOfferDto {
  /** Seller: accept / decline. Buyer: withdraw. */
  @IsIn(['ACCEPT', 'DECLINE', 'WITHDRAW'])
  action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW';
}
