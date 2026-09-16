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
});
