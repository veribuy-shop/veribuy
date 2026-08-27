import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

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
}
