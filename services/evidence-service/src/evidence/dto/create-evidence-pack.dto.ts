import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateEvidencePackDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  // sellerId is injected from JWT in the controller — not accepted from client input
  sellerId: string;
}
