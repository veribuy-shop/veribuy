import { Test, TestingModule } from '@nestjs/testing';
import { UlistingsService } from './listings.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationClient } from './notification.client';

describe('UlistingsService', () => {
  let service: UlistingsService;
  let prisma: any;
  let redis: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      listing: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      imeiRegistry: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      profile: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UlistingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: NotificationClient, useValue: notifications },
      ],
    }).compile();

    service = module.get<UlistingsService>(UlistingsService);
  });

  describe('create', () => {
    it('should create an individual listing with PENDING trust status', async () => {
      const mockListing = {
        id: 'lst-1',
        sellerId: 'seller-1',
        title: 'iPhone 15',
        deviceType: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 15',
        price: 650,
        currency: 'GBP',
        isBulkListing: false,
        quantity: 1,
        freeShipping: false,
        trustLensStatus: 'PENDING',
      };

      prisma.listing.create.mockResolvedValue(mockListing);

      const result = await service.create({
        sellerId: 'seller-1',
        title: 'iPhone 15',
        description: 'Excellent condition',
        deviceType: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 15',
        price: 650,
        currency: 'GBP',
        conditionGrade: 'A',
        isBulkListing: false,
        freeShipping: false,
      });

      expect(prisma.listing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: 'seller-1',
            trustLensStatus: 'PENDING',
            isBulkListing: false,
            quantity: 1,
            freeShipping: false,
          }),
        }),
      );
      expect(result).toEqual(mockListing);
    });

    it('should create a business bulk listing with PASSED trust status and multi-unit quantity', async () => {
      const mockBulkListing = {
        id: 'lst-bulk-1',
        sellerId: 'seller-biz',
        title: 'Batch iPhone 14 Pro Max (Grade A)',
        deviceType: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 14 Pro Max',
        price: 550,
        currency: 'GBP',
        isBulkListing: true,
        quantity: 15,
        freeShipping: true,
        trustLensStatus: 'PASSED',
        storageCapacity: '256GB',
        color: 'Space Black',
      };

      prisma.listing.create.mockResolvedValue(mockBulkListing);

      const result = await service.create({
        sellerId: 'seller-biz',
        title: 'Batch iPhone 14 Pro Max (Grade A)',
        description: 'Wholesale batch',
        deviceType: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 14 Pro Max',
        price: 550,
        currency: 'GBP',
        conditionGrade: 'A',
        isBulkListing: true,
        quantity: 15,
        freeShipping: true,
        storageCapacity: '256GB',
        color: 'Space Black',
      });

      expect(prisma.listing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: 'seller-biz',
            trustLensStatus: 'PASSED',
            isBulkListing: true,
            quantity: 15,
            freeShipping: true,
            storageCapacity: '256GB',
            color: 'Space Black',
          }),
        }),
      );
      expect(result.trustLensStatus).toBe('PASSED');
      expect(result.quantity).toBe(15);
    });
    it('should create an AUCTION listing with starting bid and calculated endsAt', async () => {
      const mockAuctionListing = {
        id: 'lst-auc-1',
        sellerId: 'seller-1',
        title: 'Apple iPad Pro 12.9" (Auction)',
        deviceType: 'TABLET',
        brand: 'Apple',
        model: 'iPad Pro',
        price: 0.99,
        format: 'AUCTION',
        startingBid: 0.99,
        reservePrice: 200,
        currentBid: 0.99,
        bidCount: 0,
        auctionEndsAt: new Date(Date.now() + 7 * 86400000),
        status: 'DRAFT',
        trustLensStatus: 'PENDING',
      };

      prisma.listing.create.mockResolvedValue(mockAuctionListing);

      const result = await service.create({
        sellerId: 'seller-1',
        title: 'Apple iPad Pro 12.9" (Auction)',
        description: 'Pristine condition, boxing included',
        deviceType: 'TABLET',
        brand: 'Apple',
        model: 'iPad Pro',
        price: 0.99,
        format: 'AUCTION' as any,
        startingBid: 0.99,
        reservePrice: 200,
        durationDays: 7,
        conditionGrade: 'A',
      });

      expect(prisma.listing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: 'seller-1',
            format: 'AUCTION',
            startingBid: 0.99,
            reservePrice: 200,
            currentBid: 0.99,
          }),
        }),
      );
      expect(result.format).toBe('AUCTION');
    });
  });

  describe('placeBid', () => {
    it('should reject bids on non-auction listings', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-fixed',
        sellerId: 'seller-1',
        format: 'FIXED_PRICE',
        status: 'ACTIVE',
      });

      await expect(
        service.placeBid('lst-fixed', 'bidder-1', 100),
      ).rejects.toThrow('Bids can only be placed on auction listings');
    });

    it('should prevent seller from bidding on their own listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-auc',
        sellerId: 'seller-1',
        format: 'AUCTION',
        status: 'ACTIVE',
        auctionEndsAt: new Date(Date.now() + 86400000),
      });

      await expect(
        service.placeBid('lst-auc', 'seller-1', 100),
      ).rejects.toThrow('Sellers cannot bid on their own listings');
    });

    it('should place opening bid at starting bid when meeting reserve', async () => {
      const endsAt = new Date(Date.now() + 86400000);
      const activeAuction = {
        id: 'lst-auc',
        sellerId: 'seller-1',
        format: 'AUCTION',
        status: 'ACTIVE',
        startingBid: 0.99,
        currentBid: 0.99,
        highestBidderId: null,
        highestMaxBid: null,
        reservePrice: null,
        bidCount: 0,
        auctionEndsAt: endsAt,
        title: 'MacBook Pro M3',
      };

      prisma.listing.findUnique.mockResolvedValue(activeAuction);
      prisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        return cb({
          listing: {
            findUnique: jest.fn().mockResolvedValue(activeAuction),
            update: jest.fn().mockResolvedValue({
              ...activeAuction,
              currentBid: 0.99,
              highestBidderId: 'bidder-1',
              highestMaxBid: 50.0,
              bidCount: 1,
            }),
          },
          bid: {
            create: jest.fn().mockResolvedValue({ id: 'bid-1' }),
          },
        });
      });

      const result = await service.placeBid('lst-auc', 'bidder-1', 50.0);

      expect(result.success).toBe(true);
      expect(result.isLeading).toBe(true);
      expect(result.currentBid).toBe(0.99);
    });

    it('should trigger anti-sniping soft close when bid placed within last 2 minutes', async () => {
      const endsAt = new Date(Date.now() + 60 * 1000); // 1 min remaining
      const activeAuction = {
        id: 'lst-auc',
        sellerId: 'seller-1',
        format: 'AUCTION',
        status: 'ACTIVE',
        startingBid: 10.0,
        currentBid: 10.0,
        highestBidderId: null,
        highestMaxBid: null,
        reservePrice: null,
        bidCount: 0,
        auctionEndsAt: endsAt,
        title: 'Sony PS5',
      };

      prisma.listing.findUnique.mockResolvedValue(activeAuction);
      let capturedEndsAt: Date | undefined;
      prisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        return cb({
          listing: {
            findUnique: jest.fn().mockResolvedValue(activeAuction),
            update: jest.fn().mockImplementation(({ data }) => {
              capturedEndsAt = data.auctionEndsAt;
              return {
                ...activeAuction,
                currentBid: 10.0,
                highestBidderId: 'bidder-snip',
                bidCount: 1,
                auctionEndsAt: data.auctionEndsAt,
              };
            }),
          },
          bid: {
            create: jest.fn().mockResolvedValue({ id: 'bid-snip' }),
          },
        });
      });

      const result = await service.placeBid('lst-auc', 'bidder-snip', 25.0);

      expect(result.extended).toBe(true);
      expect(capturedEndsAt!.getTime()).toBeGreaterThan(endsAt.getTime());
    });
  });

  describe('updateStatusInternal', () => {
    it('should decrement quantity and remain ACTIVE when a multi-unit listing is sold', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-bulk-1',
        quantity: 5,
        status: 'ACTIVE',
      });

      prisma.listing.update.mockResolvedValue({
        id: 'lst-bulk-1',
        quantity: 4,
        status: 'ACTIVE',
      });

      const result = await service.updateStatusInternal('lst-bulk-1', 'SOLD' as any);

      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lst-bulk-1' },
          data: expect.objectContaining({
            quantity: { decrement: 1 },
            status: 'ACTIVE',
          }),
        }),
      );
      expect(result.quantity).toBe(4);
      expect(result.status).toBe('ACTIVE');
    });

    it('should transition to SOLD when single-unit listing (quantity <= 1) is sold', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-single',
        quantity: 1,
        status: 'ACTIVE',
      });

      prisma.listing.update.mockResolvedValue({
        id: 'lst-single',
        quantity: 1,
        status: 'SOLD',
      });

      const result = await service.updateStatusInternal('lst-single', 'SOLD' as any);

      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lst-single' },
          data: expect.objectContaining({
            status: 'SOLD',
          }),
        }),
      );
      expect(result.status).toBe('SOLD');
    });
  });
});
