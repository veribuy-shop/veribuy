import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@veribuy/common';

/**
 * Query for GET /notifications/messages/conversation. Declares the
 * conversation fields alongside pagination so the global
 * `forbidNonWhitelisted` validation accepts them.
 */
export class ConversationQueryDto extends PaginationDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  otherUserId!: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
