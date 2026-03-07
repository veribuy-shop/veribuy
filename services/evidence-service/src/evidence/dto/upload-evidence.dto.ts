import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EvidenceType } from '.prisma/evidence-client';

export class UploadEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  // sellerId is injected from JWT in the controller — not accepted from client input
  sellerId: string;

  @IsEnum(EvidenceType)
  @IsNotEmpty()
  type: EvidenceType;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  metadata?: string; // JSON string for additional metadata
}
