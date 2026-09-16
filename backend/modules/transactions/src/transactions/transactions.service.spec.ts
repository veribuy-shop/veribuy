import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    it('should calculate 5% buyer protection fee and include shipping in total amount', async () => {
      const mockOrder = {
        id: 'ord-123',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        protectionFee: 25,
        shippingFee: 5.5,
        freeShipping: false,
        totalAmount: 530.5,
        status: 'PENDING',
        paymentIntentId: 'pi_test_123',
      };
      prisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder({
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        shippingFee: 5.5,
        shippingService: 'TRACKED_48',
        currency: 'GBP',
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 500,
            protectionFee: 25,
            shippingFee: 5.5,
            totalAmount: 530.5,
            freeShipping: false,
          }),
        }),
      );
      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 53050,
          currency: 'gbp',
        }),
      );
      expect(result.order.totalAmount).toBe(530.5);
    });

    it('should waive buyer shipping fee and set totalAmount = item + protection fee when listing has freeShipping', async () => {
      (service as any).fetchListing = jest.fn().mockResolvedValue({
        id: 'listing-bulk-free',
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
    it('should update shipping fee and recalculate totalAmount on a pending order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        buyerId: 'buyer-1',
        status: 'PENDING',
        amount: 300,
        protectionFee: 15,
        shippingFee: 5,
        totalAmount: 320,
        paymentIntentId: 'pi_test_123',
        currency: 'GBP',
        freeShipping: false,
      });

      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        shippingFee: 12,
        totalAmount: 327,
      });

      const result = await service.updateShipping('ord-1', 'buyer-1', {
        shippingFee: 12,
        shippingService: 'TRACKED_24',
      });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            shippingFee: 12,
            totalAmount: 327,
          }),
        }),
      );
      expect(mockPaymentIntents.update).toHaveBeenCalledWith(
        'pi_test_123',
        expect.objectContaining({
          amount: 32700,
        }),
      );
      expect(result.shippingFee).toBe(12);
    });
  });

  describe('updateOrderStatus', () => {
    it('should disallow invalid transitions and throw BadRequestException', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: 'COMPLETED',
      });

      await expect(
        service.updateOrderStatus('ord-1', { status: 'SHIPPED' as any }),
      ).rejects.toThrow(BadRequestException);
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
