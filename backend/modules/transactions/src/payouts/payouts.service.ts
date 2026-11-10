import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PayoutStatus, Prisma } from '.prisma/veribuy-client';
import { PrismaService } from '../../../../src/database/prisma.service';

/** VeriBuy sellers are UK sellers paid in GBP. */
const SELLER_COUNTRY = 'GB';
const MAX_PAGE_SIZE = 100;
/** How long one transfer attempt owns a payout before another attempt may take over. */
const ATTEMPT_LEASE_MS = 2 * 60 * 1000;
/** How often owed payouts are re-checked, e.g. after a seller finishes Stripe onboarding. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const SWEEP_BATCH_SIZE = 50;

/** Statuses in which the money is still owed and a transfer may be attempted. */
const UNPAID_STATUSES: PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.AWAITING_SELLER,
  PayoutStatus.FAILED,
  PayoutStatus.ON_HOLD,
];

/** What the team has to act on: transfers that did not go, and paid payouts whose buyer money came back. */
export const PAYOUT_ATTENTION_WHERE: Prisma.PayoutWhereInput = {
  OR: [
    { status: { in: [PayoutStatus.FAILED, PayoutStatus.ON_HOLD] } },
    { status: PayoutStatus.PAID, flaggedAt: { not: null } },
  ],
};

const PAYOUT_VIEWS: Record<string, Prisma.PayoutWhereInput> = {
  all: {},
  attention: PAYOUT_ATTENTION_WHERE,
  waiting: { status: { in: [PayoutStatus.PENDING, PayoutStatus.AWAITING_SELLER] } },
  paid: { status: PayoutStatus.PAID },
  reversed: { status: PayoutStatus.REVERSED },
};

/** Why the buyer's money left VeriBuy after the order was paid for. */
export type BuyerMoneyEvent = 'CHARGEBACK_OPENED' | 'CHARGEBACK_WON' | 'CHARGEBACK_LOST' | 'REFUNDED';

const BUYER_MONEY_REASONS: Record<Exclude<BuyerMoneyEvent, 'CHARGEBACK_WON'>, string> = {
  CHARGEBACK_OPENED: 'The buyer has raised a chargeback with their bank',
  CHARGEBACK_LOST: 'The buyer won a chargeback, so their bank took the payment back',
  REFUNDED: 'The buyer payment was refunded in Stripe',
};

const SELLER_PAYOUT_SELECT = {
  id: true,
  orderId: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
  createdAt: true,
  order: { select: { listingTitle: true } },
} as const;

export interface PayoutAccountStatus {
  /** The seller has started Stripe onboarding. */
  connected: boolean;
  /** The seller has given Stripe everything it asked for. */
  detailsSubmitted: boolean;
  /** Stripe can pay this seller, so transfers go out on completion. */
  payoutsEnabled: boolean;
}

/**
 * What the seller is owed for an order. VeriBuy buys the Royal Mail label, so
 * the buyer's shipping charge is not the seller's; on a free-delivery order
 * the postage comes out of the seller's money instead.
 */
export function sellerPayoutFor(order: { amount: unknown; sellerShippingFee?: unknown }): number {
  return Math.round((Number(order.amount) - Number(order.sellerShippingFee || 0)) * 100) / 100;
}

function isAccountReady(account: Stripe.Account): boolean {
  return account.capabilities?.transfers === 'active' && account.payouts_enabled === true;
}

function appUrl(): string {
  const value = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new Error('APP_URL must be set so Stripe can send sellers back after payout setup');
  }
  return value;
}

/**
 * Pays sellers through Stripe Connect Express.
 *
 * Buyer payments land on VeriBuy's own Stripe balance. When an order completes,
 * one Payout row is written in the same database transaction, then the seller's
 * share is transferred to their connected account. Every outcome is recorded on
 * that row, so each completed order has exactly one traceable payout.
 */
@Injectable()
export class PayoutsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutsService.name);
  private stripe: Stripe;
  private sweepTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' });

    this.sweepTimer = setInterval(() => {
      this.sweepOwedPayouts().catch((err) => this.logger.warn(`Payout sweep error: ${err.message}`));
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // ── Recording what is owed ───────────────────────────────────────────────

  /**
   * Records the seller's money as owed. Must run inside the transaction that
   * moves the order to COMPLETED, so an order can never complete without it.
   */
  async recordOwed(
    tx: Prisma.TransactionClient,
    order: { id: string; sellerId: string; amount: unknown; sellerShippingFee?: unknown; currency: string },
  ): Promise<void> {
    const amount = sellerPayoutFor(order);
    if (!(amount > 0)) {
      this.logger.warn(`Order ${order.id} completed with nothing owed to the seller (${amount})`);
      return;
    }
    await tx.payout.create({
      data: { orderId: order.id, sellerId: order.sellerId, amount, currency: order.currency },
    });
  }

  // ── Paying ───────────────────────────────────────────────────────────────

  /** Attempts the transfer for an order's payout. Never throws: the outcome is on the payout. */
  async payOrder(orderId: string): Promise<PayoutStatus | null> {
    const payout = await this.prisma.payout.findUnique({ where: { orderId }, select: { id: true } });
    if (!payout) return null;
    return this.attempt(payout.id);
  }

  /**
   * Tries to transfer one payout to the seller. Safe to call repeatedly and
   * concurrently: a lease stops two attempts overlapping, and an existing
   * Stripe transfer for the order is adopted rather than repeated.
   */
  async attempt(payoutId: string): Promise<PayoutStatus> {
    const now = new Date();
    const { count } = await this.prisma.payout.updateMany({
      where: {
        id: payoutId,
        status: { in: UNPAID_STATUSES },
        OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(now.getTime() - ATTEMPT_LEASE_MS) } }],
      },
      data: { lastAttemptAt: now, attempts: { increment: 1 } },
    });
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        order: {
          select: {
            status: true,
            paymentIntentId: true,
            _count: { select: { refunds: true } },
          },
        },
        seller: { select: { id: true, stripeAccountId: true } },
      },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    // Already paid, or another attempt is in flight.
    if (count !== 1) return payout.status;

    try {
      const outcome = await this.transfer(payout);
      await this.prisma.payout.update({
        where: { id: payout.id },
        // Clearing the lease lets the next attempt (a retry, or the seller finishing onboarding) run straight away.
        data: { ...outcome, lastAttemptAt: outcome.status === PayoutStatus.PAID ? now : null },
      });
      if (outcome.status === PayoutStatus.PAID) {
        this.logger.log(`Paid payout ${payout.id} for order ${payout.orderId} (${outcome.stripeTransferId})`);
      } else {
        this.logger.warn(`Payout ${payout.id} for order ${payout.orderId} is ${outcome.status}: ${outcome.failureReason}`);
      }
      return outcome.status;
    } catch (err) {
      const reason = ((err as Error)?.message || 'Stripe transfer failed').slice(0, 500);
      this.logger.error(`Payout ${payout.id} for order ${payout.orderId} failed: ${reason}`);
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.FAILED, failureReason: reason, lastAttemptAt: null },
      });
      return PayoutStatus.FAILED;
    }
  }

  private async transfer(payout: {
    id: string;
    orderId: string;
    amount: unknown;
    order: { status: string; paymentIntentId: string | null; _count: { refunds: number } };
    seller: { id: string; stripeAccountId: string | null };
  }): Promise<{
    status: PayoutStatus;
    failureReason: string | null;
    stripeTransferId?: string;
    stripeAccountId?: string;
    paidAt?: Date;
  }> {
    const hold = (failureReason: string) => ({ status: PayoutStatus.ON_HOLD, failureReason });

    // Money only ever leaves for an order that is completed and was never refunded.
    if (payout.order.status !== 'COMPLETED') {
      return hold(`Order is ${payout.order.status}, not completed`);
    }
    if (payout.order._count.refunds > 0) {
      return hold('The buyer was refunded for this order');
    }
    if (!payout.order.paymentIntentId) {
      return hold('The order has no Stripe payment to pay the seller from');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(payout.order.paymentIntentId, {
      expand: ['latest_charge'],
    });
    const charge = paymentIntent.latest_charge as Stripe.Charge | null;
    if (!charge || typeof charge === 'string' || charge.status !== 'succeeded') {
      return hold('The buyer payment has not succeeded in Stripe');
    }
    if (charge.refunded || charge.amount_refunded > 0) {
      return hold('The buyer payment was refunded in Stripe');
    }
    if (charge.disputed) {
      // Stripe keeps `disputed` set even after VeriBuy wins, so check how it ended.
      const disputes = await this.stripe.disputes.list({ charge: charge.id, limit: 10 });
      if (disputes.data.some((dispute) => dispute.status !== 'won')) {
        return hold(BUYER_MONEY_REASONS.CHARGEBACK_OPENED);
      }
    }

    // A transfer may already exist if an earlier attempt succeeded at Stripe but was not recorded.
    const existing = await this.stripe.transfers.list({ transfer_group: payout.orderId, limit: 1 });
    if (existing.data.length > 0) {
      const found = existing.data[0];
      return {
        status: PayoutStatus.PAID,
        failureReason: null,
        stripeTransferId: found.id,
        stripeAccountId: typeof found.destination === 'string' ? found.destination : found.destination?.id,
        paidAt: new Date(found.created * 1000),
      };
    }

    const destination = payout.seller.stripeAccountId;
    if (!destination || !(await this.refreshAccount(payout.seller.id, destination)).payoutsEnabled) {
      return { status: PayoutStatus.AWAITING_SELLER, failureReason: 'The seller has not finished payout setup with Stripe' };
    }

    const created = await this.stripe.transfers.create(
      {
        amount: Math.round(Number(payout.amount) * 100),
        currency: 'gbp',
        destination,
        // Ties the transfer to the buyer's charge, so it never draws on other orders' money.
        source_transaction: charge.id,
        transfer_group: payout.orderId,
        description: `VeriBuy order ${payout.orderId.substring(0, 8)}`,
        metadata: { orderId: payout.orderId, payoutId: payout.id },
      },
      { idempotencyKey: `payout-${payout.id}-${destination}` },
    );
    return {
      status: PayoutStatus.PAID,
      failureReason: null,
      stripeTransferId: created.id,
      stripeAccountId: destination,
      paidAt: new Date(),
    };
  }

  /** Attempts every owed payout for a seller, e.g. once they finish Stripe onboarding. */
  async payOwedToSeller(sellerId: string): Promise<void> {
    const owed = await this.prisma.payout.findMany({
      where: { sellerId, status: { in: [PayoutStatus.PENDING, PayoutStatus.AWAITING_SELLER] } },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_BATCH_SIZE,
      select: { id: true },
    });
    for (const payout of owed) {
      await this.attempt(payout.id);
    }
  }

  /**
   * Safety net: retries payouts that are owed to sellers who have a Stripe
   * account, so nothing depends on the seller revisiting their dashboard.
   * Failed and held payouts are left for an admin.
   */
  async sweepOwedPayouts(): Promise<void> {
    const owed = await this.prisma.payout.findMany({
      where: {
        status: { in: [PayoutStatus.PENDING, PayoutStatus.AWAITING_SELLER] },
        seller: { stripeAccountId: { not: null } },
      },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_BATCH_SIZE,
      select: { id: true },
    });
    for (const payout of owed) {
      await this.attempt(payout.id);
    }
  }

  // ── Buyer money returned ─────────────────────────────────────────────────

  /**
   * Called from the Stripe webhook when a buyer's payment is charged back or
   * refunded. An unpaid payout is held; a paid one is flagged for an admin,
   * who decides whether to take the money back. Nothing is reversed here.
   * Safe to replay: the same event leaves the payout as it is.
   */
  async recordBuyerMoneyEvent(paymentIntentId: string, event: BuyerMoneyEvent): Promise<{ payoutId: string | null }> {
    const order = await this.prisma.order.findUnique({
      where: { paymentIntentId },
      select: { payout: { select: { id: true, status: true } } },
    });
    const payout = order?.payout;
    if (!payout) return { payoutId: null };

    if (event === 'CHARGEBACK_WON') {
      // The money stayed with VeriBuy: nothing to take back. A held payout stays held for an admin to release.
      await this.prisma.payout.updateMany({
        where: { id: payout.id, status: PayoutStatus.PAID },
        data: { flaggedAt: null, flaggedReason: 'Chargeback won, no action needed' },
      });
      await this.prisma.payout.updateMany({
        where: { id: payout.id, status: PayoutStatus.ON_HOLD },
        data: { failureReason: 'Chargeback won. Try the payout again to pay the seller.' },
      });
      return { payoutId: payout.id };
    }

    const reason = BUYER_MONEY_REASONS[event];
    // Paid: flag it. The status filter means a reversed payout is never re-flagged.
    await this.prisma.payout.updateMany({
      where: { id: payout.id, status: PayoutStatus.PAID },
      data: { flaggedAt: new Date(), flaggedReason: reason },
    });
    // Not paid yet: stop it going out.
    await this.prisma.payout.updateMany({
      where: {
        id: payout.id,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.AWAITING_SELLER, PayoutStatus.FAILED, PayoutStatus.ON_HOLD] },
      },
      data: { status: PayoutStatus.ON_HOLD, failureReason: reason },
    });
    this.logger.warn(`Payout ${payout.id} (${payout.status}): ${reason}`);
    return { payoutId: payout.id };
  }

  /** Admin decision on a flagged payout: take the money back from the seller's Stripe account. */
  async reverse(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, orderId: true, status: true, flaggedAt: true, stripeTransferId: true },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === PayoutStatus.REVERSED) {
      throw new BadRequestException('This payout has already been taken back');
    }
    if (payout.status !== PayoutStatus.PAID || !payout.stripeTransferId) {
      throw new BadRequestException('Only a paid payout can be taken back');
    }
    if (!payout.flaggedAt) {
      throw new BadRequestException('A payout can only be taken back after a chargeback or refund');
    }

    let reversal: Stripe.TransferReversal;
    try {
      reversal = await this.stripe.transfers.createReversal(
        payout.stripeTransferId,
        { metadata: { orderId: payout.orderId, payoutId: payout.id } },
        { idempotencyKey: `payout-reversal-${payout.id}` },
      );
    } catch (err) {
      const reason = ((err as Error)?.message || 'Stripe refused the reversal').slice(0, 300);
      this.logger.error(`Reversal of payout ${payout.id} failed: ${reason}`);
      throw new BadRequestException(`Stripe could not take the money back: ${reason}`);
    }

    // Compare-and-set on PAID so two admins clicking at once record one reversal.
    await this.prisma.payout.updateMany({
      where: { id: payout.id, status: PayoutStatus.PAID },
      data: { status: PayoutStatus.REVERSED, stripeReversalId: reversal.id, reversedAt: new Date(), flaggedAt: null },
    });
    this.logger.log(`Reversed payout ${payout.id} for order ${payout.orderId} (${reversal.id})`);
    return this.prisma.payout.findUnique({
      where: { id: payout.id },
      select: { id: true, status: true, stripeReversalId: true, reversedAt: true },
    });
  }

  /** Admin decision on a flagged payout: the seller keeps the money. */
  async dismissFlag(payoutId: string) {
    const { count } = await this.prisma.payout.updateMany({
      where: { id: payoutId, status: PayoutStatus.PAID, flaggedAt: { not: null } },
      data: { flaggedAt: null },
    });
    if (count !== 1) throw new BadRequestException('This payout is not waiting for a decision');
    return { id: payoutId, status: PayoutStatus.PAID };
  }

  // ── Seller onboarding ────────────────────────────────────────────────────

  /** Reads the account from Stripe and stores whether it can be paid. */
  private async refreshAccount(userId: string, accountId: string): Promise<PayoutAccountStatus> {
    const account = await this.stripe.accounts.retrieve(accountId);
    const payoutsEnabled = isAccountReady(account);
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripePayoutsEnabled: payoutsEnabled },
      select: { id: true },
    });
    return { connected: true, detailsSubmitted: account.details_submitted === true, payoutsEnabled };
  }

  async getAccountStatus(userId: string): Promise<PayoutAccountStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountId: true, stripePayoutsEnabled: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.stripeAccountId) {
      return { connected: false, detailsSubmitted: false, payoutsEnabled: false };
    }
    const status = await this.refreshAccount(userId, user.stripeAccountId);
    if (status.payoutsEnabled) {
      // Anything that was waiting for the seller can go now.
      await this.payOwedToSeller(userId);
    }
    return status;
  }

  /** Returns a one-time Stripe-hosted link where the seller gives their identity and bank details. */
  async createOnboardingLink(userId: string): Promise<{ url: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeAccountId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await this.stripe.accounts.create(
        {
          type: 'express',
          country: SELLER_COUNTRY,
          email: user.email,
          capabilities: { transfers: { requested: true } },
          metadata: { userId },
        },
        { idempotencyKey: `connect-account-${userId}` },
      );
      await this.prisma.user.updateMany({
        where: { id: userId, stripeAccountId: null },
        data: { stripeAccountId: account.id },
      });
      accountId = account.id;
    }

    const base = appUrl();
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${base}/dashboard?tab=earnings&payouts=refresh`,
      return_url: `${base}/dashboard?tab=earnings&payouts=return`,
    });
    return { url: link.url };
  }

  /** Returns a one-time link to the seller's Stripe Express dashboard (bank details, payout history). */
  async createDashboardLink(userId: string): Promise<{ url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { stripeAccountId: true } });
    if (!user?.stripeAccountId) {
      throw new BadRequestException('Set up payouts first');
    }
    const status = await this.refreshAccount(userId, user.stripeAccountId);
    if (!status.detailsSubmitted) {
      throw new BadRequestException('Finish payout setup first');
    }
    const link = await this.stripe.accounts.createLoginLink(user.stripeAccountId);
    return { url: link.url };
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async listForSeller(sellerId: string) {
    const rows = await this.prisma.payout.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PAGE_SIZE,
      select: SELLER_PAYOUT_SELECT,
    });
    return rows.map(({ order, ...payout }) => ({
      ...payout,
      amount: Number(payout.amount),
      listingTitle: order?.listingTitle ?? null,
    }));
  }

  /** The admin payout queue: every payout, what state it is in and why. */
  async listForAdmin(query: { view?: string; page?: string; limit?: string }) {
    const limit = Math.min(Math.max(parseInt(query.limit ?? '', 10) || 25, 1), MAX_PAGE_SIZE);
    const page = Math.max(parseInt(query.page ?? '', 10) || 1, 1);
    const where = PAYOUT_VIEWS[query.view ?? 'all'] ?? {};

    const [rows, total, byStatus, viewCounts] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          orderId: true,
          amount: true,
          currency: true,
          status: true,
          stripeTransferId: true,
          failureReason: true,
          attempts: true,
          paidAt: true,
          flaggedAt: true,
          flaggedReason: true,
          stripeReversalId: true,
          reversedAt: true,
          createdAt: true,
          order: { select: { listingTitle: true } },
          seller: { select: { name: true, email: true, stripePayoutsEnabled: true } },
        },
      }),
      this.prisma.payout.count({ where }),
      this.prisma.payout.groupBy({ by: ['status'], _sum: { amount: true } }),
      Promise.all(
        Object.entries(PAYOUT_VIEWS).map(
          async ([view, viewWhere]) => [view, await this.prisma.payout.count({ where: viewWhere })] as const,
        ),
      ),
    ]);

    const counts: Record<string, number> = Object.fromEntries(viewCounts);
    const settled: PayoutStatus[] = [PayoutStatus.PAID, PayoutStatus.REVERSED];
    const owed = byStatus
      .filter((row) => !settled.includes(row.status))
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

    return {
      data: rows.map(({ order, seller, ...payout }) => ({
        ...payout,
        amount: Number(payout.amount),
        listingTitle: order?.listingTitle ?? null,
        sellerName: seller?.name ?? 'Unknown seller',
        sellerEmail: seller?.email ?? null,
        sellerPayoutsEnabled: seller?.stripePayoutsEnabled ?? false,
      })),
      total,
      page,
      limit,
      counts,
      owedTotal: Math.round(owed * 100) / 100,
    };
  }

  /** Admin retry of a payout that failed, is on hold, or is waiting. */
  async retry(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId }, select: { status: true } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException('This payout has already been paid');
    }
    if (payout.status === PayoutStatus.REVERSED) {
      throw new BadRequestException('This payout was taken back and cannot be sent again');
    }
    // An admin retry overrides a lease left behind by an attempt that never finished.
    await this.prisma.payout.updateMany({
      where: { id: payoutId, status: { in: UNPAID_STATUSES } },
      data: { lastAttemptAt: null },
    });
    const status = await this.attempt(payoutId);
    const updated = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, status: true, failureReason: true, stripeTransferId: true, paidAt: true },
    });
    return { ...updated, status };
  }
}
