import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
