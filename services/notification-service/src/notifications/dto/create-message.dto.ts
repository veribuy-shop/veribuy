import { IsUUID, IsString, IsOptional, MaxLength, MinLength, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

class EmailContextDto {
  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  listingTitle?: string;
}

export class CreateMessageDto {
  @IsUUID()
  recipientId: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmailContextDto)
  emailContext?: EmailContextDto;
}
