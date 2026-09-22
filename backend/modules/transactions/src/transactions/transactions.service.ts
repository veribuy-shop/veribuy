import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { RateOrderDto } from './dto/rate-order.dto';
import Stripe from 'stripe';
import { PaginationDto, PaginatedResponse, getInternalApiUrl, RoyalMailServiceTier } from '@veribuy/common';
import { InvoicesService, InvoiceOrderData } from '../invoices/invoices.service';
import { RoyalMailService } from '../shipping/royal-mail.service';

/**
 * The party performing a status transition, resolved per-order.
 *
 * NOTE: this is deliberately NOT the user's global role. A user may be the
 * buyer on one order and the seller on another, so the acting party must be
 * derived from their relationship to the specific order.
 */
export type OrderActor = 'BUYER' | 'SELLER' | 'ADMIN' | 'INTERNAL';

/**
 * Allowed status transitions, keyed by current status → target status →
 * the set of actors permitted to perform it.
 *
 * Security rationale for the sensitive entries:
 *  - ESCROW_HELD → SHIPPED is SELLER-only: a buyer must never be able to mark
 *    an order dispatched, which would start the delivery/auto-release clock.
 *  - SHIPPED → DELIVERED excludes the SELLER: a seller must never be able to
 *    self-certify delivery and trigger release of escrowed funds.
 *  - DELIVERED → COMPLETED is BUYER-driven (plus ADMIN/INTERNAL for the
 *    auto-release timer), since it releases funds to the seller.
 *  - Anything touching money after escrow (CANCELLED post-payment, REFUNDED,
 *    dispute resolution) is restricted to ADMIN/INTERNAL.
 */
const ALLOWED_TRANSITIONS: Record<string, Record<string, OrderActor[]>> = {
  PENDING: {
    CANCELLED: ['BUYER', 'SELLER', 'ADMIN', 'INTERNAL'],
  },
  PAYMENT_RECEIVED: {
    // Driven by the Stripe webhook, never by an end user.
    ESCROW_HELD: ['ADMIN', 'INTERNAL'],
    CANCELLED: ['ADMIN', 'INTERNAL'],
  },
  ESCROW_HELD: {
    SHIPPED: ['SELLER', 'ADMIN', 'INTERNAL'],
    DISPUTED: ['BUYER', 'SELLER', 'ADMIN', 'INTERNAL'],
    CANCELLED: ['ADMIN', 'INTERNAL'],
  },
  SHIPPED: {
    DELIVERED: ['BUYER', 'ADMIN', 'INTERNAL'],
    DISPUTED: ['BUYER', 'SELLER', 'ADMIN', 'INTERNAL'],
  },
  DELIVERED: {
    COMPLETED: ['BUYER', 'ADMIN', 'INTERNAL'],
    DISPUTED: ['BUYER', 'SELLER', 'ADMIN', 'INTERNAL'],
  },
  COMPLETED: {},
  DISPUTED: {
    // Dispute outcomes are decided by the platform, not the counterparties.
    REFUNDED: ['ADMIN', 'INTERNAL'],
    COMPLETED: ['ADMIN', 'INTERNAL'],
  },
  REFUNDED: {},
  CANCELLED: {},
};


/**
 * Client-safe Order projection.
 *
 * Deliberately omits internal payment/escrow identifiers (`paymentIntentId`,
 * `escrowId`) so they can never be returned on a read endpoint. Flows that
 * genuinely need those values query for them explicitly.
 */
const ORDER_CLIENT_SELECT = {
  id: true,
  buyerId: true,
  sellerId: true,
  listingId: true,
  listingTitle: true,
  listingDescription: true,
  listingCategory: true,
  amount: true,
  protectionFee: true,
  shippingFee: true,
  shippingService: true,
  freeShipping: true,
  totalAmount: true,
  currency: true,
  status: true,
  trackingNumber: true,
  parcelWeightGrams: true,
  parcelFormat: true,
  shippingLabelUrl: true,
  dropoffQrCodeUrl: true,
  dropoffPointId: true,
  dropoffPointName: true,
  shippingAddress: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
  disputedAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function getBuyerProtectionFeeRate(): number {
  const raw = process.env.BUYER_PROTECTION_FEE_PERCENT || process.env.BUYER_PROTECTION_FEE_RATE;
  if (!raw) return 0.05;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0) return 0.05;
  return parsed >= 1 ? parsed / 100 : parsed;
}

@Injectable()
export class TransactionsService implements OnModuleInit {
  private readonly logger = new Logger(TransactionsService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
    private royalMailService: RoyalMailService,
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

    // Run initial and recurring background cleanup for expired pending orders (30 min timeout)
    this.cleanupExpiredPendingOrders().catch(() => {});
    setInterval(() => {
      this.cleanupExpiredPendingOrders().catch((err) => {
        this.logger.warn(`Cleanup expired pending orders error: ${err.message}`);
      });
    }, 5 * 60 * 1000);
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      buyerId,
      sellerId,
      listingId,
      amount,
      shippingService = null,
      currency = 'GBP',
      shippingAddress,
    } = createOrderDto;

    // DI-06: Prevent self-dealing — buyer and seller must be different users
    if (buyerId === sellerId) {
      throw new BadRequestException('Buyer and seller cannot be the same user');
    }

    // SECURITY: The listing is the single source of truth for price, shipping
    // eligibility and parcel sizing. The client-supplied `amount` / `shippingFee`
    // are treated as untrusted display hints only and are never used to charge.
    // A failure to resolve the listing MUST abort the order — falling back to
    // client-supplied values would allow payment amount tampering.
    let listing: Record<string, any> | null;
    try {
      listing = await this.fetchListing(listingId);
    } catch (err: any) {
      this.logger.error(`Could not resolve listing ${listingId}: ${(err as Error).message}`);
      throw new BadRequestException('Unable to verify listing details. Please try again.');
    }

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status === 'SOLD' || listing.status === 'DELISTED') {
      throw new BadRequestException('This listing is no longer available for purchase');
    }
    // Ensure the client cannot redirect funds by supplying a mismatched sellerId
    if (listing.sellerId && listing.sellerId !== sellerId) {
      throw new BadRequestException('Seller does not match the listing owner');
    }

    const isFreeShipping = !!listing.freeShipping;
    const listingTitle: string | null = listing.title ?? null;
    const listingDescription: string | null = listing.description ?? null;
    const listingCategory: string | null = listing.deviceType ?? listing.brand ?? null;

    // Automated weight mapping & packaging sizing
    const profile = this.royalMailService.resolvePackageProfile(
      listing.deviceType || listingCategory || 'SMARTPHONE',
      listing.brand,
      listing.model,
      listing.quantity || 1,
    );
    const parcelWeightGrams: number = profile.totalWeightGrams;
    const parcelFormat: string = profile.parcelFormat;

    // Authoritative item price — derived from the listing, never from the client.
    const numericAmount = this.resolveListingPrice(listing);
    if (numericAmount <= 0) {
      throw new BadRequestException('This listing does not have a valid price');
    }
    if (amount !== undefined && !this.amountsMatch(Number(amount), numericAmount)) {
      this.logger.warn(
        `Rejected order: client amount ${amount} does not match listing ${listingId} price ${numericAmount}`,
      );
      throw new BadRequestException(
        'The listing price has changed. Please refresh and try again.',
      );
    }

    // Authoritative shipping fee — recomputed server-side from the resolved
    // device weight profile and the buyer's destination postcode.
    const numericShipping = this.resolveShippingFee(listing, {
      serviceTier: shippingService,
      destinationPostcode: shippingAddress?.postal_code,
      itemValue: numericAmount,
      isFreeShipping,
    });

    // Buyer Protection Fee (configurable via env variable, default 5%)
    const rate = getBuyerProtectionFeeRate();
    const protectionFee = Math.round(numericAmount * rate * 100) / 100;

    // Compute total: item price + buyer protection fee + shipping (waived/0 if covered by seller)
    const totalAmount = Math.round((numericAmount + protectionFee + numericShipping) * 100) / 100;

    // Check if an existing PENDING order already exists for this buyer and listing
    const existingPendingOrder = await this.prisma.order.findFirst({
      where: {
        buyerId,
        listingId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPendingOrder && existingPendingOrder.paymentIntentId) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(
          existingPendingOrder.paymentIntentId,
        );

        if (paymentIntent && paymentIntent.status === 'requires_payment_method') {
          await this.stripe.paymentIntents.update(existingPendingOrder.paymentIntentId, {
            amount: Math.round(totalAmount * 100),
            currency: currency.toLowerCase(),
          });

          const updatedOrder = await this.prisma.order.update({
            where: { id: existingPendingOrder.id },
            data: {
              listingTitle: listingTitle ?? existingPendingOrder.listingTitle,
              listingDescription: listingDescription ?? existingPendingOrder.listingDescription,
              listingCategory: listingCategory ?? existingPendingOrder.listingCategory,
              parcelWeightGrams,
              parcelFormat,
              amount: numericAmount,
              protectionFee,
              shippingFee: numericShipping > 0 ? numericShipping : null,
              shippingService: isFreeShipping ? (shippingService || 'Free Delivery (Covered by Seller)') : shippingService,
              freeShipping: isFreeShipping,
              totalAmount,
              currency,
              shippingAddress: shippingAddress as any,
            },
          });

          return {
            order: updatedOrder,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          };
        }
      } catch (stripeErr) {
        this.logger.warn(`Could not reuse existing PaymentIntent: ${(stripeErr as Error).message}`);
      }
    }

    // Create Stripe Payment Intent — charge the total (item + protection fee + shipping)
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
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
        parcelWeightGrams,
        parcelFormat,
        amount: numericAmount,
        protectionFee,
        shippingFee: numericShipping > 0 ? numericShipping : null,
        shippingService: isFreeShipping ? (shippingService || 'Free Delivery (Covered by Seller)') : shippingService,
        freeShipping: isFreeShipping,
        totalAmount,
        currency,
        status: 'PENDING',
        paymentIntentId: paymentIntent.id,
        shippingAddress: shippingAddress as any,
      },
    });

    // Temporarily reserve listing during checkout
    this.updateListingStatus(listingId, 'INACTIVE').catch(() => {});

    return {
      order,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Update shipping details on a PENDING order before payment.
   *
   * Updates the order's shippingFee, shippingService, and totalAmount in the DB
   * and updates the Stripe PaymentIntent amount to match. This allows the buyer
   * to change shipping service / enter their postcode after order creation but
   * before confirming payment.
   */
  async updateShipping(orderId: string, buyerId: string, dto: UpdateShippingDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== buyerId) {
      throw new BadRequestException('You can only update shipping on your own orders');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Shipping can only be updated on pending orders');
    }
    if (!order.paymentIntentId) {
      throw new BadRequestException('Order has no associated payment intent');
    }

    const rate = getBuyerProtectionFeeRate();
    const protectionFee = Number(
      order.protectionFee ?? Math.round(Number(order.amount) * rate * 100) / 100,
    );

    // SECURITY: Recompute the shipping fee server-side. The client may only
    // choose a service tier and supply a destination postcode — never a price.
    const listing = await this.fetchListing(order.listingId).catch(() => null);
    if (!listing) {
      throw new BadRequestException('Unable to verify listing details. Please try again.');
    }

    const shippingAddress = order.shippingAddress as Record<string, any> | null;
    const effectiveShippingFee = this.resolveShippingFee(listing, {
      serviceTier: dto.shippingService,
      destinationPostcode: shippingAddress?.postal_code,
      itemValue: Number(order.amount),
      isFreeShipping: !!order.freeShipping,
    });

    const newTotal = Math.round((Number(order.amount) + protectionFee + effectiveShippingFee) * 100) / 100;

    // Update Stripe PaymentIntent amount
    await this.stripe.paymentIntents.update(order.paymentIntentId, {
      amount: Math.round(newTotal * 100),
    });

    // Update order in database
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shippingFee: effectiveShippingFee > 0 ? effectiveShippingFee : null,
        shippingService: dto.shippingService,
        totalAmount: newTotal,
      },
    });

    return updated;
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

      // Create escrow record — escrow the full totalAmount (item + shipping)
      const escrow = await tx.escrowRecord.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount ?? order.amount,
          currency: order.currency,
          status: 'HELD',
          providerRef: paymentIntentId,
          heldAt: new Date(),
        },
      });

      // Generate tracking number and drop-off metadata if missing
      const trackingNumber =
        order.trackingNumber ||
        this.royalMailService.generateTrackingNumber(order.shippingService || 'TRACKED_48');
      const dropoffQrCodeUrl =
        order.dropoffQrCodeUrl ||
        this.royalMailService.generateDropoffQrCode(order.id, trackingNumber);
      const shippingLabelUrl = `/api/orders/${order.id}/shipping-label`;

      // Advance to ESCROW_HELD and link escrow
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          escrowId: escrow.id,
          status: 'ESCROW_HELD',
          trackingNumber,
          dropoffQrCodeUrl,
          shippingLabelUrl,
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
      content: `Your payment of ${updatedOrder.currency} ${updatedOrder.totalAmount ?? updatedOrder.amount} has been secured in escrow for order #${updatedOrder.id.substring(0, 8)}. The seller will now prepare your item for shipment.`,
    }).catch((err) => {
      this.logger.error('Failed to send buyer escrow notification', err?.stack ?? err);
    });

    this.sendOrderNotification({
      orderId: updatedOrder.id,
      buyerId: updatedOrder.buyerId,
      sellerId: updatedOrder.sellerId,
      recipientId: updatedOrder.sellerId,
      subject: 'New order — payment received',
      content: `You have a new order (#${updatedOrder.id.substring(0, 8)}) with payment of ${updatedOrder.currency} ${updatedOrder.totalAmount ?? updatedOrder.amount} secured in escrow. Please prepare the item and mark it as shipped once dispatched.`,
    }).catch((err) => {
      this.logger.error('Failed to send seller escrow notification', err?.stack ?? err);
    });

    // Send emails to buyer (order receipt) and seller (sale made + dispatch next steps)
    this.sendOrderConfirmationEmails(updatedOrder).catch((err) => {
      this.logger.error('Failed to send order confirmation emails to buyer and seller', err?.stack ?? err);
    });

    // Generate invoice — fire-and-forget
    this.generateInvoiceForOrder(updatedOrder).catch((err) => {
      this.logger.error('Failed to generate invoice for confirmed payment', err?.stack ?? err);
    });

    return { order: updatedOrder, escrow };
  }

  /**
   * Resolves the acting party for an order from the caller's identity.
   *
   * SECURITY: ADMIN/INTERNAL are privileged and taken from the authenticated
   * context. For everyone else the actor is derived from their relationship to
   * this specific order — a user's global role is never trusted here, since a
   * SELLER-role account is merely the buyer on orders it did not list.
   */
  private resolveOrderActor(
    order: { buyerId: string; sellerId: string },
    callerRole: string,
    callerUserId?: string,
  ): OrderActor {
    if (callerRole === 'INTERNAL') return 'INTERNAL';
    if (callerRole === 'ADMIN') return 'ADMIN';

    if (callerUserId && order.sellerId === callerUserId) return 'SELLER';
    if (callerUserId && order.buyerId === callerUserId) return 'BUYER';

    throw new ForbiddenException('You are not a party to this order');
  }

  async updateOrderStatus(
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    actorRole: string = 'BUYER',
    actorUserId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const actor = this.resolveOrderActor(order, actorRole, actorUserId);

    // Enforce the state machine for all callers — even internal/admin are
    // restricted to defined transitions to prevent invalid state jumps.
    const transitions = ALLOWED_TRANSITIONS[order.status] ?? {};
    const permittedActors = transitions[updateOrderStatusDto.status];

    if (!permittedActors) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${updateOrderStatusDto.status}`,
      );
    }

    // Enforce per-actor authorisation (e.g. only the seller may mark SHIPPED,
    // and the seller may never self-certify DELIVERED).
    if (!permittedActors.includes(actor)) {
      this.logger.warn(
        `Blocked ${actor} from transitioning order ${orderId} ${order.status} → ${updateOrderStatusDto.status}`,
      );
      throw new ForbiddenException(
        `You are not permitted to change this order from ${order.status} to ${updateOrderStatusDto.status}`,
      );
    }

    const updateData: any = { status: updateOrderStatusDto.status };
    const now = new Date();

    if (updateOrderStatusDto.status === 'SHIPPED') {
      updateData.shippedAt = now;
      if (updateOrderStatusDto.trackingNumber) {
        updateData.trackingNumber = updateOrderStatusDto.trackingNumber;
      }
    } else if (updateOrderStatusDto.status === 'DELIVERED') {
      updateData.deliveredAt = now;
    } else if (updateOrderStatusDto.status === 'COMPLETED') {
      updateData.completedAt = now;
    } else if (updateOrderStatusDto.status === 'DISPUTED') {
      updateData.disputedAt = now;
    } else if (updateOrderStatusDto.status === 'REFUNDED') {
      updateData.refundedAt = now;
    }

    // DI-04: Wrap escrow update + order update in a single transaction so a
    // mid-flight crash cannot leave them in inconsistent states.
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      if (updateOrderStatusDto.status === 'COMPLETED' && order.escrowId) {
        await tx.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'RELEASED', releasedAt: now },
        });
      } else if (updateOrderStatusDto.status === 'DISPUTED' && order.escrowId) {
        await tx.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'DISPUTED' },
        });
      } else if (updateOrderStatusDto.status === 'REFUNDED' && order.escrowId) {
        await tx.escrowRecord.update({
          where: { id: order.escrowId },
          data: { status: 'REFUNDED', refundedAt: now },
        });
      }

      return tx.order.update({ where: { id: orderId }, data: updateData });
    });

    // Send notifications — fire-and-forget
    this.sendStatusChangeNotification(updatedOrder, order.status).catch((err) => {
      this.logger.error('Failed to send status change notification', err?.stack ?? err);
    });

    // INV-04: Only generate invoices on financially significant transitions.
    // ESCROW_HELD = sales receipt; REFUNDED = credit note.
    if (
      updatedOrder.status === 'ESCROW_HELD' ||
      updatedOrder.status === 'REFUNDED'
    ) {
      this.generateInvoiceForOrder(updatedOrder).catch((err) => {
        this.logger.error('Failed to generate invoice for status change', err?.stack ?? err);
      });
    }

    // If order was cancelled, restore listing status back to ACTIVE
    if (updateOrderStatusDto.status === 'CANCELLED' && order.listingId) {
      this.updateListingStatus(order.listingId, 'ACTIVE').catch((error) => {
        this.logger.error('Failed to restore listing status to ACTIVE on cancel', error?.stack ?? error);
      });
    }

    return updatedOrder;
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: ORDER_CLIENT_SELECT,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Delete an unpaid PENDING or CANCELLED order record and restore listing back to ACTIVE.
   */
  async deletePendingOrder(orderId: string, userId: string, userRole: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (userRole !== 'ADMIN' && order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You can only delete orders you are involved in');
    }

    if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
      throw new BadRequestException(`Only PENDING or CANCELLED orders can be deleted. Current status: ${order.status}`);
    }

    if (order.paymentIntentId) {
      try {
        await this.stripe.paymentIntents.cancel(order.paymentIntentId);
      } catch (err) {
        this.logger.warn(`Could not cancel Stripe payment intent: ${(err as Error).message}`);
      }
    }

    await this.prisma.order.delete({
      where: { id: orderId },
    });

    if (order.listingId) {
      this.updateListingStatus(order.listingId, 'ACTIVE').catch((error) => {
        this.logger.error('Failed to restore listing status to ACTIVE on delete', error?.stack ?? error);
      });
    }

    return { success: true, message: 'Pending order deleted and listing restored to active queue' };
  }

  /**
   * Automatically cancel unpaid PENDING checkout orders older than 30 minutes
   * and restore listings back to ACTIVE status.
   */
  async cleanupExpiredPendingOrders() {
    const expiryThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: expiryThreshold },
      },
    });

    for (const order of staleOrders) {
      try {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });

        if (order.listingId) {
          await this.updateListingStatus(order.listingId, 'ACTIVE').catch(() => {});
        }
      } catch (err) {
        this.logger.warn(`Failed to expire pending order ${order.id}: ${(err as Error).message}`);
      }
    }
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

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' }, select: ORDER_CLIENT_SELECT }),
      this.prisma.order.count(),
    ]);

    const buyerIds = [...new Set(orders.map((o) => o.buyerId).filter(Boolean))];
    const sellerIds = [...new Set(orders.map((o) => o.sellerId).filter(Boolean))];
    const allUserIds = [...new Set([...buyerIds, ...sellerIds])];
    const listingIds = [...new Set(orders.map((o) => o.listingId).filter(Boolean))];

    const [profiles, users, listings] = await Promise.all([
      this.prisma.profile.findMany({
        where: { userId: { in: allUserIds } },
        select: { userId: true, displayName: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, email: true },
      }),
      this.prisma.listing.findMany({
        where: { id: { in: listingIds } },
        select: { id: true, title: true, brand: true, model: true },
      }),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    const enriched = orders.map((order) => {
      const buyerProfile = profileMap.get(order.buyerId);
      const buyerUser = userMap.get(order.buyerId);
      const buyerName =
        buyerProfile?.displayName ||
        (buyerProfile?.firstName ? `${buyerProfile.firstName} ${buyerProfile.lastName || ''}`.trim() : null) ||
        (buyerUser?.email ? buyerUser.email.split('@')[0] : null) ||
        'Buyer';

      const sellerProfile = profileMap.get(order.sellerId);
      const sellerUser = userMap.get(order.sellerId);
      const sellerName =
        sellerProfile?.displayName ||
        (sellerProfile?.firstName ? `${sellerProfile.firstName} ${sellerProfile.lastName || ''}`.trim() : null) ||
        (sellerUser?.email ? sellerUser.email.split('@')[0] : null) ||
        'Seller';

      const listing = listingMap.get(order.listingId);

      return {
        ...order,
        buyer: {
          id: order.buyerId,
          displayName: buyerName,
          email: buyerUser?.email || null,
        },
        seller: {
          id: order.sellerId,
          displayName: sellerName,
          email: sellerUser?.email || null,
        },
        listing: listing || {
          id: order.listingId,
          title: order.listingTitle || 'Verified Device',
          brand: '',
          model: '',
          imageUrls: [],
        },
      };
    });

    return {
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrdersByBuyer(
    buyerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Proactively clean up any expired pending orders older than 30 mins
    this.cleanupExpiredPendingOrders().catch(() => {});

    const expiryThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const where = {
      buyerId,
      status: { notIn: ['CANCELLED'] as any },
      NOT: {
        status: 'PENDING' as any,
        createdAt: { lt: expiryThreshold },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: ORDER_CLIENT_SELECT,
      }),
      this.prisma.order.count({ where }),
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

    const where = {
      sellerId,
      status: { notIn: ['PENDING', 'CANCELLED'] as any },
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: ORDER_CLIENT_SELECT,
      }),
      this.prisma.order.count({ where }),
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

    // REG-02: Wrap all DB writes in a transaction and persist the Stripe refund
    // record alongside the order/escrow updates so the audit trail is atomic.
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.escrowRecord.update({
        where: { id: order.escrowId! },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });

      // Persist the Stripe refund ID — never lose this
      await (tx as any).refundRecord.create({
        data: {
          orderId: order.id,
          stripeRefundId: refund.id,
          amount: order.totalAmount ?? order.amount,
          currency: order.currency,
          reason: refund.reason ?? null,
          status: refund.status ?? 'pending',
        },
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
      content: `Your refund of ${order.currency} ${order.totalAmount ?? order.amount} for order #${order.id.substring(0, 8)} has been processed. The amount will be returned to your original payment method within 5-10 business days.`,
    }).catch((err) => {
      this.logger.error('Failed to send refund notification', err?.stack ?? err);
    });

    // Generate credit note invoice — fire-and-forget
    this.generateInvoiceForOrder(updatedOrder).catch((err) => {
      this.logger.error('Failed to generate credit note invoice for refund', err?.stack ?? err);
    });

    return { order: updatedOrder, refund };
  }

  /**
   * Send an outbound email notification via the notification service.
   * Always call as fire-and-forget (.catch(...)) — must not block order flow.
   */
  private async sendEmail(params: {
    type: string;
    to: string;
    payload: Record<string, any>;
  }): Promise<void> {
    const NOTIFICATION_SERVICE_URL = getInternalApiUrl();

    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/notifications/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN!,
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Notification send-email error: ${response.status} ${err}`);
    }
  }

  /**
   * Send order confirmation & receipt emails to buyer and sale & next steps email to seller.
   */
  private async sendOrderConfirmationEmails(order: any): Promise<void> {
    const [buyerUser, buyerProfile, sellerUser, sellerProfile, listing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: order.buyerId }, select: { email: true, name: true } }),
      this.prisma.profile.findUnique({ where: { userId: order.buyerId }, select: { displayName: true, firstName: true, lastName: true } }),
      this.prisma.user.findUnique({ where: { id: order.sellerId }, select: { email: true, name: true } }),
      this.prisma.profile.findUnique({ where: { userId: order.sellerId }, select: { displayName: true, firstName: true, lastName: true } }),
      this.prisma.listing.findUnique({ where: { id: order.listingId }, select: { title: true, brand: true, model: true } }),
    ]);

    const buyerName =
      buyerProfile?.displayName ||
      (buyerProfile?.firstName ? `${buyerProfile.firstName} ${buyerProfile.lastName || ''}`.trim() : null) ||
      buyerUser?.name ||
      buyerUser?.email?.split('@')[0] ||
      'Buyer';

    const sellerName =
      sellerProfile?.displayName ||
      (sellerProfile?.firstName ? `${sellerProfile.firstName} ${sellerProfile.lastName || ''}`.trim() : null) ||
      sellerUser?.name ||
      sellerUser?.email?.split('@')[0] ||
      'Seller';

    const listingTitle = order.listingTitle || listing?.title || `${listing?.brand || ''} ${listing?.model || ''}`.trim() || 'Electronic Device';

    const itemPriceStr = `${order.currency} ${Number(order.amount).toFixed(2)}`;
    const protectionFeeStr = order.protectionFee ? `${order.currency} ${Number(order.protectionFee).toFixed(2)}` : null;
    const shippingFeeStr = order.shippingFee ? `${order.currency} ${Number(order.shippingFee).toFixed(2)}` : null;
    const totalAmountStr = `${order.currency} ${(Number(order.totalAmount ?? order.amount)).toFixed(2)}`;
    const sellerPayoutStr = `${order.currency} ${(Number(order.amount) + Number(order.shippingFee || 0)).toFixed(2)}`;

    // 1. Email to Buyer: Order Complete & Itemized Receipt
    if (buyerUser?.email) {
      this.sendEmail({
        type: 'order_confirmed',
        to: buyerUser.email,
        payload: {
          buyerName,
          listingTitle,
          orderId: order.id,
          amount: itemPriceStr,
          protectionFee: protectionFeeStr,
          shippingFee: shippingFeeStr,
          totalAmount: totalAmountStr,
          shippingAddress: order.shippingAddress,
          shippingService: order.shippingService,
        },
      }).catch((err) => {
        this.logger.error('Failed to send buyer order receipt email', err?.stack ?? err);
      });
    }

    // 2. Email to Seller: Sale Made & Next Steps (Package, Ship & Add Tracking)
    if (sellerUser?.email) {
      this.sendEmail({
        type: 'seller_order_received',
        to: sellerUser.email,
        payload: {
          sellerName,
          buyerName,
          listingTitle,
          orderId: order.id,
          payoutAmount: sellerPayoutStr,
          itemPrice: itemPriceStr,
          shippingFee: shippingFeeStr,
          currency: order.currency,
          shippingAddress: order.shippingAddress,
          shippingService: order.shippingService,
        },
      }).catch((err) => {
        this.logger.error('Failed to send seller sale dispatch email', err?.stack ?? err);
      });
    }
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
    const NOTIFICATION_SERVICE_URL = getInternalApiUrl();

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
        signal: AbortSignal.timeout(5000),
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

        // Dispatch rich emails to buyer and seller
        Promise.all([
          this.prisma.user.findUnique({ where: { id: order.buyerId }, select: { email: true, name: true } }),
          this.prisma.profile.findUnique({ where: { userId: order.buyerId }, select: { displayName: true, firstName: true, lastName: true } }),
          this.prisma.user.findUnique({ where: { id: order.sellerId }, select: { email: true, name: true } }),
          this.prisma.profile.findUnique({ where: { userId: order.sellerId }, select: { displayName: true, firstName: true, lastName: true } }),
          this.prisma.listing.findUnique({ where: { id: order.listingId }, select: { title: true, brand: true, model: true } }),
        ])
          .then(([buyerUser, buyerProfile, sellerUser, sellerProfile, listing]) => {
            const buyerName =
              buyerProfile?.displayName ||
              (buyerProfile?.firstName ? `${buyerProfile.firstName} ${buyerProfile.lastName || ''}`.trim() : null) ||
              buyerUser?.name ||
              buyerUser?.email?.split('@')[0] ||
              'Buyer';

            const sellerName =
              sellerProfile?.displayName ||
              (sellerProfile?.firstName ? `${sellerProfile.firstName} ${sellerProfile.lastName || ''}`.trim() : null) ||
              sellerUser?.name ||
              sellerUser?.email?.split('@')[0] ||
              'Seller';

            const listingTitle = order.listingTitle || listing?.title || `${listing?.brand || ''} ${listing?.model || ''}`.trim() || 'Your Order';

            // 1. Email to Buyer with tracking info
            if (buyerUser?.email) {
              this.sendEmail({
                type: 'order_dispatched',
                to: buyerUser.email,
                payload: {
                  buyerName,
                  sellerName,
                  listingTitle,
                  orderId: order.id,
                  trackingNumber: order.trackingNumber,
                  shippingService: order.shippingService,
                  shippingAddress: order.shippingAddress,
                },
              }).catch((err) => this.logger.error('Failed to send dispatched email to buyer', err?.stack ?? err));
            }

            // 2. Confirmation email to Seller
            if (sellerUser?.email) {
              this.sendEmail({
                type: 'seller_dispatch_confirmed',
                to: sellerUser.email,
                payload: {
                  sellerName,
                  buyerName,
                  listingTitle,
                  orderId: order.id,
                  trackingNumber: order.trackingNumber,
                  shippingService: order.shippingService,
                },
              }).catch((err) => this.logger.error('Failed to send dispatch confirmation email to seller', err?.stack ?? err));
            }
          })
          .catch((err) => this.logger.error('Failed to fetch users for dispatched email', err?.stack ?? err));
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

        // Outbound status email to buyer
        this.prisma.user.findUnique({ where: { id: order.buyerId }, select: { email: true, name: true } })
          .then((buyer) => {
            if (buyer?.email) {
              return this.sendEmail({
                type: 'order_status',
                to: buyer.email,
                payload: {
                  recipientName: buyer.name || 'Buyer',
                  listingTitle: order.listingTitle || 'Your order',
                  orderId: order.id,
                  status: 'DELIVERED',
                  message: 'Your parcel has been delivered! Please inspect your device within 48 hours and confirm receipt to release payment to the seller.',
                },
              });
            }
          })
          .catch((err) => this.logger.error('Failed to send delivered email to buyer', err?.stack ?? err));
        break;

      case 'COMPLETED': {
        const sellerPayout = Math.round((Number(order.amount) + (Number(order.shippingFee) || 0)) * 100) / 100;
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.sellerId,
          subject: 'Order completed — escrow released',
          content: `Order #${shortId} has been completed. Your payout of ${order.currency} ${sellerPayout} has been released. Thank you for selling on VeriBuy!`,
        });
        await this.sendOrderNotification({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          recipientId: order.buyerId,
          subject: 'Order completed',
          content: `Order #${shortId} has been completed. Thank you for your purchase on VeriBuy!`,
        });

        // Outbound status email to seller
        this.prisma.user.findUnique({ where: { id: order.sellerId }, select: { email: true, name: true } })
          .then((seller) => {
            if (seller?.email) {
              return this.sendEmail({
                type: 'order_status',
                to: seller.email,
                payload: {
                  recipientName: seller.name || 'Seller',
                  listingTitle: order.listingTitle || 'Your sold item',
                  orderId: order.id,
                  status: 'COMPLETED',
                  message: `Transaction completed! Your escrow payout of ${order.currency} ${sellerPayout} has been released.`,
                },
              });
            }
          })
          .catch((err) => this.logger.error('Failed to send completed email to seller', err?.stack ?? err));
        break;
      }

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
    const LISTING_SERVICE_URL = getInternalApiUrl();

    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${listingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN!,
      },
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(5000),
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
    const LISTING_SERVICE_URL = getInternalApiUrl();

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
      protectionFee: order.protectionFee ?? Math.round(Number(order.amount) * getBuyerProtectionFeeRate() * 100) / 100,
      shippingFee: order.shippingFee ?? null,
      shippingService: order.shippingService ?? null,
      totalAmount: order.totalAmount ?? order.amount,
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

  // ─── Rating methods ────────────────────────────────────────────────────────

  async rateOrder(orderId: string, buyerId: string, dto: RateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== buyerId) {
      throw new BadRequestException('Only the buyer can rate this order');
    }

    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Can only rate completed orders');
    }

    // Check if already rated
    const existing = await this.prisma.rating.findUnique({ where: { orderId } });
    if (existing) {
      throw new BadRequestException('This order has already been rated');
    }

    const rating = await this.prisma.rating.create({
      data: {
        orderId,
        buyerId,
        sellerId: order.sellerId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });

    // Sync aggregate to user-service — fire-and-forget
    this.syncSellerRating(order.sellerId).catch((err) => {
      this.logger.error(`Failed to sync seller rating for ${order.sellerId}`, err?.stack ?? err);
    });

    return rating;
  }

  async getOrderRating(orderId: string) {
    const rating = await this.prisma.rating.findUnique({ where: { orderId } });
    return rating;
  }

  async getSellerRatings(sellerId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    const total = ratings.length;
    const average = total > 0
      ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / total
      : null;

    return { ratings, average, total };
  }

  /**
   * Recalculate the seller's average rating and push it to user-service.
   * Always call as fire-and-forget (.catch(...)) — must not block the rating flow.
   */
  private async syncSellerRating(sellerId: string): Promise<void> {
    const aggregate = await this.prisma.rating.aggregate({
      where: { sellerId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const averageRating = aggregate._avg.rating
      ? Math.round(aggregate._avg.rating * 100) / 100
      : null;
    const totalRatings = aggregate._count.rating;

    const USER_SERVICE_URL = getInternalApiUrl();

    const response = await fetch(`${USER_SERVICE_URL}/users/${sellerId}/seller-rating`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN!,
      },
      body: JSON.stringify({ sellerRating: averageRating, totalRatings }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`User service seller-rating update failed: ${response.status} ${err}`);
    }

    this.logger.log(
      `Synced seller rating for ${sellerId}: avg=${averageRating}, count=${totalRatings}`,
    );
  }

  /**
   * Generates a 4x6" PDF shipping label for an order.
   */
  async getOrderShippingLabel(orderId: string, userId: string, userRole: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (userRole !== 'ADMIN' && order.sellerId !== userId && order.buyerId !== userId) {
      throw new ForbiddenException('You are not authorized to access this shipping label');
    }

    const seller = await this.prisma.user.findUnique({
      where: { id: order.sellerId },
      select: { name: true },
    });
    const sellerProfile = await this.prisma.profile.findUnique({
      where: { userId: order.sellerId },
      include: { address: true },
    });

    const buyer = await this.prisma.user.findUnique({
      where: { id: order.buyerId },
      select: { name: true },
    });
    const buyerProfile = await this.prisma.profile.findUnique({
      where: { userId: order.buyerId },
      include: { address: true },
    });

    const shippingAddr = (order.shippingAddress as Record<string, any>) || {};
    const trackingNumber =
      order.trackingNumber ||
      this.royalMailService.generateTrackingNumber(order.shippingService || 'TRACKED_48');
    const parcelWeightGrams = order.parcelWeightGrams || 320;
    const parcelFormat = order.parcelFormat || 'SMALL_PARCEL';

    return this.royalMailService.generateShippingLabelPdf({
      orderId: order.id,
      trackingNumber,
      service: order.shippingService || 'TRACKED_48',
      parcelWeightGrams,
      parcelFormat,
      itemTitle: order.listingTitle || 'Verified Device',
      senderName: seller?.name || sellerProfile?.displayName || 'VeriBuy Verified Seller',
      senderAddressLine1: sellerProfile?.address?.line1 || '10 VeriBuy Logistics Hub',
      senderTown: sellerProfile?.address?.city || 'London',
      senderPostcode: sellerProfile?.address?.postalCode || 'EC1A 1BB',
      recipientName: shippingAddr.name || buyer?.name || buyerProfile?.displayName || 'Customer',
      recipientAddressLine1: shippingAddr.line1 || buyerProfile?.address?.line1 || '123 High Street',
      recipientAddressLine2: shippingAddr.line2 || buyerProfile?.address?.line2 || undefined,
      recipientTown: shippingAddr.city || buyerProfile?.address?.city || 'London',
      recipientPostcode: shippingAddr.postalCode || buyerProfile?.address?.postalCode || 'SW1A 1AA',
      recipientPhone: shippingAddr.phone || buyerProfile?.phone || undefined,
      createdAt: order.createdAt,
    });
  }

  /**
   * Retrieves drop-off details and nearby Post Office / Delivery Office locations for an order.
   */
  async getOrderDropoffLocations(orderId: string, userId: string, userRole: string, postcode?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (userRole !== 'ADMIN' && order.sellerId !== userId && order.buyerId !== userId) {
      throw new ForbiddenException('You are not authorized to view drop-off locations for this order');
    }

    let resolvedPostcode = postcode;
    if (!resolvedPostcode) {
      const sellerProfile = await this.prisma.profile.findUnique({
        where: { userId: order.sellerId },
        include: { address: true },
      });
      resolvedPostcode = sellerProfile?.address?.postalCode || 'SW1A 1AA';
    }

    const locations = this.royalMailService.findDropoffLocations(resolvedPostcode || 'SW1A 1AA');
    const trackingNumber =
      order.trackingNumber ||
      this.royalMailService.generateTrackingNumber(order.shippingService || 'TRACKED_48');
    const qrCodeUrl =
      order.dropoffQrCodeUrl ||
      this.royalMailService.generateDropoffQrCode(order.id, trackingNumber);

    return {
      orderId: order.id,
      trackingNumber,
      dropoffQrCodeUrl: qrCodeUrl,
      shippingLabelUrl: order.shippingLabelUrl || `/api/orders/${order.id}/shipping-label`,
      parcelWeightGrams: order.parcelWeightGrams || 320,
      parcelFormat: order.parcelFormat || 'SMALL_PARCEL',
      shippingService: order.shippingService || 'TRACKED_48',
      locations,
    };
  }

  /**
   * Resolves the authoritative item price for a listing.
   *
   * SECURITY: This is the only accepted source of an order's item price.
   * For auctions that have been settled, the winning bid supersedes the
   * listing price; otherwise the fixed listing price applies.
   */
  private resolveListingPrice(listing: Record<string, any>): number {
    const candidate =
      listing.format === 'AUCTION' && listing.currentBid != null
        ? listing.currentBid
        : listing.price;

    const parsed = Number(candidate);
    if (!isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100) / 100;
  }

  /**
   * Tolerant equality check for money values, guarding against float drift
   * while still rejecting any meaningful tampering (tolerance: 1 penny).
   */
  private amountsMatch(a: number, b: number): boolean {
    if (!isFinite(a) || !isFinite(b)) return false;
    return Math.abs(a - b) < 0.01;
  }

  /**
   * Recomputes the shipping fee server-side using the Royal Mail rate engine.
   *
   * SECURITY: Client-supplied shipping fees are never trusted. Only the
   * service tier (a constrained enum) and destination postcode influence the
   * result, and both are re-priced here against the resolved weight profile.
   */
  private resolveShippingFee(
    listing: Record<string, any>,
    options: {
      serviceTier?: string | null;
      destinationPostcode?: string;
      itemValue: number;
      isFreeShipping: boolean;
    },
  ): number {
    if (options.isFreeShipping) return 0;

    const tier: RoyalMailServiceTier =
      options.serviceTier === 'TRACKED_24' ||
      options.serviceTier === 'SPECIAL_DELIVERY_1PM'
        ? options.serviceTier
        : 'TRACKED_48';

    try {
      const quote = this.royalMailService.calculateShippingRate(
        listing.deviceType || listing.brand || 'SMARTPHONE',
        tier,
        {
          brand: listing.brand,
          model: listing.model,
          quantity: listing.quantity || 1,
          destinationPostcode: options.destinationPostcode,
          itemValue: options.itemValue,
        },
      );
      return Math.round(Number(quote.totalFee) * 100) / 100;
    } catch (err: any) {
      this.logger.error(`Shipping rate calculation failed: ${(err as Error).message}`);
      throw new BadRequestException('Unable to calculate shipping. Please try again.');
    }
  }

  /**
   * Resolves device weight profile from catalog.
   */
  getDeviceWeightProfile(deviceType: string, brand?: string, model?: string, quantity?: number) {
    return this.royalMailService.resolvePackageProfile(deviceType, brand, model, quantity);
  }

  /**
   * Calculates shipping rate quote using Royal Mail weight tiers.
   */
  calculateShippingRate(
    deviceType: string,
    serviceTier: RoyalMailServiceTier = 'TRACKED_48',
    options?: {
      brand?: string;
      model?: string;
      quantity?: number;
      destinationPostcode?: string;
      itemValue?: number;
    },
  ) {
    return this.royalMailService.calculateShippingRate(deviceType, serviceTier, options);
  }
}
