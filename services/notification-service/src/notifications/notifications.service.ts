import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // Create a new message
  async createMessage(data: {
    senderId: string;
    recipientId: string;
    listingId?: string;
    subject?: string;
    content: string;
  }) {
    const message = await this.prisma.message.create({
      data: {
        senderId: data.senderId,
        recipientId: data.recipientId,
        listingId: data.listingId,
        subject: data.subject,
        content: data.content,
      },
    });

    // Invalidate recipient's unread count cache
    await this.redis.del(`unread:${data.recipientId}`);

    return message;
  }

  // Get all messages for a user (inbox)
  async getUserMessages(userId: string, pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { recipientId: userId },
        { senderId: userId },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get conversation between two users about a specific listing (paginated)
  async getConversation(
    userId: string,
    otherUserId: string,
    listingId: string | undefined,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
    };

    if (listingId) {
      where.listingId = listingId;
    }

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get messages by listing (paginated)
  async getMessagesByListing(
    listingId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      listingId,
      OR: [
        { senderId: userId },
        { recipientId: userId },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Mark message as read — only recipient can mark as read
  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.recipientId !== userId) {
      throw new ForbiddenException('You can only mark your own messages as read');
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Invalidate unread count cache
    await this.redis.del(`unread:${userId}`);

    return updatedMessage;
  }

  // Get unread message count for user
  async getUnreadCount(userId: string) {
    const cacheKey = `unread:${userId}`;

    const cached = await this.redis.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const count = await this.prisma.message.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    // Cache for 1 minute
    await this.redis.set(cacheKey, count, 60);

    return count;
  }
}
