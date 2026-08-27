import { IsInt, Min, Max, IsString, IsOptional, MaxLength } from 'class-validator';

export class RateOrderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}
