import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TransactionsService, getBuyerProtectionFeeRate } from './transactions.service';
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
    delete process.env.BUYER_PROTECTION_FEE_PERCENT;
    delete process.env.BUYER_PROTECTION_FEE_RATE;
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
    };

    prisma = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      profile: {
        findUnique: jest.fn(),
      },
      escrowRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
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
    it('should default to 5% (0.05)', () => {
      delete process.env.BUYER_PROTECTION_FEE_PERCENT;
      delete process.env.BUYER_PROTECTION_FEE_RATE;
      expect(getBuyerProtectionFeeRate()).toBe(0.05);
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
        status: 'ACTIVE',
      });

      const mockOrder = {
        id: 'ord-123',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        protectionFee: 25,
        shippingFee: 3.55,
        freeShipping: false,
        totalAmount: 528.55,
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
            shippingFee: 3.55,
            totalAmount: 528.55,
            freeShipping: false,
          }),
        }),
      );
      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 52855,
          currency: 'gbp',
        }),
      );
      expect(result.order.totalAmount).toBe(528.55);
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
        prisma.order.create.mockResolvedValue({ id: 'ord-1', totalAmount: 528.55 });

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
            data: expect.objectContaining({ shippingFee: 3.55, totalAmount: 528.55 }),
          }),
        );
        expect(mockPaymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 52855 }),
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
          price: 500,
          currentBid: 650,
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

  describe('updateShipping', () => {
    it('recomputes the shipping fee server-side and ignores the client value', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'listing-1',
        sellerId: 'seller-1',
        status: 'ACTIVE',
        price: 300,
        quantity: 1,
        deviceType: 'SMARTPHONE',
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
        shippingFee: 4.45,
        totalAmount: 319.45,
      });

      // Client claims £0 shipping — the TRACKED_24 rate (£4.45) must win.
      const result = await service.updateShipping('ord-1', 'buyer-1', {
        shippingFee: 0,
        shippingService: 'TRACKED_24',
      });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            shippingFee: 4.45,
            totalAmount: 319.45,
          }),
        }),
      );
      expect(mockPaymentIntents.update).toHaveBeenCalledWith(
        'pi_test_123',
        expect.objectContaining({
          amount: 31945,
        }),
      );
      expect(result.shippingFee).toBe(4.45);
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

      it('forbids a counterparty from resolving a dispute as REFUNDED', async () => {
        mockOrderAt('DISPUTED');

        await expect(
          service.updateOrderStatus('ord-1', { status: 'REFUNDED' as any }, 'BUYER', BUYER),
        ).rejects.toThrow(ForbiddenException);
      });

      it('allows ADMIN to resolve a dispute', async () => {
        mockOrderAt('DISPUTED');
        prisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'REFUNDED' });

        await expect(
          service.updateOrderStatus('ord-1', { status: 'REFUNDED' as any }, 'ADMIN'),
        ).resolves.toBeDefined();
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
  });
});
