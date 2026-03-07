import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { EvidenceType } from '.prisma/evidence-client';

export class UploadEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  @IsUUID()
  @IsNotEmpty()
  sellerId: string;

  @IsEnum(EvidenceType)
  @IsNotEmpty()
  type: EvidenceType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  metadata?: string; // JSON string for additional metadata
}
