import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateEvidencePackDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  @IsUUID()
  @IsNotEmpty()
  sellerId: string;
}
