import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}
