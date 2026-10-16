import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationService } from './notification.service';
import { SmsService } from '../../../notifications/src/notifications/sms.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let notificationService: any;
  let smsService: any;
  let redisService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      profile: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1', token: 'mock-rt' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      referral: {
        create: jest.fn().mockResolvedValue({ id: 'ref-1' }),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTO_VERIFY_EMAIL') return 'true';
        if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return null;
      }),
    };

    notificationService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
    };

    smsService = {
      sendOtp: jest.fn().mockResolvedValue(true),
      verifyOtp: jest.fn().mockResolvedValue(true),
    };

    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: NotificationService, useValue: notificationService },
        { provide: SmsService, useValue: smsService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register an INDIVIDUAL user and create profile and tokens', async () => {
      const mockCreatedUser = {
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'BUYER',
      };

      prisma.user.create.mockResolvedValue(mockCreatedUser);
      prisma.profile.create.mockResolvedValue({ id: 'prof-1', userId: 'usr-1', accountType: 'INDIVIDUAL' });

      const result = await service.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        accountType: 'INDIVIDUAL',
        phone: '+447123456789',
        line1: '10 Downing St',
        city: 'London',
        state: 'Greater London',
        postalCode: 'SW1A 2AA',
        country: 'GB',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.profile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'usr-1',
            accountType: 'INDIVIDUAL',
            phone: '+447123456789',
          }),
        }),
      );
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('john@example.com');
      expect(result).toHaveProperty('accessToken');
    });

    it('should register a BUSINESS user with company name, number, and VAT', async () => {
      const mockCreatedUser = {
        id: 'biz-1',
        name: 'Jane Smith',
        email: 'jane@electronicsltd.co.uk',
        role: 'SELLER',
      };

      prisma.user.create.mockResolvedValue(mockCreatedUser);
      prisma.profile.create.mockResolvedValue({
        id: 'prof-2',
        userId: 'biz-1',
        accountType: 'BUSINESS',
        companyName: 'Electronics Direct Ltd',
        companyNumber: '12345678',
        vatNumber: 'GB123456789',
      });

      const result = await service.register({
        name: 'Jane Smith',
        email: 'jane@electronicsltd.co.uk',
        password: 'SecureBizPassword123!',
        accountType: 'BUSINESS',
        companyName: 'Electronics Direct Ltd',
        companyNumber: '12345678',
        vatNumber: 'GB123456789',
        phone: '+447987654321',
        line1: '1 Commerce Way',
        city: 'Manchester',
        state: 'Greater Manchester',
        postalCode: 'M1 1AA',
        country: 'GB',
      });

      expect(prisma.profile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'biz-1',
            displayName: 'Electronics Direct Ltd',
            accountType: 'BUSINESS',
            companyName: 'Electronics Direct Ltd',
            companyNumber: '12345678',
            vatNumber: 'GB123456789',
          }),
        }),
      );
      expect(result.user.accountType).toBe('BUSINESS');
      expect(result.user.companyName).toBe('Electronics Direct Ltd');
    });

    it('should link referrer and create pending referral when referralCode is provided', async () => {
      const mockReferrer = { id: 'referrer-1', name: 'Alice Referral' };
      prisma.user.findUnique.mockResolvedValue(mockReferrer);
      prisma.user.create.mockResolvedValue({
        id: 'referred-1',
        name: 'Bob Newbie',
        email: 'bob@example.com',
        role: 'BUYER',
        referralCode: 'VB-BOB123',
      });
      prisma.profile.create.mockResolvedValue({ id: 'prof-bob', userId: 'referred-1' });

      const result = await service.register({
        name: 'Bob Newbie',
        email: 'bob@example.com',
        password: 'Password123!',
        phone: '+447111222333',
        line1: '1 Oxford St',
        city: 'London',
        postalCode: 'W1D 1BS',
        referralCode: 'VB-ALICE1',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'VB-ALICE1' },
        select: { id: true, name: true },
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referredById: 'referrer-1',
          }),
        }),
      );
      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerId: 'referrer-1',
          referredId: 'referred-1',
          status: 'PENDING',
          rewardAmount: 5.0,
          currency: 'GBP',
        },
      });
      expect(result.user).toHaveProperty('referralCode');
    });

    it('should throw ConflictException if email is already taken', async () => {
      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.register({
          name: 'Existing User',
          email: 'duplicate@example.com',
          password: 'Password123!',
          phone: '+447000000000',
          line1: '1 Main St',
          city: 'London',
          postalCode: 'EC1A 1BB',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      const mockUser = {
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash,
        isActive: true,
        isEmailVerified: true,
        role: 'BUYER',
        profile: {
          accountType: 'INDIVIDUAL',
          companyName: null,
          city: 'London',
          state: 'Greater London',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'john@example.com',
        password: 'CorrectPassword123!',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      const mockUser = {
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash,
        isEmailVerified: true,
        role: 'BUYER',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
