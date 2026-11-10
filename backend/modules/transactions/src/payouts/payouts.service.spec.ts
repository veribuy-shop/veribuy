import { BadRequestException } from '@nestjs/common';
import { PayoutsService, sellerPayoutFor } from './payouts.service';

const ACCOUNT = 'acct_seller';

describe('PayoutsService', () => {
  let prisma: any;
  let stripe: any;
  let service: PayoutsService;
  let payout: any;

  beforeEach(() => {
    process.env.APP_URL = 'https://veribuy.test/';

    payout = {
      id: 'pay-1',
      orderId: 'order-12345678',
      amount: '480.00',
      status: 'PENDING',
      order: { status: 'COMPLETED', paymentIntentId: 'pi_1', _count: { refunds: 0 } },
      seller: { id: 'seller-1', stripeAccountId: ACCOUNT },
    };

    prisma = {
      payout: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockImplementation(async () => payout),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(async ({ data }: any) => Object.assign(payout, data)),
      },
      order: {
        findUnique: jest.fn().mockImplementation(async () => ({ payout: { id: payout.id, status: payout.status } })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ email: 'seller@example.com', stripeAccountId: null }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    stripe = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          latest_charge: { id: 'ch_1', status: 'succeeded', refunded: false, amount_refunded: 0, disputed: false },
        }),
      },
      transfers: {
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue({ id: 'tr_1' }),
        createReversal: jest.fn().mockResolvedValue({ id: 'trr_1' }),
      },
      disputes: {
        list: jest.fn().mockResolvedValue({ data: [{ status: 'needs_response' }] }),
      },
      accounts: {
        retrieve: jest.fn().mockResolvedValue({
          capabilities: { transfers: 'active' },
          payouts_enabled: true,
          details_submitted: true,
        }),
        create: jest.fn().mockResolvedValue({ id: ACCOUNT }),
        createLoginLink: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/login' }),
      },
      accountLinks: {
        create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/onboard' }),
      },
    };

    service = new PayoutsService(prisma);
    (service as any).stripe = stripe;
  });

  const lastUpdate = () => prisma.payout.update.mock.calls.at(-1)[0].data;

  describe('sellerPayoutFor', () => {
    it('is the item price, less postage the seller covers on free delivery', () => {
      expect(sellerPayoutFor({ amount: '500.00' })).toBe(500);
      expect(sellerPayoutFor({ amount: '500.00', sellerShippingFee: '6.35' })).toBe(493.65);
    });
  });

  describe('recordOwed', () => {
    it('records the seller share, not the buyer total', async () => {
      await service.recordOwed(prisma, {
        id: 'order-1',
        sellerId: 'seller-1',
        amount: '500.00',
        sellerShippingFee: '6.35',
        currency: 'GBP',
      });

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: { orderId: 'order-1', sellerId: 'seller-1', amount: 493.65, currency: 'GBP' },
      });
    });

    it('records nothing when nothing is owed', async () => {
      await service.recordOwed(prisma, { id: 'order-1', sellerId: 'seller-1', amount: '5', sellerShippingFee: '5', currency: 'GBP' });
      expect(prisma.payout.create).not.toHaveBeenCalled();
    });
  });

  describe('attempt', () => {
    it('transfers the payout in pence to the seller, tied to the buyer charge', async () => {
      await expect(service.attempt('pay-1')).resolves.toBe('PAID');

      expect(stripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 48000,
          currency: 'gbp',
          destination: ACCOUNT,
          source_transaction: 'ch_1',
          transfer_group: 'order-12345678',
        }),
        { idempotencyKey: `payout-pay-1-${ACCOUNT}` },
      );
      expect(lastUpdate()).toMatchObject({ status: 'PAID', stripeTransferId: 'tr_1', stripeAccountId: ACCOUNT, failureReason: null });
      expect(lastUpdate().paidAt).toBeInstanceOf(Date);
    });

    it('does nothing when the payout is already paid or another attempt holds it', async () => {
      prisma.payout.updateMany.mockResolvedValue({ count: 0 });
      payout.status = 'PAID';

      await expect(service.attempt('pay-1')).resolves.toBe('PAID');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(prisma.payout.update).not.toHaveBeenCalled();
    });

    it('only claims payouts that are still unpaid', async () => {
      await service.attempt('pay-1');
      const where = prisma.payout.updateMany.mock.calls[0][0].where;
      expect(where.status.in).not.toContain('PAID');
    });

    it('adopts a transfer Stripe already made instead of paying twice', async () => {
      stripe.transfers.list.mockResolvedValue({ data: [{ id: 'tr_existing', destination: ACCOUNT, created: 1_800_000_000 }] });

      await expect(service.attempt('pay-1')).resolves.toBe('PAID');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(lastUpdate()).toMatchObject({ status: 'PAID', stripeTransferId: 'tr_existing' });
    });

    it.each(['REFUNDED', 'DISPUTED', 'DELIVERED'])('holds the payout when the order is %s', async (status) => {
      payout.order.status = status;

      await expect(service.attempt('pay-1')).resolves.toBe('ON_HOLD');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it('holds the payout when a refund is recorded against the order', async () => {
      payout.order._count.refunds = 1;

      await expect(service.attempt('pay-1')).resolves.toBe('ON_HOLD');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it.each([
      ['fully refunded in Stripe', { refunded: true }],
      ['partly refunded in Stripe', { amount_refunded: 500 }],
      ['charged back', { disputed: true }],
    ])('holds the payout when the buyer payment is %s', async (_label, change) => {
      stripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: { id: 'ch_1', status: 'succeeded', refunded: false, amount_refunded: 0, disputed: false, ...change },
      });

      await expect(service.attempt('pay-1')).resolves.toBe('ON_HOLD');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(lastUpdate().failureReason).toEqual(expect.any(String));
    });

    it('pays once a chargeback has been won, even though Stripe still marks the charge disputed', async () => {
      stripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: { id: 'ch_1', status: 'succeeded', refunded: false, amount_refunded: 0, disputed: true },
      });
      stripe.disputes.list.mockResolvedValue({ data: [{ status: 'won' }] });

      await expect(service.attempt('pay-1')).resolves.toBe('PAID');
    });

    it('waits for the seller when they have no Stripe account', async () => {
      payout.seller.stripeAccountId = null;

      await expect(service.attempt('pay-1')).resolves.toBe('AWAITING_SELLER');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it('waits for the seller when Stripe has not finished verifying them', async () => {
      stripe.accounts.retrieve.mockResolvedValue({ capabilities: { transfers: 'pending' }, payouts_enabled: false });

      await expect(service.attempt('pay-1')).resolves.toBe('AWAITING_SELLER');
      expect(stripe.transfers.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stripePayoutsEnabled: false } }));
    });

    it('records a Stripe failure for an admin to retry, without throwing', async () => {
      stripe.transfers.create.mockRejectedValue(new Error('Insufficient funds'));

      await expect(service.attempt('pay-1')).resolves.toBe('FAILED');
      expect(lastUpdate()).toMatchObject({ status: 'FAILED', failureReason: 'Insufficient funds' });
    });
  });

  describe('sweepOwedPayouts', () => {
    it('leaves failed and held payouts for an admin', async () => {
      await service.sweepOwedPayouts();
      expect(prisma.payout.findMany.mock.calls[0][0].where.status.in).toEqual(['PENDING', 'AWAITING_SELLER']);
    });
  });

  describe('retry', () => {
    it('refuses to pay a payout twice', async () => {
      payout.status = 'PAID';
      await expect(service.retry('pay-1')).rejects.toThrow(BadRequestException);
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it('re-runs a failed payout', async () => {
      payout.status = 'FAILED';
      await expect(service.retry('pay-1')).resolves.toMatchObject({ status: 'PAID' });
    });
  });

  describe('buyer money returned after payment', () => {
    const updates = () => prisma.payout.updateMany.mock.calls.map(([args]: any) => args);

    it.each(['CHARGEBACK_OPENED', 'CHARGEBACK_LOST', 'REFUNDED'] as const)(
      'flags a paid payout for an admin on %s, without reversing anything',
      async (event) => {
        payout.status = 'PAID';

        await expect(service.recordBuyerMoneyEvent('pi_1', event)).resolves.toEqual({ payoutId: 'pay-1' });

        const flag = updates().find((args: any) => args.where.status === 'PAID');
        expect(flag.data.flaggedAt).toBeInstanceOf(Date);
        expect(flag.data.flaggedReason).toEqual(expect.any(String));
        expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
      },
    );

    it('holds a payout that has not been sent yet', async () => {
      payout.status = 'AWAITING_SELLER';

      await service.recordBuyerMoneyEvent('pi_1', 'CHARGEBACK_OPENED');

      const hold = updates().find((args: any) => args.data.status === 'ON_HOLD');
      expect(hold.where.status.in).toEqual(expect.arrayContaining(['PENDING', 'AWAITING_SELLER', 'FAILED']));
      expect(hold.where.status.in).not.toContain('PAID');
      expect(hold.where.status.in).not.toContain('REVERSED');
    });

    it('clears the flag when the chargeback is won', async () => {
      payout.status = 'PAID';

      await service.recordBuyerMoneyEvent('pi_1', 'CHARGEBACK_WON');

      expect(updates().find((args: any) => args.where.status === 'PAID').data.flaggedAt).toBeNull();
    });

    it('ignores a payment that has no payout', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.recordBuyerMoneyEvent('pi_unknown', 'REFUNDED')).resolves.toEqual({ payoutId: null });
      expect(prisma.payout.updateMany).not.toHaveBeenCalled();
    });

    describe('reverse', () => {
      beforeEach(() => {
        Object.assign(payout, { status: 'PAID', stripeTransferId: 'tr_1', flaggedAt: new Date() });
      });

      it('takes the money back through Stripe and records the reversal', async () => {
        await service.reverse('pay-1');

        expect(stripe.transfers.createReversal).toHaveBeenCalledWith('tr_1', expect.any(Object), {
          idempotencyKey: 'payout-reversal-pay-1',
        });
        expect(prisma.payout.updateMany).toHaveBeenCalledWith({
          where: { id: 'pay-1', status: 'PAID' },
          data: expect.objectContaining({ status: 'REVERSED', stripeReversalId: 'trr_1', flaggedAt: null }),
        });
      });

      it('refuses to reverse a payout twice', async () => {
        payout.status = 'REVERSED';
        await expect(service.reverse('pay-1')).rejects.toThrow(BadRequestException);
        expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
      });

      it('refuses to reverse a payout with no chargeback or refund against it', async () => {
        payout.flaggedAt = null;
        await expect(service.reverse('pay-1')).rejects.toThrow(BadRequestException);
        expect(stripe.transfers.createReversal).not.toHaveBeenCalled();
      });

      it('refuses to reverse a payout that was never sent', async () => {
        Object.assign(payout, { status: 'ON_HOLD', stripeTransferId: null });
        await expect(service.reverse('pay-1')).rejects.toThrow(BadRequestException);
      });

      it('leaves the payout paid when Stripe cannot take the money back', async () => {
        stripe.transfers.createReversal.mockRejectedValue(new Error('Insufficient funds in the connected account'));

        await expect(service.reverse('pay-1')).rejects.toThrow('Insufficient funds');
        expect(prisma.payout.updateMany).not.toHaveBeenCalled();
      });
    });

    it('refuses to re-send a payout that was taken back', async () => {
      payout.status = 'REVERSED';
      await expect(service.retry('pay-1')).rejects.toThrow(BadRequestException);
      expect(stripe.transfers.create).not.toHaveBeenCalled();
    });

    it('lets an admin leave the money with the seller', async () => {
      await expect(service.dismissFlag('pay-1')).resolves.toEqual({ id: 'pay-1', status: 'PAID' });
      expect(prisma.payout.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PAID', flaggedAt: { not: null } },
        data: { flaggedAt: null },
      });
    });
  });

  describe('onboarding', () => {
    it('creates one UK Express account per seller and returns a Stripe-hosted link', async () => {
      await expect(service.createOnboardingLink('seller-1')).resolves.toEqual({ url: 'https://connect.stripe.test/onboard' });

      expect(stripe.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'express', country: 'GB', capabilities: { transfers: { requested: true } } }),
        { idempotencyKey: 'connect-account-seller-1' },
      );
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'seller-1', stripeAccountId: null },
        data: { stripeAccountId: ACCOUNT },
      });
      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({ account: ACCOUNT, return_url: 'https://veribuy.test/dashboard?tab=earnings&payouts=return' }),
      );
    });

    it('reuses the existing account', async () => {
      prisma.user.findUnique.mockResolvedValue({ email: 'seller@example.com', stripeAccountId: ACCOUNT });
      await service.createOnboardingLink('seller-1');
      expect(stripe.accounts.create).not.toHaveBeenCalled();
    });

    it('refuses to guess the return address', async () => {
      delete process.env.APP_URL;
      await expect(service.createOnboardingLink('seller-1')).rejects.toThrow('APP_URL');
    });

    it('pays what was waiting once the seller is verified', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeAccountId: ACCOUNT, stripePayoutsEnabled: false });
      prisma.payout.findMany.mockResolvedValue([{ id: 'pay-1' }]);
      payout.status = 'AWAITING_SELLER';

      await expect(service.getAccountStatus('seller-1')).resolves.toEqual({
        connected: true,
        detailsSubmitted: true,
        payoutsEnabled: true,
      });
      expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    });

    it('reports a seller who has not started', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeAccountId: null, stripePayoutsEnabled: false });
      await expect(service.getAccountStatus('seller-1')).resolves.toEqual({
        connected: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
      });
      expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    });
  });
});
