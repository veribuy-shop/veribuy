import { IsUUID, IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

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
}
