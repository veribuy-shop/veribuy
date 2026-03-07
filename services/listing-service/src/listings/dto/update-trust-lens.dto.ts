import { IsEnum, IsOptional, IsArray, IsString } from 'class-validator';
import { TrustLensStatus, IntegrityFlag, ConditionGrade } from '.prisma/listing-client';

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
}
