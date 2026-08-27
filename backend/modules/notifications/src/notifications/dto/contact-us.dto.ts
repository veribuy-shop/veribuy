import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactUsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fromName: string;

  @IsEmail()
  @MaxLength(200)
  fromEmail: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}
