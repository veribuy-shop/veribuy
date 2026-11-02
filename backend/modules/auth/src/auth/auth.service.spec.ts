import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationService } from './notification.service';
import { SmsService } from '../../../notifications/src/notifications/sms.service';
import { SocialTokenVerifierService } from './social-token-verifier.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let notificationService: any;
  let smsService: any;
  let redisService: any;
  let socialVerifier: any;

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
      address: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1', token: 'mock-rt' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };

    socialVerifier = {
      verify: jest.fn(),
    };

    smsService = {
      sendOtp: jest.fn().mockResolvedValue(true),
      sendVerificationOtp: jest.fn().mockResolvedValue(undefined),
      verifyOtp: jest.fn().mockResolvedValue(true),
    };

    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(undefined),
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
        { provide: SocialTokenVerifierService, useValue: socialVerifier },
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

  describe('socialLogin', () => {
    const verifiedAs = (email: string) =>
      socialVerifier.verify.mockResolvedValue({ provider: 'GOOGLE', subject: 'google-sub-1', email });

    it('authenticates only from the verified ID token, never a client-supplied email', async () => {
      socialVerifier.verify.mockRejectedValue(new UnauthorizedException('Invalid identity token'));

      await expect(
        service.socialLogin({
          provider: 'GOOGLE',
          idToken: 'forged-token',
          email: 'admin@veribuy.shop',
          action: 'login',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('uses the token email even if the request names a different account', async () => {
      verifiedAs('attacker@example.com');
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.socialLogin({
          provider: 'GOOGLE',
          idToken: 'valid-token',
          email: 'victim@example.com',
          action: 'login',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'attacker@example.com' } }),
      );
    });

    it('should throw ConflictException if user tries to register with an existing email', async () => {
      verifiedAs('alex@example.com');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-existing',
        name: 'Existing User',
        email: 'alex@example.com',
        role: 'BUYER',
        isActive: true,
        isEmailVerified: true,
      });

      await expect(
        service.socialLogin({ provider: 'GOOGLE', idToken: 'valid-token', action: 'register' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if existing user tries to log in with unverified email', async () => {
      verifiedAs('unverified@example.com');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-unverified',
        name: 'Unverified User',
        email: 'unverified@example.com',
        role: 'BUYER',
        isActive: true,
        isEmailVerified: false,
      });

      await expect(
        service.socialLogin({ provider: 'GOOGLE', idToken: 'valid-token', action: 'login' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('registers a new social user as email-verified (provider verified it) and flags profile completion', async () => {
      verifiedAs('social.new@example.com');
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'usr-new-social',
        name: 'New Social User',
        email: 'social.new@example.com',
        role: 'BUYER',
        referralCode: 'VB-XYZ123',
        isEmailVerified: true,
      });
      prisma.profile.create.mockResolvedValue({ id: 'prof-1' });

      const result = await service.socialLogin({
        provider: 'GOOGLE',
        idToken: 'valid-token',
        name: 'New Social User',
        action: 'register',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'social.new@example.com', isEmailVerified: true }),
        }),
      );
      expect(result.isNewUser).toBe(true);
      expect(result.requiresEmailVerification).toBe(false);
      expect(result.requiresProfileCompletion).toBe(true);
      expect(notificationService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should successfully log in verified social user and compute profile completion', async () => {
      verifiedAs('verified@example.com');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-verified',
        name: 'Verified User',
        email: 'verified@example.com',
        role: 'BUYER',
        isActive: true,
        isEmailVerified: true,
      });

      prisma.profile.findUnique.mockResolvedValue({
        accountType: 'INDIVIDUAL',
        companyName: null,
        avatarUrl: null,
        phone: '+447123456789',
        isPhoneVerified: true,
      });

      prisma.address.findFirst.mockResolvedValue({ id: 'addr-1' });
      prisma.user.update.mockResolvedValue({});

      const result = await service.socialLogin({ provider: 'GOOGLE', idToken: 'valid-token', action: 'login' });

      expect(result.isNewUser).toBe(false);
      expect(result.requiresEmailVerification).toBe(false);
      expect(result.user.profileCompleted).toBe(true);
      expect(result.requiresProfileCompletion).toBe(false);
    });
  });

  describe('deleteOwnAccount', () => {
    const hash = bcrypt.hashSync('Correct1!', 4);

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 'usr-1', passwordHash: hash, role: 'BUYER', isActive: true });
      prisma.order = { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() };
      prisma.listing = { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() };
      prisma.offer = { updateMany: jest.fn() };
      prisma.profile.deleteMany = jest.fn();
      prisma.listingDraft = { deleteMany: jest.fn() };
      prisma.user.update = jest.fn();
      prisma.$transaction = jest.fn((run: (tx: unknown) => unknown) => run(prisma));
    });

    it('rejects the wrong password and changes nothing', async () => {
      await expect(service.deleteOwnAccount('usr-1', 'wrong')).rejects.toThrow('That password is incorrect');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses while an order is in progress, so nobody loses money', async () => {
      prisma.order.count.mockResolvedValue(1);
      await expect(service.deleteOwnAccount('usr-1', 'Correct1!')).rejects.toThrow('orders in progress');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('removes personal details but keeps the row for orders and invoices', async () => {
      await service.deleteOwnAccount('usr-1', 'Correct1!');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Deleted user',
            email: 'deleted-usr-1@deleted.invalid',
            isActive: false,
          }),
        }),
      );
      expect(prisma.profile.deleteMany).toHaveBeenCalledWith({ where: { userId: 'usr-1' } });
      expect(prisma.user.delete).toBeUndefined();
    });
  });

  describe('session security', () => {
    it('stores refresh tokens hashed, never in plaintext', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1', name: 'A', email: 'a@example.com', role: 'BUYER',
        isActive: true, isEmailVerified: true,
        passwordHash: await bcrypt.hash('Password1!', 4),
      });
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'a@example.com', password: 'Password1!' });

      const stored = prisma.refreshToken.create.mock.calls[0][0].data.token;
      expect(stored).not.toBe(result.refreshToken);
      expect(stored).toMatch(/^[0-9a-f]{64}$/);
    });

    it('treats a reuse within the grace window as a benign concurrent refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        revokedAt: new Date(Date.now() - 5_000),
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'usr-1', role: 'BUYER', isActive: true },
      });

      await expect(service.refreshToken('raced-token')).rejects.toThrow(ConflictException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokes every session when a rotated refresh token is reused', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        revokedAt: new Date(Date.now() - 5 * 60_000),
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'usr-1', role: 'BUYER', isActive: true },
      });

      await expect(service.refreshToken('stolen-token')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'usr-1', revokedAt: null } }),
      );
      expect(redisService.set).toHaveBeenCalledWith('auth:revoked-before:usr-1', expect.any(Number), expect.any(Number));
    });

    it('revokes all sessions after a password change', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'usr-1', passwordHash: await bcrypt.hash('OldPass1!', 4) });
      prisma.user.update.mockResolvedValue({});

      await service.changePassword('usr-1', { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'usr-1', revokedAt: null } }),
      );
    });

    it('locks sign-in for an account after repeated failures', async () => {
      redisService.get.mockResolvedValueOnce(10);

      await expect(service.login({ email: 'a@example.com', password: 'whatever' })).rejects.toMatchObject({
        status: 429,
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('does not reveal account state before the password is proven', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1', name: 'A', email: 'a@example.com', role: 'BUYER',
        isActive: false, isEmailVerified: false,
        passwordHash: await bcrypt.hash('Password1!', 4),
      });

      await expect(service.login({ email: 'a@example.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('pruneExpiredRefreshTokens', () => {
    it('deletes only tokens past their expiry and returns the count', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await expect(service.pruneExpiredRefreshTokens()).resolves.toBe(3);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('phone OTP', () => {
    it('never echoes the OTP unless the dev bypass flag is set', async () => {
      const result = await service.sendPhoneOtp({ phone: '07123456789' } as any);
      expect(result).not.toHaveProperty('devOtp');
      const stored = redisService.set.mock.calls.find((c: any[]) => c[0].startsWith('phone_otp:'))[1];
      expect(stored).not.toHaveProperty('otp');
      expect(stored.otpHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects the static dev code without the explicit bypass flag', async () => {
      redisService.get.mockResolvedValue(null);
      await expect(
        service.verifyPhoneOtp({ phone: '07123456789', code: '123456' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
