import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|\+44\s?\d{4}\s?\d{6}|0\d{4}\s?\d{6})$/, {
    message: 'Please provide a valid UK mobile or phone number',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  code!: string;
}
