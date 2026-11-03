import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        updateMany: jest.fn(),
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
      verificationRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
      },
      message: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      emit: jest.fn(),
      notifyListingStatusChanged: jest.fn().mockResolvedValue(undefined),
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

    it('creates a business bulk listing as unverified (PENDING) with multi-unit quantity', async () => {
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
        trustLensStatus: 'PENDING',
        storageCapacity: '256GB',
        color: 'Space Black',
      };

      prisma.listing.create.mockResolvedValue(mockBulkListing);
      prisma.profile.findUnique.mockResolvedValue({ accountType: 'BUSINESS' });

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
            trustLensStatus: 'PENDING',
            isBulkListing: true,
            quantity: 15,
            freeShipping: true,
            storageCapacity: '256GB',
            color: 'Space Black',
          }),
        }),
      );
      expect(result.quantity).toBe(15);
    });

    it('refuses bulk listings from non-business accounts', async () => {
      prisma.profile.findUnique.mockResolvedValue({ accountType: 'INDIVIDUAL' });

      await expect(
        service.create({
          sellerId: 'seller-1',
          title: 'Fake bulk to skip verification',
          description: 'x'.repeat(60),
          deviceType: 'SMARTPHONE',
          brand: 'Apple',
          model: 'iPhone 14',
          price: 500,
          conditionGrade: 'A',
          isBulkListing: true,
          quantity: 5,
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.listing.create).not.toHaveBeenCalled();
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

  describe('listing drafts', () => {
    it('never stores identifiers or unknown fields', async () => {
      prisma.listingDraft = { upsert: jest.fn().mockResolvedValue({}) };

      await service.saveDraft(
        'user-1',
        { title: 'iPhone 14', imei: '490154203237518', serialNumber: 'ABC123', sellerId: 'other', freeShipping: true },
        2,
      );

      const { create, update } = prisma.listingDraft.upsert.mock.calls[0][0];
      expect(create).toEqual({ userId: 'user-1', data: { title: 'iPhone 14', freeShipping: true }, step: 2 });
      expect(update.data).toEqual({ title: 'iPhone 14', freeShipping: true });
    });
  });

  describe('duplicate listings', () => {
    const dto: any = { sellerId: 'seller-1', title: 'iPhone 13', imei: '35-693803-564380-9', price: 100 };

    it('refuses a second open listing for the same IMEI', async () => {
      prisma.listing.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow('already have a listing');
      expect(prisma.listing.findFirst.mock.calls[0][0].where.OR).toEqual([{ imei: '356938035643809' }]);
      expect(prisma.listing.create).not.toHaveBeenCalled();
    });

    it('only treats a repeated title as a duplicate within minutes when there is no identifier', async () => {
      prisma.listing.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create({ sellerId: 'seller-1', title: 'iPhone 13', price: 100 } as any)).rejects.toThrow('already have');
      const where = prisma.listing.findFirst.mock.calls[0][0].where;
      expect(where.title).toBe('iPhone 13');
      expect(where.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('releaseUnpaidAuctions', () => {
    const lapsed = {
      id: 'lst-auc',
      title: 'Pixel 8',
      sellerId: 'seller-1',
      highestBidderId: 'winner-1',
      currentBid: 200,
      reservePrice: null,
    };

    it('cancels the win and tells both people', async () => {
      prisma.listing.findMany.mockResolvedValue([lapsed]);
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.releaseUnpaidAuctions()).resolves.toBe(1);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: { id: 'lst-auc', status: 'AUCTION_ENDED' },
        data: { status: 'DELISTED', highestBidderId: null, highestMaxBid: null },
      });
      const recipients = prisma.message.create.mock.calls.map((c: any[]) => c[0].data.recipientId);
      expect(recipients).toEqual(['winner-1', 'seller-1']);
    });

    it('sends nothing when another run already released it', async () => {
      prisma.listing.findMany.mockResolvedValue([lapsed]);
      prisma.listing.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.releaseUnpaidAuctions()).resolves.toBe(0);
      expect(prisma.message.create).not.toHaveBeenCalled();
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
          $queryRaw: jest.fn().mockResolvedValue([]),
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

    it('tells the previous leader in-app and by email when they are outbid', async () => {
      const activeAuction = {
        id: 'lst-auc',
        sellerId: 'seller-1',
        title: 'Pixel 8',
        format: 'AUCTION',
        status: 'ACTIVE',
        startingBid: 10.0,
        currentBid: 20.0,
        highestBidderId: 'bidder-old',
        highestMaxBid: 25.0,
        bidCount: 1,
        auctionEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      };
      prisma.listing.findUnique.mockResolvedValue(activeAuction);
      notifications.notifyOutbid = jest.fn();
      prisma.$transaction = jest.fn().mockImplementation(async (cb: any) =>
        cb({
          $queryRaw: jest.fn().mockResolvedValue([]),
          listing: {
            findUnique: jest.fn().mockResolvedValue(activeAuction),
            update: jest.fn().mockResolvedValue({ ...activeAuction, bidCount: 2 }),
          },
          bid: { create: jest.fn().mockResolvedValue({ id: 'bid-2' }) },
        }),
      );

      const result = await service.placeBid('lst-auc', 'bidder-new', 100);

      expect(result.isLeading).toBe(true);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: 'bidder-old',
          listingId: 'lst-auc',
          subject: 'You’ve been outbid',
          isSystem: true,
        }),
      });
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
          $queryRaw: jest.fn().mockResolvedValue([]),
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

  describe('seller listing controls (verification bypass protection)', () => {
    const base = { id: 'lst-1', trustLensStatus: 'PENDING' } as any;

    it('forbids a seller from moving their own listing into review or approval', async () => {
      await expect(
        service.assertSellerTransition({ ...base, status: 'SUBMITTED' }, 'UNDER_REVIEW' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assertSellerTransition({ ...base, status: 'UNDER_REVIEW' }, 'ACTIVE' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids reactivating a listing that never passed TrustLens', async () => {
      await expect(
        service.assertSellerTransition({ ...base, status: 'DELISTED' }, 'ACTIVE' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids reactivating while a buyer is checking out', async () => {
      prisma.order.count.mockResolvedValueOnce(1);
      await expect(
        service.assertSellerTransition(
          { ...base, status: 'INACTIVE', trustLensStatus: 'PASSED' },
          'ACTIVE' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows pausing and reactivating a verified listing', async () => {
      await expect(
        service.assertSellerTransition({ ...base, status: 'ACTIVE', trustLensStatus: 'PASSED' }, 'INACTIVE' as any),
      ).resolves.toBeUndefined();
      await expect(
        service.assertSellerTransition({ ...base, status: 'INACTIVE', trustLensStatus: 'PASSED' }, 'ACTIVE' as any),
      ).resolves.toBeUndefined();
    });

    it('does not mark verification PASSED when a seller reactivates', async () => {
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst-1', sellerId: 'seller-1', status: 'ACTIVE' });

      await service.updateStatus('lst-1', 'ACTIVE' as any, 'INACTIVE' as any, false);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: { id: 'lst-1', status: 'INACTIVE' },
        data: expect.not.objectContaining({ trustLensStatus: 'PASSED' }),
      });
      expect(prisma.verificationRequest.updateMany).not.toHaveBeenCalled();
    });

    it('sends a verified listing back to review when the seller changes its description', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-1',
        status: 'ACTIVE',
        trustLensStatus: 'PASSED',
        title: 'iPhone 14',
        description: 'Mint condition',
        conditionGrade: 'A',
      });
      prisma.listing.update.mockResolvedValue({ id: 'lst-1' });

      await service.update('lst-1', { description: 'Mint condition, no scratches' } as any, false);

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'lst-1' },
        data: expect.objectContaining({ status: 'UNDER_REVIEW', trustLensStatus: 'REQUIRES_REVIEW' }),
      });
    });

    it('refuses a price change once an auction has bids', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-auc',
        status: 'ACTIVE',
        format: 'AUCTION',
        bidCount: 2,
        price: 100,
        trustLensStatus: 'PASSED',
      });

      await expect(service.update('lst-auc', { price: 50 } as any)).rejects.toThrow('once bidding has started');
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('lets the seller change only the price without re-review', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-1',
        status: 'ACTIVE',
        trustLensStatus: 'PASSED',
        price: 500,
      });
      prisma.listing.update.mockResolvedValue({ id: 'lst-1' });

      await service.update('lst-1', { price: 450 } as any, false);

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'lst-1' },
        data: expect.not.objectContaining({ status: expect.anything() }),
      });
    });
  });

  describe('updateTrustLensStatus (state-aware)', () => {
    const run = async (current: string, result: string) => {
      prisma.listing.findUnique.mockResolvedValue({ status: current });
      prisma.listing.update.mockResolvedValue({ id: 'lst-1' });
      await service.updateTrustLensStatus('lst-1', result as any);
      return prisma.listing.update.mock.calls.at(-1)[0].data;
    };

    it('publishes a listing awaiting verification when it passes', async () => {
      expect(await run('SUBMITTED', 'PASSED')).toMatchObject({ status: 'ACTIVE' });
    });

    it('never resurrects a sold, delisted or reserved listing on a passing re-run', async () => {
      for (const status of ['SOLD', 'DELISTED', 'INACTIVE']) {
        expect(await run(status, 'PASSED')).not.toHaveProperty('status');
      }
    });

    it('takes a live listing off sale when a re-run flags it for review', async () => {
      expect(await run('ACTIVE', 'REQUIRES_REVIEW')).toMatchObject({ status: 'UNDER_REVIEW' });
    });

    it('rejects a failed listing unless it already sold', async () => {
      expect(await run('ACTIVE', 'FAILED')).toMatchObject({ status: 'REJECTED' });
      expect(await run('SOLD', 'FAILED')).not.toHaveProperty('status');
    });
  });

  describe('updateStatus', () => {
    it('should update listing status to ACTIVE, set trustLensStatus to PASSED, and update verification request', async () => {
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });
      prisma.listing.findUnique.mockResolvedValue({
        id: 'lst-100',
        sellerId: 'seller-1',
        title: 'iPhone 14',
        status: 'ACTIVE',
        trustLensStatus: 'PASSED',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'seller-1',
        email: 'seller@example.com',
        name: 'Seller One',
      });

      const result = await service.updateStatus('lst-100', 'ACTIVE' as any, 'UNDER_REVIEW' as any, true);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: { id: 'lst-100', status: 'UNDER_REVIEW' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          trustLensStatus: 'PASSED',
          publishedAt: expect.any(Date),
        }),
      });

      expect(prisma.verificationRequest.updateMany).toHaveBeenCalledWith({
        where: { listingId: 'lst-100', status: { not: 'PASSED' } },
        data: expect.objectContaining({
          status: 'PASSED',
          reviewNotes: expect.stringContaining('Activated'),
        }),
      });

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw BadRequestException if concurrent status change occurs', async () => {
      prisma.listing.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus('lst-100', 'ACTIVE' as any, 'UNDER_REVIEW' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
