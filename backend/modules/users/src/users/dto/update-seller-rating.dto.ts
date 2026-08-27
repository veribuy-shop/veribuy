import { IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateSellerRatingDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  sellerRating: number | null;

  @IsInt()
  @Min(0)
  totalRatings: number;
}
