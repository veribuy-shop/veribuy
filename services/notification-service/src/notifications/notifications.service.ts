import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';

@Injectable()
export class UnotificationsService {
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
        orderBy: {
          createdAt: 'desc',
        },
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

  // Get conversation between two users about a specific listing
  async getConversation(userId: string, otherUserId: string, listingId?: string) {
    const where: any = {
      OR: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
    };

    if (listingId) {
      where.listingId = listingId;
    }

    return this.prisma.message.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // Mark message as read
  async markAsRead(messageId: string, userId: string) {
    // Only allow recipient to mark as read
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.recipientId !== userId) {
      throw new Error('Message not found or unauthorized');
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

    // Try to get from cache first
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

    // Cache the count for 1 minute (60 seconds)
    await this.redis.set(cacheKey, count, 60);

    return count;
  }

  // Get messages by listing
  async getMessagesByListing(listingId: string, userId: string) {
    return this.prisma.message.findMany({
      where: {
        listingId,
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
