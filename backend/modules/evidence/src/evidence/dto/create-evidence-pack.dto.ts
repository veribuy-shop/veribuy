import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateEvidencePackDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  // sellerId is injected from JWT in the controller — not accepted from client input.
  // Decorated (optional + UUID) so the global forbidding whitelist allows its absence
  // while rejecting a malformed client-supplied value.
  @IsOptional()
  @IsUUID()
  sellerId: string;
}
