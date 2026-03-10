import { IsEnum } from 'class-validator';

export enum VerificationStatusValue {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateVerificationStatusDto {
  @IsEnum(VerificationStatusValue, {
    message: `verificationStatus must be one of: ${Object.values(VerificationStatusValue).join(', ')}`,
  })
  verificationStatus: VerificationStatusValue;
}
