import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';
import { EmailService } from './email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private email: EmailService,
  ) {}

  // ─── In-app messages ─────────────────────────────────────────────────────────

  // Create a new in-app message.
  // Pass emailContext to also fire an email notification to the recipient.
  async createMessage(
    data: {
      senderId: string;
      recipientId: string;
      listingId?: string;
      subject?: string;
      content: string;
    },
    emailContext?: {
      senderName?: string;
      recipientEmail?: string;
      recipientName?: string;
      listingTitle?: string;
    },
  ) {
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
    await this.redis.del(`unread:${data.recipientId}`).catch((err: Error) =>
      this.logger.warn(`Redis DEL failed for unread:${data.recipientId}: ${err.message}`),
    );

    // Fire email notification (fire-and-forget — never block the response)
    if (emailContext?.recipientEmail) {
      this.email
        .sendContactSellerEmail({
          sellerEmail: emailContext.recipientEmail,
          sellerName: emailContext.recipientName ?? '',
          buyerName: emailContext.senderName ?? '',
          listingTitle: emailContext.listingTitle ?? '',
          subject: data.subject || 'New message',
          message: data.content,
          listingId: data.listingId || '',
        })
        .catch((err) =>
          this.logger.error(`Contact-seller email failed: ${err?.message}`),
        );
    }

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
    await this.redis.del(`unread:${userId}`).catch((err: Error) =>
      this.logger.warn(`Redis DEL failed for unread:${userId}: ${err.message}`),
    );

    return updatedMessage;
  }

  // Get unread message count for user
  async getUnreadCount(userId: string) {
    const cacheKey = `unread:${userId}`;

    try {
      const cached = await this.redis.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch (err) {
      this.logger.warn(`Redis GET failed for ${cacheKey}: ${(err as Error).message}`);
    }

    const count = await this.prisma.message.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    // Cache for 1 minute — fail open
    await this.redis.set(cacheKey, count, 60).catch((err: Error) =>
      this.logger.warn(`Redis SET failed for ${cacheKey}: ${err.message}`),
    );

    return count;
  }

  // ─── Email-only notifications (no in-app message stored) ─────────────────────

  // Generic internal email dispatch — called by other services via internal token
  async sendEmailInternal(data: {
    type: string;
    to: string;
    payload: Record<string, any>;
  }): Promise<void> {
    switch (data.type) {
      case 'verification':
        await this.email.sendVerificationEmail(data.to, data.payload['name'], data.payload['token']);
        break;
      case 'welcome':
        await this.email.sendWelcomeEmail(data.to, data.payload['name']);
        break;
      case 'password_reset':
        await this.email.sendPasswordResetEmail(data.to, data.payload['name'], data.payload['token']);
        break;
      case 'order_confirmed':
        await this.email.sendOrderConfirmationEmail({
          buyerEmail: data.to,
          buyerName: data.payload['buyerName'],
          listingTitle: data.payload['listingTitle'],
          orderId: data.payload['orderId'],
          amount: data.payload['amount'],
        });
        break;
      case 'order_status':
        await this.email.sendOrderStatusEmail({
          recipientEmail: data.to,
          recipientName: data.payload['recipientName'],
          listingTitle: data.payload['listingTitle'],
          orderId: data.payload['orderId'],
          status: data.payload['status'],
          message: data.payload['message'],
        });
        break;
      case 'listing_created':
        await this.email.sendListingCreatedEmail({
          sellerEmail: data.to,
          sellerName: data.payload['sellerName'],
          listingTitle: data.payload['listingTitle'],
          listingId: data.payload['listingId'],
        });
        break;
      case 'listing_status':
        await this.email.sendListingStatusEmail({
          sellerEmail: data.to,
          sellerName: data.payload['sellerName'],
          listingTitle: data.payload['listingTitle'],
          listingId: data.payload['listingId'],
          status: data.payload['status'],
          reason: data.payload['reason'],
        });
        break;
      case 'trust_lens_result':        await this.email.sendTrustLensResultEmail({
          sellerEmail: data.to,
          sellerName: data.payload['sellerName'],
          listingTitle: data.payload['listingTitle'],
          listingId: data.payload['listingId'],
          passed: data.payload['passed'],
          conditionGrade: data.payload['conditionGrade'],
          notes: data.payload['notes'],
        });
        break;
      case 'raw':
        await this.email.sendRaw({
          to: data.to,
          subject: data.payload['subject'],
          html: data.payload['html'],
          replyTo: data.payload['replyTo'],
        });
        break;
      default:
        this.logger.warn(`Unknown email type: ${data.type}`);
    }
  }

  // Contact Us — fires email to veribuy.shop@gmail.com + acknowledgement to sender
  async contactUs(data: {
    fromName: string;
    fromEmail: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.email.sendContactUsEmail(data);
  }
}
