import { IsEnum, IsOptional, IsString, IsArray, ArrayMaxSize, MaxLength } from 'class-validator';

export enum ReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

export class UpdateVerificationStatusDto {
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  integrityFlags?: string[];
}
