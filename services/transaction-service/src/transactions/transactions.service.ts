import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import Stripe from 'stripe';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { InvoicesService, InvoiceOrderData } from '../invoices/invoices.service';

/**
 * Allowed status transitions for each actor.
 *
 * Key: current status → Value: statuses any actor may move to.
 * Buyer:  DELIVERED → COMPLETED, any → DISPUTED
 * Seller: ESCROW_HELD → SHIPPED
 * Admin:  any → any (enforced in controller, not here)
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:          ['CANCELLED'],
  PAYMENT_RECEIVED: ['ESCROW_HELD', 'CANCELLED'],
  ESCROW_HELD:      ['SHIPPED', 'DISPUTED', 'CANCELLED'],
  SHIPPED:          ['DELIVERED', 'DISPUTED'],
  DELIVERED:        ['COMPLETED', 'DISPUTED'],
  COMPLETED:        [],
  DISPUTED:         ['REFUNDED', 'COMPLETED'],
  REFUNDED:         [],
  CANCELLED:        [],
};

@Injectable()
export class TransactionsService implements OnModuleInit {
  private readonly logger = new Logger(TransactionsService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  /**
   * Fail fast if required secrets are missing — prevents silent failures in production.
   */
  onModuleInit() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    if (!process.env.INTERNAL_SERVICE_TOKEN) {
      throw new Error('INTERNAL_SERVICE_TOKEN environment variable is required');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
    });
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const { buyerId, sellerId, listingId, amount, currency = 'GBP', shippingAddress } =
      createOrderDto;

    // Snapshot listing details for invoice generation — fire-and-forget on failure
    let listingTitle: string | null = null;
    let listingDescription: string | null = null;
    let listingCategory: string | null = null;
    try {
      const listing = await this.fetchListing(listingId);
      listingTitle = listing?.title ?? null;
      listingDescription = listing?.description ?? null;
      listingCategory = listing?.deviceType ?? listing?.brand ?? null;
    } catch (err) {
      this.logger.warn(`Could not snapshot listing ${listingId}: ${(err as Error).message}`);
    }

    // Create Stripe Payment Intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: { buyerId, sellerId, listingId },
      payment_method_types: ['card'],
    });

    // Create order in database — store paymentIntentId immediately
    const order = await this.prisma.order.create({
      data: {
        buyerId,
        sellerId,
        listingId,
        listingTitle,
        listingDescription,
        listingCategory,
        amount,
        currency,
        status: 'PENDING',
        paymentIntentId: paymentIntent.id,
        shippingAddress: shippingAddress as any,
      },
    });

    return {
      order,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  async confirmPayment(orderId: string, paymentIntentId: string) {
    // Retrieve payment intent from Stripe for server-side verification
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Payment not completed');
    }

    // Idempotency guard: if the order is already in ESCROW_HELD or PAYMENT_RECEIVED
    // return the existing state without creating duplicates.
    const existingOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    // Verify the paymentIntentId matches what was stored at order creation
    if (existingOrder.paymentIntentId && existingOrder.paymentIntentId !== paymentIntentId) {
      throw new BadRequestException('Payment intent ID does not match this order');
    }

    if (
      existingOrder.status === 'ESCROW_HELD' ||
      existingOrder.status === 'PAYMENT_RECEIVED'
    ) {
      const existingEscrow = existingOrder.escrowId
        ? await this.prisma.escrowRecord.findUnique({ where: { id: existingOrder.escrowId } })
        : await this.prisma.escrowRecord.findFirst({ where: { orderId } });
      return { order: existingOrder, escrow: existingEscrow };
    }

    // Wrap the 3-step write in a transaction
    const { updatedOrder, escrow } = await this.prisma.$transaction(async (tx) => {
      // Update order to PAYMENT_RECEIVED with paidAt timestamp
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAYMENT_RECEIVED',
          paidAt: new Date(),
          paymentIntentId,
        },
      });

      // Create escrow record
      const escrow = await tx.escrowRecord.create({
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          status: 'HELD',
          providerRef: paymentIntentId,
          heldAt: new Date(),
        },
      });

      // Advance to ESCROW_HELD and link escrow
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          escrowId: escrow.id,
          status: 'ESCROW_HELD',
        },
      });

      return { updatedOrder, escrow };
    });

    // Mark listing as SOLD — fire-and-forget, must not block order flow
    this.updateListingStatus(updatedOrder.listingId, 'SOLD').catch((error) => {
      this.logger.error('Failed to update listing status to SOLD', error?.stack ?? error);
    });

    // Send notifications — fire-and-forget, must not block order flow
    this.sendOrderNotification({
      orderId: updatedOrder.id,
      buyerId: updatedOrder.buyerId,
      sellerId: updatedOrder.sellerId,
      recipientId: updatedOrder.buyerId,
      subject: 'Payment secured in escrow',
      content: `Your payment of ${updatedOrder.currency} ${updatedOrder.amount} has been secured in escrow for order #${updatedOrder.id.substring(0, 8)}. The seller will now prepare your item for shipment.`,
    }).catch((err) => {
      this.logger.error('Failed to send buyer escrow notification', err?.stack ?? err);
    });

    this.sendOrderNotification({
      orderId: updatedOrder.id,
      buyerId: updatedOrder.buyerId,
      sellerId: updatedOrder.sellerId,
      recipientId: updatedOrder.sellerId,
      subject: 'New order — payment received',
      content: `You have a new order (#${updatedOrder.id.substring(0, 8)}) with payment of ${updatedOrder.currency} ${updatedOrder.amount} secured in escrow. Please prepare the item and mark it as shipped once dispatched.`,
    }).catch((err) => {
      this.logger.error('Failed to send seller escrow notification', err?.stack ?? err);
    });

    // Generate invoice — fire-and-forget
    this.generateInvoiceForOrder(updatedOrder).catch((err) => {
      this.logger.error('Failed to generate invoice for confirmed payment', err?.stack ?? err);
    });

    return { order: updatedOrder, escrow };
  }

  async updateOrderStatus(
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    actorRole: string = 'BUYER',
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Enforce state machine — admins bypass
    if (actorRole !== 'ADMIN') {
      const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(updateOrderStatusDto.status)) {
        throw new BadRequestException(
          `Cannot transition order from ${order.status} to ${updateOrderStatusDto.status}`,
        );
      }
    }

    const updateData: any = {
      status: updateOrderStatusDto.status,
    };

    // Persist tracking number when moving to SHIPPED
    if (updateOrderStatusDto.status === 'SHIPPED') {
      updateData.shippedAt = new Date();
      if (updateOrderStatusDto.trackingNumber) {
        updateData.trackingNumber = updateOrderStatusDto.trackingNumber;
      }
    } else if (updateOrderStatusDto.status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (updateOrderStatusDto.status === 'COMPLETED') {
      updateData.completedAt = new Date();

      // Release escrow when order is completed
      if (order.escrowId) {
        await this.prisma.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }
    } else if (updateOrderStatusDto.status === 'DISPUTED') {
      updateData.disputedAt = new Date();

      if (order.escrowId) {
        await this.prisma.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'DISPUTED' },
        });
      }
    } else if (updateOrderStatusDto.status === 'REFUNDED') {
      updateData.refundedAt = new Date();

      if (order.escrowId) {
        await this.prisma.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Send notifications — fire-and-forget
    this.sendStatusChangeNotification(updatedOrder, order.status).catch((err) => {
      this.logger.error('Failed to send status change notification', err?.stack ?? err);
    });

    // Generate invoice for this status — fire-and-forget
    this.generateInvoiceForOrder(updatedOrder).catch((err) => {
      this.logger.error('Failed to generate invoice for status change', err?.stack ?? err);
    });

    return updatedOrder;
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOrderByPaymentIntentId(paymentIntentId: string) {
    const order = await this.prisma.order.findFirst({
      where: { paymentIntentId },
    });

    if (!order) {
      throw new NotFoundException('Order not found for payment intent');
    }

    return order;
  }

  async getAllOrders(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.order.count(),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrdersByBuyer(
    buyerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { buyerId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrdersBySeller(
    sellerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { sellerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { sellerId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async refundOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Double-refund guard
    if (order.status === 'REFUNDED') {
      throw new BadRequestException('Order has already been refunded');
    }

    if (!order.escrowId) {
      throw new BadRequestException('No escrow record found for this order');
    }

    const escrow = await this.prisma.escrowRecord.findUnique({ where: { id: order.escrowId } });

    if (!escrow?.providerRef) {
      throw new BadRequestException('No payment provider reference found');
    }

    // Refund via Stripe
    const refund = await this.stripe.refunds.create({ payment_intent: escrow.providerRef });

    // Wrap the DB writes in a transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.escrowRecord.update({
        where: { id: order.escrowId! },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });

      return tx.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
    });

    // Restore listing to ACTIVE — fire-and-forget
    this.updateListingStatus(order.listingId, 'ACTIVE').catch((error) => {
      this.logger.error('Failed to restore listing status to ACTIVE', error?.stack ?? error);
    });

    // Notify buyer of refund — fire-and-forget
    this.sendOrderNotification({
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      recipientId: order.buyerId,
      subject: 'Refund processed for your order',
      content: `Your refund of ${order.currency} ${order.amount} for order #${order.id.substring(0, 8)} has been processed. The amount will be returned to your original payment method within 5-10 business days.`,
    }).catch((err) => {
      this.logger.error('Failed to send refund notification', err?.stack ?? err);
    });

    return { order: updatedOrder, refund };
  }

  /**
   * Send an order-related notification via the notification service.
   * Always call as fire-and-forget (.catch(...)) — must not block order flow.
   */
  private async sendOrderNotification(params: {
    orderId: string;
    buyerId: string;
    sellerId: string;
    recipientId: string;
    subject: string;
    content: string;
  }): Promise<void> {
    const NOTIFICATION_SERVICE_URL =
      process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008';

    const systemSenderId =
      params.recipientId === params.buyerId ? params.sellerId : params.buyerId;

    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/notifications/messages/internal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN!,
        },
        body: JSON.stringify({
          senderId: systemSenderId,
          recipientId: params.recipientId,
          subject: params.subject,
          content: params.content,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Notification service error: ${response.status} ${err}`);
    }
  }

  /**
   * Send status-change notifications for key order transitions.
   * Always call as fire-and-forget (.catch(...)) — must not block order flow.
   */
  private async sendStatusChangeNotification(
    order: any,
    previousStatus: string,
  ): Promise<void> {
    const shortId = order.id.substring(0, 8);

    switch (order.status) {
      case 'SHIPPED':
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.buyerId,
          subject: 'Your order has been shipped',
          content: `Order #${shortId} has been dispatched by the seller.${
            order.trackingNumber ? ` Tracking number: ${order.trackingNumber}` : ''
          } Please confirm delivery once you receive the item.`,
        });
        break;

      case 'DELIVERED':
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.buyerId,
          subject: 'Your order has been delivered',
          content: `Order #${shortId} has been marked as delivered. Please confirm receipt to release payment to the seller.`,
        });
        break;

      case 'COMPLETED':
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.sellerId,
          subject: 'Order completed — escrow released',
          content: `Order #${shortId} has been completed. The escrow of ${order.currency} ${order.amount} has been released. Thank you for selling on VeriBuy!`,
        });
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.buyerId,
          subject: 'Order completed',
          content: `Order #${shortId} has been completed. Thank you for your purchase on VeriBuy!`,
        });
        break;

      case 'REFUNDED':
        // Notification handled separately in refundOrder()
        break;

      default:
        break;
    }
  }

  /**
   * Update listing status in listing service (internal service-to-service call).
   * Always call as fire-and-forget (.catch(...)) — must not block order flow.
   */
  private async updateListingStatus(listingId: string, status: string): Promise<void> {
    const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${listingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN!,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new HttpException(
        error.message || 'Failed to update listing status',
        response.status,
      );
    }
  }

  /**
   * Fetch a listing from listing-service (internal call).
   * Returns null on failure — callers should handle gracefully.
   */
  private async fetchListing(listingId: string): Promise<Record<string, any> | null> {
    const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${listingId}`, {
      headers: { 'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN! },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;
    return response.json() as Promise<Record<string, any>>;
  }

  /**
   * Fetch buyer email from auth-service (internal call).
   * Returns null on failure.
   */
  private async getBuyerEmail(buyerId: string): Promise<string | null> {
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${AUTH_SERVICE_URL}/auth/internal/users/${buyerId}`, {
        headers: { 'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN! },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return null;
      const data = await response.json() as Record<string, any>;
      return (data.email as string) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Orchestrate invoice generation for an order.
   * Always call fire-and-forget — must not block order flow.
   */
  private async generateInvoiceForOrder(order: any): Promise<void> {
    const buyerEmail = await this.getBuyerEmail(order.buyerId);
    if (!buyerEmail) {
      this.logger.warn(`Could not fetch buyer email for order ${order.id} — skipping invoice`);
      return;
    }

    const invoiceData: InvoiceOrderData = {
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      listingId: order.listingId,
      listingTitle: order.listingTitle ?? null,
      listingDescription: order.listingDescription ?? null,
      listingCategory: order.listingCategory ?? null,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      shippingAddress: order.shippingAddress ?? null,
      paidAt: order.paidAt ?? null,
      shippedAt: order.shippedAt ?? null,
      deliveredAt: order.deliveredAt ?? null,
      completedAt: order.completedAt ?? null,
      disputedAt: order.disputedAt ?? null,
      refundedAt: order.refundedAt ?? null,
      createdAt: order.createdAt,
    };

    await this.invoicesService.generateAndSendInvoice(invoiceData, buyerEmail);
  }
}
