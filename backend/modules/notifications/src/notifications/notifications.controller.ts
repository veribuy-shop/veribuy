import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Headers,
  UnauthorizedException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { NotificationsService } from './notifications.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ContactUsDto } from './dto/contact-us.dto';
import { JwtAuthGuard, RolesGuard, Public, CurrentUser, PaginationDto } from '@veribuy/common';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Public()
  findAll() {
    return { message: 'notification-service is running' };
  }

  // ─── Internal: generic email dispatch ───────────────────────────────────────
  // Called by auth-service (and any other service) using INTERNAL_SERVICE_TOKEN.
  // No JWT — validated via timing-safe header check.
  @Post('send-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async sendEmail(
    @Headers('x-internal-service') internalToken: string,
    @Body() body: { type: string; to: string; payload: Record<string, any> },
  ) {
    this.verifyInternalToken(internalToken);
    await this.notificationsService.sendEmailInternal(body);
    return { ok: true };
  }

  // ─── Internal: system message (service-to-service) ──────────────────────────
  @Post('messages/internal')
  @Public()
  async createSystemMessage(
    @Headers('x-internal-service') internalToken: string,
    @Body() body: {
      senderId: string;
      recipientId: string;
      subject?: string;
      content: string;
    },
  ) {
    this.verifyInternalToken(internalToken);
    return this.notificationsService.createMessage(body);
  }

  // ─── Public: Contact Us form ─────────────────────────────────────────────────
  // 5 submissions per hour per IP
  @Post('contact-us')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async contactUs(@Body() dto: ContactUsDto) {
    await this.notificationsService.contactUs(dto);
    return { ok: true };
  }

  // ─── In-app messages ─────────────────────────────────────────────────────────

  // Create a new message — senderId always comes from JWT.
  // Optionally include emailContext to fire an email to the recipient.
  @Post('messages')
  async createMessage(
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.notificationsService.createMessage(
      {
        senderId: user.userId,
        recipientId: dto.recipientId,
        listingId: dto.listingId,
        subject: dto.subject,
        content: dto.content,
      },
      dto.emailContext,
    );
  }

  // Get all messages for a user
  @Get('messages/user/:userId')
  async getUserMessages(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own messages');
    }
    return this.notificationsService.getUserMessages(userId, pagination);
  }

  // Get conversation between two users
  @Get('messages/conversation')
  async getConversation(
    @Query('userId') userId: string,
    @Query('otherUserId') otherUserId: string,
    @Query('listingId') listingId: string | undefined,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own conversations');
    }
    return this.notificationsService.getConversation(userId, otherUserId, listingId, pagination);
  }

  // Get messages by listing
  @Get('messages/listing/:listingId')
  async getMessagesByListing(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.notificationsService.getMessagesByListing(listingId, user.userId, pagination);
  }

  // Mark message as read — userId always comes from JWT
  @Patch('messages/:messageId/read')
  async markAsRead(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.notificationsService.markAsRead(messageId, user.userId);
  }

  // Get unread count
  @Get('messages/unread-count/:userId')
  async getUnreadCount(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own unread count');
    }
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private verifyInternalToken(internalToken: string): void {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      this.logger.error('INTERNAL_SERVICE_TOKEN is not configured');
      throw new UnauthorizedException('Internal service token not configured');
    }

    let valid = false;
    try {
      const a = Buffer.from(internalToken ?? '');
      const b = Buffer.from(expected);
      valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
  }
}
