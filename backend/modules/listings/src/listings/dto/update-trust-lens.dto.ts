import { IsEnum, IsOptional, IsArray, IsString, MaxLength } from 'class-validator';
import { TrustLensStatus, IntegrityFlag, ConditionGrade } from '.prisma/veribuy-client';

export class UpdateTrustLensDto {
  @IsEnum(TrustLensStatus, {
    message: `trustLensStatus must be one of: ${Object.values(TrustLensStatus).join(', ')}`,
  })
  trustLensStatus: TrustLensStatus;

  @IsOptional()
  @IsEnum(ConditionGrade)
  conditionGrade?: ConditionGrade;

  @IsOptional()
  @IsArray()
  @IsEnum(IntegrityFlag, { each: true })
  integrityFlags?: IntegrityFlag[];

  /** Reviewer's explanation, sent to the seller when a listing is rejected. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
