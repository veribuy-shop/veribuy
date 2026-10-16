import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      profile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      referral: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findByUserId', () => {
    it('should return profile from database when not cached', async () => {
      const mockProfile = {
        id: 'prof-1',
        userId: 'usr-1',
        displayName: 'Electronics UK',
        phone: '+447000000000',
        sellerRating: 4.8,
        totalSales: 12,
        totalPurchases: 2,
      };

      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.findByUserId('usr-1');

      expect(prisma.profile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'usr-1' },
        }),
      );
      expect(result).toEqual(mockProfile);
      expect(redis.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if neither profile nor user exists', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile and invalidate Redis cache', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        id: 'prof-1',
        userId: 'usr-1',
      });

      const updatedMock = {
        id: 'prof-1',
        userId: 'usr-1',
        displayName: 'Updated Electronics Ltd',
        bio: 'Certified refurbisher',
      };

      prisma.profile.upsert.mockResolvedValue(updatedMock);

      const result = await service.updateProfile('usr-1', {
        displayName: 'Updated Electronics Ltd',
        bio: 'Certified refurbisher',
      });

      expect(prisma.profile.upsert).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('profile:usr-1');
      expect(result).toEqual(updatedMock);
    });
  });

  describe('getReferralDetails', () => {
    it('should return user referral code and referral stats', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1',
        name: 'Jane Doe',
        referralCode: 'VB-JANE1',
      });
      prisma.profile.findUnique.mockResolvedValue({
        referralBonusBalance: 15.0,
      });
      prisma.referral.findMany.mockResolvedValue([
        {
          id: 'ref-1',
          referrerId: 'usr-1',
          referredId: 'usr-2',
          status: 'QUALIFIED',
          rewardAmount: 5.0,
          currency: 'GBP',
          createdAt: new Date(),
          qualifiedAt: new Date(),
          referred: { name: 'Bob Smith', profile: { displayName: 'Bob' } },
          qualifyingOrder: { listingTitle: 'iPhone 15 Pro' },
        },
        {
          id: 'ref-2',
          referrerId: 'usr-1',
          referredId: 'usr-3',
          status: 'PENDING',
          rewardAmount: 5.0,
          currency: 'GBP',
          createdAt: new Date(),
          referred: { name: 'Charlie', profile: null },
        },
      ]);

      const result = await service.getReferralDetails('usr-1');

      expect(result.referralCode).toBe('VB-JANE1');
      expect(result.stats.totalReferred).toBe(2);
      expect(result.stats.qualifiedCount).toBe(1);
      expect(result.stats.pendingCount).toBe(1);
      expect(result.stats.totalEarned).toBe(15.0);
      expect(result.referrals.length).toBe(2);
      expect(result.referrals[0].referredName).toBe('Bob');
    });
  });

  describe('validateReferralCode', () => {
    it('should return valid true when referral code exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1',
        name: 'Alice Wonder',
        profile: { displayName: 'Alice' },
      });

      const result = await service.validateReferralCode('VB-ALICE1');

      expect(result.valid).toBe(true);
      expect(result.referrerName).toBe('Alice');
    });

    it('should return valid false when referral code is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateReferralCode('INVALID');

      expect(result.valid).toBe(false);
    });
  });
});
