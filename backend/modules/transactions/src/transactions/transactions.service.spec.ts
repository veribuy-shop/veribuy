import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { TransactionsService, getBuyerProtectionFeeRate, sellerPayoutFor } from './transactions.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { RoyalMailService } from '../shipping/royal-mail.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: any;
  let invoicesService: any;
  let royalMailService: RoyalMailService;
  let mockPaymentIntents: any;

  beforeEach(async () => {
    process.env.BUYER_PROTECTION_FEE_PERCENT = '5';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_secret_key';
    process.env.INTERNAL_SERVICE_TOKEN = 'mock_internal_token';

    mockPaymentIntents = {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_mock',
        status: 'requires_payment_method',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        amount: 52500,
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 52500,
        currency: 'gbp',
        payment_method: {
          billing_details: {
            name: 'Jane Doe',
          },
        },
      }),
    };

    prisma = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn((args: any) => prisma.order.findUnique(args)),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      listing: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refundRecord: {
        create: jest.fn().mockResolvedValue({ id: 'rr-1' }),
      },
      user: {
        findUnique: jest.fn(),
      },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      },
      offer: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      profile: {
        findUnique: jest.fn(),
      },
      escrowRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      referral: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    invoicesService = {
      generateInvoice: jest.fn().mockResolvedValue({
        invoiceNumber: 'INV-2026-0001',
        pdfBuffer: Buffer.from('mock pdf'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        RoyalMailService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    royalMailService = module.get<RoyalMailService>(RoyalMailService);
    // Directly inject mocked stripe instance and internal helpers
    (service as any).stripe = {
      paymentIntents: mockPaymentIntents,
    };
    (service as any).fetchListing = jest.fn().mockResolvedValue(null);
  });

  describe('getBuyerProtectionFeeRate', () => {
    it('refuses to guess a rate when the variable is missing or invalid', () => {
      delete process.env.BUYER_PROTECTION_FEE_PERCENT;
      expect(() => getBuyerProtectionFeeRate()).toThrow('BUYER_PROTECTION_FEE_PERCENT');

      process.env.BUYER_PROTECTION_FEE_PERCENT = 'five';
      expect(() => getBuyerProtectionFeeRate()).toThrow('BUYER_PROTECTION_FEE_PERCENT');
    });

    it('should correctly parse percentage values like 5 or 0.05', () => {
      process.env.BUYER_PROTECTION_FEE_PERCENT = '5';
      expect(getBuyerProtectionFeeRate()).toBe(0.05);

      process.env.BUYER_PROTECTION_FEE_PERCENT = '0.08';
      expect(getBuyerProtectionFeeRate()).toBe(0.08);
    });
  });

  describe('createOrder', () => {
    it('should derive the item price from the listing and recompute shipping server-side', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'iPhone 15 Pro',
        price: 500,
        freeShipping: false,
        quantity: 1,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
        status: 'ACTIVE',
      });

      const mockOrder = {
        id: 'ord-123',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        protectionFee: 25,
        shippingFee: 5.05,
        freeShipping: false,
        totalAmount: 530.05,
        status: 'PENDING',
        paymentIntentId: 'pi_test_123',
      };
      prisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder({
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        shippingFee: 5.5, // client hint — must be ignored in favour of the rate engine
        shippingService: 'TRACKED_48',
        currency: 'GBP',
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 500,
            protectionFee: 25,
            shippingFee: 5.05,
            totalAmount: 530.05,
            freeShipping: false,
          }),
        }),
      );
      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 53005,
          currency: 'gbp',
        }),
      );
      expect(result.order.totalAmount).toBe(530.05);
    });

    // --- SECURITY REGRESSION TESTS -------------------------------------
    describe('price tampering protection', () => {
      const tamperListing = {
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'iPhone 15 Pro',
        price: 500,
        freeShipping: false,
        quantity: 1,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
        status: 'ACTIVE',
      };

      it('rejects an order whose client-supplied amount undercuts the listing price', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(tamperListing);

        await expect(
          service.createOrder({
            buyerId: 'buyer-1',
            sellerId: 'seller-1',
            listingId: 'listing-1',
            amount: 0.01, // attacker attempts to buy a £500 item for 1p
            currency: 'GBP',
          }),
        ).rejects.toThrow(BadRequestException);

        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
        expect(prisma.order.create).not.toHaveBeenCalled();
      });

      it('ignores a tampered shippingFee and charges the recomputed rate', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(tamperListing);
        prisma.order.create.mockResolvedValue({ id: 'ord-1', totalAmount: 530.05 });

        await service.createOrder({
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          listingId: 'listing-1',
          amount: 500,
          shippingFee: 0, // attacker attempts free shipping
          shippingService: 'TRACKED_48',
          currency: 'GBP',
        });

        expect(prisma.order.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ shippingFee: 5.05, totalAmount: 530.05 }),
          }),
        );
        expect(mockPaymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 53005 }),
        );
      });

      it('aborts when the listing cannot be resolved rather than trusting the client', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(null);

        await expect(
          service.createOrder({
            buyerId: 'buyer-1',
            sellerId: 'seller-1',
            listingId: 'missing',
            amount: 500,
            currency: 'GBP',
          }),
        ).rejects.toThrow(NotFoundException);

        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
      });

      it('rejects a sellerId that does not own the listing', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(tamperListing);

        await expect(
          service.createOrder({
            buyerId: 'buyer-1',
            sellerId: 'attacker-seller',
            listingId: 'listing-1',
            amount: 500,
            currency: 'GBP',
          }),
        ).rejects.toThrow(BadRequestException);

        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
      });

      it('derives the price from the winning bid for settled auctions', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...tamperListing,
          format: 'AUCTION',
          status: 'AUCTION_ENDED',
          price: 500,
          currentBid: 650,
          highestBidderId: 'buyer-1',
        });
        prisma.order.create.mockResolvedValue({ id: 'ord-auction' });

        await service.createOrder({
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          listingId: 'listing-1',
          currency: 'GBP',
        });

        expect(prisma.order.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ amount: 650, protectionFee: 32.5 }),
          }),
        );
      });
    });

    describe('auction purchase rules', () => {
      const auction = {
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'iPhone 15 Pro',
        price: 500,
        quantity: 1,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
        format: 'AUCTION',
        currentBid: 650,
      };

      it('rejects a non-winner buying an ended auction', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'AUCTION_ENDED',
          highestBidderId: 'someone-else',
        });

        await expect(
          service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow(ForbiddenException);
        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
      });

      it('rejects buying a running auction that has no Buy It Now price', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'ACTIVE',
          auctionEndsAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        await expect(
          service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects the winner once the payment window has passed', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'AUCTION_ENDED',
          highestBidderId: 'buyer-1',
          auctionEndsAt: new Date(Date.now() - 49 * 3600_000).toISOString(),
        });

        await expect(
          service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow('window to pay');
      });

      it('rejects Buy It Now once bidding has reached that price', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'ACTIVE',
          auctionEndsAt: new Date(Date.now() + 3600_000).toISOString(),
          buyItNowPrice: 320,
          currentBid: 510,
        });

        await expect(
          service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow('Bidding has passed the Buy It Now price');
      });

      it('lets the winner check out even though the client sends the display price', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'AUCTION_ENDED',
          highestBidderId: 'buyer-1',
        });
        prisma.order.create.mockResolvedValue({ id: 'ord-win' });

        await service.createOrder({
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          listingId: 'listing-1',
          amount: 500, // listing.price shown in the UI, not the winning bid
        });

        expect(prisma.order.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 650 }) }),
        );
      });

      it('charges the Buy It Now price on a running auction', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({
          ...auction,
          status: 'ACTIVE',
          buyItNowPrice: 900,
          auctionEndsAt: new Date(Date.now() + 3600_000).toISOString(),
        });
        prisma.order.create.mockResolvedValue({ id: 'ord-bin' });

        await service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' });

        expect(prisma.order.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 900 }) }),
        );
      });
    });

    describe('currency and reservation', () => {
      const listing = {
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'iPhone 15 Pro',
        price: 500,
        quantity: 1,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
        status: 'ACTIVE',
      };

      it('offers Clearpay within its limit and drops it above, so the payment is not rejected', async () => {
        const buy = async (price: number) => {
          (service as any).fetchListing = jest.fn().mockResolvedValue({ ...listing, price });
          prisma.order.create.mockResolvedValue({ id: `ord-${price}` });
          await service.createOrder({
            buyerId: 'buyer-1',
            sellerId: 'seller-1',
            listingId: 'listing-1',
            currency: 'GBP',
          });
          return mockPaymentIntents.create.mock.lastCall[0].payment_method_types;
        };

        expect(await buy(500)).toEqual(['card', 'klarna', 'afterpay_clearpay']);
        expect(await buy(1599)).toEqual(['card', 'klarna']);
      });

      it('always charges in GBP even if the client asks for another currency', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(listing);
        prisma.order.create.mockResolvedValue({ id: 'ord-ccy' });

        await service.createOrder({
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          listingId: 'listing-1',
          currency: 'ZAR',
        });

        expect(mockPaymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({ currency: 'gbp' }),
        );
        expect(prisma.order.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ currency: 'GBP' }) }),
        );
      });

      it('refuses checkout when another buyer already holds the listing', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({ ...listing, status: 'INACTIVE' });
        prisma.listing.updateMany.mockResolvedValueOnce({ count: 0 });

        await expect(
          service.createOrder({ buyerId: 'buyer-2', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow(ConflictException);
        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
      });

      it('refuses to sell a listing that has not passed TrustLens', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue({ ...listing, trustLensStatus: 'REQUIRES_REVIEW' });

        await expect(
          service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPaymentIntents.create).not.toHaveBeenCalled();
      });

      it('charges the configured donation whatever amount the client sends', async () => {
        (service as any).fetchListing = jest.fn().mockResolvedValue(listing);
        process.env.CHARITY_DONATION_GBP = '2.5';

        await service.createOrder({
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          listingId: 'listing-1',
          donationAmount: 10_000,
        });
        process.env.CHARITY_DONATION_GBP = '1';

        expect(mockPaymentIntents.create.mock.calls[0][0].metadata.donationAmount).toBe('2.5');
      });
    });

    it('should waive buyer shipping fee and set totalAmount = item + protection fee when listing has freeShipping', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'listing-bulk-free',
        sellerId: 'seller-1',
        status: 'ACTIVE',
        title: 'Bulk 5x iPhone 15 Pro',
        price: 800,
        freeShipping: true,
        isBulkListing: true,
        quantity: 5,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
      });

      const mockOrder = {
        id: 'ord-free-ship',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-bulk-free',
        amount: 800,
        protectionFee: 40,
        shippingFee: null,
        freeShipping: true,
        totalAmount: 840,
        status: 'PENDING',
        paymentIntentId: 'pi_test_123',
      };
      prisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder({
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-bulk-free',
        amount: 800,
        shippingFee: 15.0,
        shippingService: 'TRACKED_24',
        currency: 'GBP',
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 800,
            protectionFee: 40,
            shippingFee: null,
            freeShipping: true,
            shippingService: 'TRACKED_24',
          }),
        }),
      );
      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 84000,
        }),
      );
      expect(result.order.shippingFee).toBeNull();
      expect(result.order.totalAmount).toBe(840);
    });
  });

  describe('invoices', () => {
    it('sends the invoice to the buyer email from the database', async () => {
      invoicesService.generateAndSendInvoice = jest.fn().mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue({ email: 'buyer@example.com' });

      await (service as any).generateInvoiceForOrder({ id: 'ord-1', buyerId: 'buyer-1', sellerId: 'seller-1' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'buyer-1' },
        select: { email: true },
      });
      expect(invoicesService.generateAndSendInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ord-1' }),
        'buyer@example.com',
      );
    });
  });

  describe('sellerPayoutFor', () => {
    it('pays the seller the item price, not the buyer’s shipping charge', () => {
      expect(sellerPayoutFor({ amount: 500, sellerShippingFee: null })).toBe(500);
    });

    it('takes postage off the payout on a free-delivery order', () => {
      expect(sellerPayoutFor({ amount: 500, sellerShippingFee: 5.05 })).toBe(494.95);
    });
  });

  describe('updateShipping', () => {
    it('recomputes the shipping fee server-side and ignores the client value', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'listing-1',
        sellerId: 'seller-1',
        status: 'ACTIVE',
        price: 300,
        quantity: 1,
        deviceType: 'SMARTPHONE',
        trustLensStatus: 'PASSED',
        freeShipping: false,
      });

      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        buyerId: 'buyer-1',
        listingId: 'listing-1',
        status: 'PENDING',
        amount: 300,
        protectionFee: 15,
        shippingFee: 5,
        totalAmount: 320,
        paymentIntentId: 'pi_test_123',
        currency: 'GBP',
        freeShipping: false,
        shippingAddress: null,
      });

      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        shippingFee: 5.95,
        totalAmount: 320.95,
      });

      // Client claims £0 shipping — the TRACKED_24 rate plus handling (£5.95) must win.
      const result = await service.updateShipping('ord-1', 'buyer-1', {
        shippingFee: 0,
        shippingService: 'TRACKED_24',
      });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            shippingFee: 5.95,
            totalAmount: 320.95,
          }),
        }),
      );
      expect(mockPaymentIntents.update).toHaveBeenCalledWith(
        'pi_test_123',
        expect.objectContaining({
          amount: 32095,
        }),
      );
      expect(result.shippingFee).toBe(5.95);
    });
  });

  describe('updateOrderStatus', () => {
    const BUYER = 'buyer-1';
    const SELLER = 'seller-1';

    const mockOrderAt = (status: string) =>
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        buyerId: BUYER,
        sellerId: SELLER,
        status,
        escrowId: null,
      });

    it('should disallow invalid transitions and throw BadRequestException', async () => {
      mockOrderAt('COMPLETED');

      await expect(
        service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    // --- SECURITY REGRESSION: per-actor authorisation -------------------
    describe('per-actor authorisation', () => {
      it('forbids the BUYER from marking an order SHIPPED (seller-only)', async () => {
        mockOrderAt('ESCROW_HELD');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }, 'BUYER', BUYER),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.order.update).not.toHaveBeenCalled();
      });

      it('allows the SELLER to mark an order SHIPPED', async () => {
        mockOrderAt('ESCROW_HELD');
        prisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'SHIPPED' });

        await expect(
          service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }, 'SELLER', SELLER),
        ).resolves.toBeDefined();
      });

      it('forbids the SELLER from self-certifying DELIVERED', async () => {
        mockOrderAt('SHIPPED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'DELIVERED' as any }, 'SELLER', SELLER),
        ).rejects.toThrow(ForbiddenException);
      });

      it('forbids the SELLER from releasing escrow via COMPLETED', async () => {
        mockOrderAt('DELIVERED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'COMPLETED' as any }, 'SELLER', SELLER),
        ).rejects.toThrow(ForbiddenException);
      });

      it('allows the BUYER to complete a delivered order', async () => {
        mockOrderAt('DELIVERED');
        prisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'COMPLETED' });

        await expect(
          service.updateOrderStatus('ord-1', { status: 'COMPLETED' as any }, 'BUYER', BUYER),
        ).resolves.toBeDefined();
      });

      it('qualifies referral and increments referrer balance when seller completes first sale', async () => {
        mockOrderAt('DELIVERED');
        prisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'COMPLETED', sellerId: SELLER });
        prisma.referral.findUnique.mockResolvedValue({
          id: 'ref-123',
          referrerId: 'user-alice',
          referredId: SELLER,
          status: 'PENDING',
          rewardAmount: 5.0,
        });
        prisma.referral.update.mockResolvedValue({ id: 'ref-123', status: 'QUALIFIED' });
        prisma.profile.update = jest.fn().mockResolvedValue({});

        await service.updateOrderStatus('ord-1', { status: 'COMPLETED' as any }, 'BUYER', BUYER);

        expect(prisma.referral.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ref-123' },
            data: expect.objectContaining({
              status: 'QUALIFIED',
              qualifyingOrderId: 'ord-1',
            }),
          }),
        );
        expect(prisma.profile.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: 'user-alice' },
            data: expect.objectContaining({
              referralBonusBalance: { increment: 5.0 },
            }),
          }),
        );
      });

      it('forbids a counterparty from resolving a dispute as REFUNDED', async () => {
        mockOrderAt('DISPUTED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'REFUNDED' as any }, 'BUYER', BUYER),
        ).rejects.toThrow(ForbiddenException);
      });

      it('requires a reason when a buyer opens a dispute', async () => {
        mockOrderAt('SHIPPED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'DISPUTED' as any }, 'BUYER', BUYER),
        ).rejects.toThrow(BadRequestException);
      });

      it('lets a buyer dispute with a reason and messages the seller', async () => {
        mockOrderAt('SHIPPED');

        await service.updateOrderStatus(
          'ord-1',
          { status: 'DISPUTED' as any, reason: 'Screen is cracked, not Grade A as listed.' },
          'BUYER',
          BUYER,
        );

        expect(prisma.message.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            senderId: BUYER,
            recipientId: SELLER,
            content: 'Screen is cracked, not Grade A as listed.',
          }),
        });
      });

      it('allows ADMIN to resolve a dispute in the seller\'s favour', async () => {
        mockOrderAt('DISPUTED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'COMPLETED' as any }, 'ADMIN'),
        ).resolves.toBeDefined();
      });

      it('refuses an ADMIN refund when there is no escrow to return', async () => {
        mockOrderAt('DISPUTED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'REFUNDED' as any }, 'ADMIN'),
        ).rejects.toThrow(BadRequestException);
      });

      it('forbids an unrelated third party from touching the order', async () => {
        mockOrderAt('ESCROW_HELD');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }, 'SELLER', 'attacker-9'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('resolves the actor from the order, not the caller global role', async () => {
        // A SELLER-role account that is the BUYER on this order must be
        // treated as the buyer, and therefore blocked from shipping it.
        mockOrderAt('ESCROW_HELD');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }, 'SELLER', BUYER),
        ).rejects.toThrow(ForbiddenException);
      });

      it('allows INTERNAL (Stripe webhook) to move PAYMENT_RECEIVED → ESCROW_HELD', async () => {
        mockOrderAt('PAYMENT_RECEIVED');
        prisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'ESCROW_HELD' });

        await expect(
          service.updateOrderStatus('ord-1', { status: 'ESCROW_HELD' as any }, 'INTERNAL'),
        ).resolves.toBeDefined();
      });

      it('forbids the BUYER from escrowing their own payment', async () => {
        mockOrderAt('PAYMENT_RECEIVED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'ESCROW_HELD' as any }, 'BUYER', BUYER),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('Royal Mail Shipping & Weight Mapping', () => {
    it('should resolve automated device weight profiles', () => {
      const phoneProfile = service.getDeviceWeightProfile('SMARTPHONE', 'Apple', 'iPhone 15 Pro');
      expect(phoneProfile.totalWeightGrams).toBe(365);
      expect(phoneProfile.parcelFormat).toBe('SMALL_PARCEL');

      const bulkProfile = service.getDeviceWeightProfile('SMARTPHONE', 'Apple', 'iPhone 15 Pro', 5);
      expect(bulkProfile.totalWeightGrams).toBe(1825);
      expect(bulkProfile.parcelFormat).toBe('MEDIUM_PARCEL');
    });

    it('should calculate Royal Mail shipping quotes', () => {
      const quote = service.calculateShippingRate('SMARTPHONE', 'TRACKED_48', {
        brand: 'Apple',
        quantity: 1,
      });
      expect(quote.baseFee).toBe(3.55);
      expect(quote.service).toBe('TRACKED_48');
    });

    it('should provide drop-off locations with opening hours and features', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-dropoff-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        shippingService: 'TRACKED_48',
        trackingNumber: 'TH123456789GB',
      });
      prisma.profile.findUnique.mockResolvedValue({
        address: { postalCode: 'SW1A 1AA' },
      });

      const dropoff = await service.getOrderDropoffLocations('ord-dropoff-1', 'seller-1', 'SELLER');
      expect(dropoff.locations.length).toBeGreaterThan(0);
      expect(dropoff.locations[0].type).toBe('POST_OFFICE');
      expect(dropoff.trackingNumber).toBe('TH123456789GB');
      expect(dropoff.dropoffQrCodeUrl).toContain('data:application/json;base64,');
    });

    it('should generate 4x6" PDF shipping label buffer', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-pdf-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        listingTitle: 'MacBook Pro 16',
        shippingService: 'TRACKED_24',
        parcelWeightGrams: 2400,
        parcelFormat: 'MEDIUM_PARCEL',
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({ name: 'Alice Seller' });
      prisma.profile.findUnique.mockResolvedValue({
        displayName: 'Alice',
        address: { line1: '1 Oxford St', city: 'London', postalCode: 'W1D 1BS' },
      });

      const buffer = await service.getOrderShippingLabel('ord-pdf-1', 'seller-1', 'SELLER');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
      // PDF header signature check: %PDF-
      expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
    });

    it('should confirm payment, verify cardholder name with Stripe, and transition order to ESCROW_HELD', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-confirm-1',
        paymentIntentId: 'pi_test_123',
        amount: 500,
        totalAmount: 525,
        currency: 'gbp',
        status: 'PENDING',
        listingId: 'list-1',
        shippingService: 'TRACKED_48',
      });

      prisma.order.update.mockResolvedValue({
        id: 'ord-confirm-1',
        status: 'ESCROW_HELD',
        listingId: 'list-1',
      });

      prisma.escrowRecord.create.mockResolvedValue({
        id: 'escrow-1',
        status: 'HELD',
        amount: 525,
      });

      prisma.listing.update.mockResolvedValue({ id: 'list-1', status: 'SOLD' });

      const result = await service.confirmPayment('ord-confirm-1', 'pi_test_123');
      expect(mockPaymentIntents.retrieve).toHaveBeenCalledWith('pi_test_123', {
        expand: ['payment_method'],
      });
      expect(result.order.status).toBe('ESCROW_HELD');
      expect(result.escrow?.status).toBe('HELD');
    });

    it('should reject payment confirmation if charged amount is lower than order total', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-tamper-1',
        paymentIntentId: 'pi_test_123',
        amount: 500,
        totalAmount: 525,
        currency: 'gbp',
        status: 'PENDING',
      });

      mockPaymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 100, // Tampered amount (1.00 instead of 525.00)
        currency: 'gbp',
      });

      await expect(service.confirmPayment('ord-tamper-1', 'pi_test_123')).rejects.toThrow(
        BadRequestException,
      );
    });

  describe('payment and refund integrity', () => {
    const paidIntent = {
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 52500,
      currency: 'gbp',
      payment_method: { billing_details: { name: 'Jane Buyer' } },
    };

    it('does not create a second escrow when a concurrent confirmation already won', async () => {
      mockPaymentIntents.retrieve.mockResolvedValueOnce(paidIntent);
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-race',
        paymentIntentId: 'pi_test_123',
        amount: 500,
        totalAmount: 525,
        currency: 'GBP',
        status: 'PENDING',
        escrowId: null,
      });
      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.confirmPayment('ord-race', 'pi_test_123');

      expect(prisma.escrowRecord.create).not.toHaveBeenCalled();
    });

    it('auto-refunds a late payment when the listing has since been sold', async () => {
      const refunds = { create: jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' }) };
      (service as any).stripe.refunds = refunds;
      mockPaymentIntents.retrieve.mockResolvedValueOnce(paidIntent);
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-late',
        paymentIntentId: 'pi_test_123',
        listingId: 'list-1',
        amount: 500,
        totalAmount: 525,
        currency: 'GBP',
        status: 'CANCELLED',
      });
      prisma.listing.updateMany.mockResolvedValueOnce({ count: 0 }); // listing no longer reservable

      await expect(service.confirmPayment('ord-late', 'pi_test_123')).rejects.toThrow(ConflictException);
      expect(refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
        expect.objectContaining({ idempotencyKey: 'refund-unfulfillable-ord-late' }),
      );
      expect(prisma.escrowRecord.create).not.toHaveBeenCalled();
    });

    it('refuses to refund an order whose escrow was already released', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'ord-done', status: 'COMPLETED', escrowId: 'esc-1' });

      await expect(service.refundOrder('ord-done')).rejects.toThrow(BadRequestException);
    });

    it('routes an ADMIN dispute resolution to REFUNDED through Stripe', async () => {
      const refunds = { create: jest.fn().mockResolvedValue({ id: 're_2', status: 'succeeded' }) };
      (service as any).stripe.refunds = refunds;
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-disp',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'list-1',
        status: 'DISPUTED',
        escrowId: 'esc-1',
        totalAmount: 525,
        currency: 'GBP',
      });
      prisma.escrowRecord.findUnique.mockResolvedValue({ id: 'esc-1', status: 'DISPUTED', providerRef: 'pi_test_123' });
      prisma.order.update.mockResolvedValue({ id: 'ord-disp', status: 'REFUNDED' });

      await service.updateOrderStatus('ord-disp', { status: 'REFUNDED' as any }, 'ADMIN');

      expect(refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_test_123' },
        { idempotencyKey: 'refund-order-ord-disp' },
      );
    });
  });

  describe('accepted offers', () => {
    const listing = {
      id: 'listing-1',
      sellerId: 'seller-1',
      title: 'iPhone 15',
      price: 500,
      quantity: 1,
      deviceType: 'SMARTPHONE',
      status: 'ACTIVE',
      trustLensStatus: 'PASSED',
    };

    it('charges the accepted offer price instead of the asking price', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue(listing);
      prisma.offer.findUnique.mockResolvedValue({
        buyerId: 'buyer-1', listingId: 'listing-1', status: 'ACCEPTED', amount: 420,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      prisma.order.create.mockResolvedValue({ id: 'ord-offer' });

      await service.createOrder({
        buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', amount: 500, offerId: 'offer-1',
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 420, protectionFee: 21 }) }),
      );
    });

    it("rejects someone else's accepted offer", async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue(listing);
      prisma.offer.findUnique.mockResolvedValue({
        buyerId: 'other-buyer', listingId: 'listing-1', status: 'ACCEPTED', amount: 300,
        expiresAt: new Date(Date.now() + 3600_000),
      });

      await expect(
        service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', offerId: 'offer-1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPaymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects an expired or unaccepted offer', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue(listing);
      prisma.offer.findUnique.mockResolvedValue({
        buyerId: 'buyer-1', listingId: 'listing-1', status: 'ACCEPTED', amount: 300,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', offerId: 'offer-1' }),
      ).rejects.toThrow(BadRequestException);

      prisma.offer.findUnique.mockResolvedValue({
        buyerId: 'buyer-1', listingId: 'listing-1', status: 'PENDING', amount: 300, expiresAt: null,
      });
      await expect(
        service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1', offerId: 'offer-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('multi-unit (bulk) stock reservation', () => {
    it('sizes the parcel and shipping for one unit, not the whole batch', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'bulk-1',
        sellerId: 'seller-1',
        title: 'Bulk AirPods',
        price: 120,
        deviceType: 'AIRPODS',
        brand: 'Apple',
        model: 'AirPods Pro 2',
        quantity: 10,
        isBulkListing: true,
        status: 'ACTIVE',
        trustLensStatus: 'PASSED',
      });
      prisma.order.create.mockResolvedValue({ id: 'ord-bulk' });
      const profileSpy = jest.spyOn(royalMailService, 'resolvePackageProfile');

      await service.createOrder({ buyerId: 'buyer-1', sellerId: 'seller-1', listingId: 'bulk-1' });

      expect(profileSpy).toHaveBeenCalledWith('AIRPODS', 'Apple', 'AirPods Pro 2', 1);
    });

    it('reserves a single unit and keeps a bulk listing on sale', async () => {
      prisma.listing.updateMany
        .mockResolvedValueOnce({ count: 1 }) // decrement one unit
        .mockResolvedValueOnce({ count: 0 }); // not the last unit → stays ACTIVE

      const reserved = await (service as any).reserveListing('bulk-1');

      expect(reserved).toBe(true);
      expect(prisma.listing.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'bulk-1', status: { in: ['ACTIVE', 'AUCTION_ENDED'] }, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
    });

    it('refuses to reserve when no stock is left', async () => {
      prisma.listing.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect((service as any).reserveListing('bulk-1')).resolves.toBe(false);
    });

    it('returns a released unit to stock and relists a sold-out listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({ status: 'INACTIVE', quantity: 0, format: 'FIXED_PRICE', auctionEndsAt: null });

      await (service as any).releaseListingReservation('bulk-1');

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'bulk-1' },
        data: { quantity: { increment: 1 }, status: 'ACTIVE' },
      });
    });

    it('restocks but does not reactivate a listing the seller paused', async () => {
      prisma.listing.findUnique.mockResolvedValue({ status: 'INACTIVE', quantity: 4, format: 'FIXED_PRICE', auctionEndsAt: null });

      await (service as any).releaseListingReservation('bulk-1');

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'bulk-1' },
        data: { quantity: { increment: 1 } },
      });
    });
  });
  });

  describe('purgeOldCancelledOrders', () => {
    const old = { id: 'o-1', paymentIntentId: 'pi_1', listingTitle: 'Headset', totalAmount: 50, createdAt: new Date('2026-01-01') };

    beforeEach(() => {
      (prisma as any).adminAuditLog = { create: jest.fn().mockResolvedValue({}) };
      mockPaymentIntents.cancel = jest.fn().mockResolvedValue({ status: 'canceled' });
    });

    it('only looks at never-paid orders past the retention period with no financial records', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const before = Date.now();

      await service.purgeOldCancelledOrders();

      const { where } = prisma.order.findMany.mock.calls.at(-1)[0];
      expect(where).toMatchObject({
        status: 'CANCELLED',
        paidAt: null,
        refundedAt: null,
        escrow: { is: null },
        invoice: { none: {} },
        refunds: { none: {} },
        rating: { is: null },
        referralReward: { is: null },
      });
      const ageDays = (before - where.updatedAt.lt.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(ageDays)).toBe(30);
    });

    it('deletes the order and records it in the audit log', async () => {
      prisma.order.findMany.mockResolvedValue([old]);

      await service.purgeOldCancelledOrders();

      expect(prisma.order.deleteMany.mock.calls.at(-1)[0].where).toMatchObject({ id: 'o-1', status: 'CANCELLED', paidAt: null });
      expect((prisma as any).adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'Purged cancelled order', targetId: 'o-1' }),
      });
    });

    it('keeps an order whose payment can still move money', async () => {
      prisma.order.findMany.mockResolvedValue([old]);
      prisma.order.deleteMany.mockClear();
      mockPaymentIntents.cancel = jest.fn().mockRejectedValue(new Error('already succeeded'));
      mockPaymentIntents.retrieve = jest.fn().mockResolvedValue({ status: 'succeeded' });

      await service.purgeOldCancelledOrders();

      expect(prisma.order.deleteMany).not.toHaveBeenCalled();
      expect((prisma as any).adminAuditLog.create).not.toHaveBeenCalled();
    });
  });
});
