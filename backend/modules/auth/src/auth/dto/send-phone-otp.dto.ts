import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|\+44\s?\d{4}\s?\d{6}|0\d{4}\s?\d{6})$/, {
    message: 'Please provide a valid UK mobile or phone number (e.g., +44 7123 456789 or 07123 456789)',
  })
  phone!: string;
}
