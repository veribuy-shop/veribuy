import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException, Headers, UnauthorizedException } from '@nestjs/common';
import { UnotificationsService } from './notifications.service';
import { JwtAuthGuard, RolesGuard, Public, CurrentUser, PaginationDto } from '@veribuy/common';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnotificationsController {
  constructor(private readonly notificationsService: UnotificationsService) {}

  @Get()
  @Public()
  findAll() {
    return { message: 'notification-service is running' };
  }

  /**
   * Internal endpoint for service-to-service system notifications.
   * Called by transaction-service (and other services) without a user JWT.
   * Uses a custom header `x-internal-service` to identify the caller.
   * No JWT is required — this route is @Public() but validates the caller header.
   */
  @Post('messages/internal')
  @Public()
  async createSystemMessage(
    @Headers('x-internal-service') internalService: string,
    @Body() body: {
      senderId: string;
      recipientId: string;
      subject?: string;
      content: string;
    },
  ) {
    if (!internalService || internalService !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
    return this.notificationsService.createMessage(body);
  }

  // Create a new message
  @Post('messages')
  async createMessage(
    @Body() body: {
      senderId: string;
      recipientId: string;
      listingId?: string;
      subject?: string;
      content: string;
    },
    @CurrentUser() user: any,
  ) {
    // Ensure the sender ID in the body matches the authenticated user
    if (body.senderId !== user.userId) {
      throw new ForbiddenException('You can only send messages as yourself');
    }
    return this.notificationsService.createMessage(body);
  }

  // Get all messages for a user
  @Get('messages/user/:userId')
  async getUserMessages(@Param('userId') userId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    // Users can only view their own messages
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
    @CurrentUser() user: any,
  ) {
    // Users can only view conversations they are part of
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own conversations');
    }
    return this.notificationsService.getConversation(userId, otherUserId, listingId);
  }

  // Get messages by listing
  @Get('messages/listing/:listingId')
  async getMessagesByListing(
    @Param('listingId') listingId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    // Users can only view messages for listings they are involved in
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own messages');
    }
    return this.notificationsService.getMessagesByListing(listingId, userId);
  }

  // Mark message as read
  @Patch('messages/:messageId/read')
  async markAsRead(
    @Param('messageId') messageId: string,
    @Body('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    // Users can only mark their own messages as read
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only mark your own messages as read');
    }
    return this.notificationsService.markAsRead(messageId, userId);
  }

  // Get unread count
  @Get('messages/unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: string, @CurrentUser() user: any) {
    // Users can only view their own unread count
    if (userId !== user.userId) {
      throw new ForbiddenException('You can only view your own unread count');
    }
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }
}
