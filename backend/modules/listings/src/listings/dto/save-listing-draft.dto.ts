import { IsInt, IsObject, Max, Min } from 'class-validator';

export class SaveListingDraftDto {
  @IsObject()
  data: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @Max(10)
  step: number;
}
