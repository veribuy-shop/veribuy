import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestCallbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(200)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  preferredTime?: string;
}
