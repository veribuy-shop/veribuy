import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationService } from './notification.service';
import { SmsService } from '../../../notifications/src/notifications/sms.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SocialAuthDto } from './dto/social-auth.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { SocialTokenVerifierService } from './social-token-verifier.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';

// Typed interface for the authenticated user (from JWT)
interface AuthenticatedUser {
  userId: string;
  role: string;
}

/** Redis key holding the epoch-ms before which all access tokens for a user are rejected. */
export const sessionRevokedBeforeKey = (userId: string) => `auth:revoked-before:${userId}`;
/** Redis key caching a user's live auth state (role / active / verified) for the JWT strategy. */
export const userAuthStateKey = (userId: string) => `auth:user-state:${userId}`;

/** Refresh tokens are stored as SHA-256 hashes so a DB leak cannot be replayed. */
export const hashRefreshToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Constant-time-ish login: compare against a dummy hash when the user doesn't exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('veribuy-dummy-password-for-timing', 12);

// Two tabs (or the middleware and the client) can legitimately refresh with the
// same token at once. A reuse inside this window is a benign race, not theft.
const REFRESH_REUSE_GRACE_MS = 30_000;

const LOGIN_MAX_FAILURES = 10;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

const OTP_TTL_SECONDS = 300;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_SENDS_PER_HOUR = 5;
// Longest access-token lifetime we expect; revocation markers live at least this long.
const SESSION_REVOCATION_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notification: NotificationService,
    private smsService: SmsService,
    private redis: RedisService,
    private socialTokenVerifier: SocialTokenVerifierService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Dev-mode bypass: AUTO_VERIFY_EMAIL=true skips email verification entirely
    const autoVerify =
      this.configService.get<string>('AUTO_VERIFY_EMAIL')?.toLowerCase() === 'true';

    // Generate a raw verification token; store its SHA-256 hash in the DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Generate a unique referral code for this user and lookup inviter if provided
    let referredById: string | null = null;
    if (dto.referralCode) {
      try {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: dto.referralCode.trim().toUpperCase() },
          select: { id: true, name: true },
        });
        if (referrer) {
          referredById = referrer.id;
        }
      } catch (err: any) {
        this.logger.warn(`Referral lookup failed for code ${dto.referralCode}: ${err?.message}`);
      }
    }

    const newReferralCode = 'VB-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    let user: { id: string; name: string; email: string; role: string; referralCode?: string | null };
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          isEmailVerified: autoVerify,
          referralCode: newReferralCode,
          referredById: referredById || null,
          ...(autoVerify
            ? {}
            : {
                emailVerificationToken: tokenHash,
                emailVerificationExpiry: tokenExpiry,
              }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          referralCode: true,
        },
      });

      // If registered with a valid referral, create pending referral record
      if (referredById) {
        await this.prisma.referral.create({
          data: {
            referrerId: referredById,
            referredId: user.id,
            status: 'PENDING',
            rewardAmount: 5.00,
            currency: 'GBP',
          },
        }).catch((refErr) => {
          this.logger.warn(`Failed to create pending referral record for ${user.id}: ${refErr?.message}`);
        });
      }

      // Auto-create user profile and address with required full address & phone
      await this.prisma.profile.create({
        data: {
          userId: user.id,
          displayName: dto.companyName && dto.accountType === 'BUSINESS' ? dto.companyName : dto.name,
          phone: dto.phone || null,
          accountType: dto.accountType || 'INDIVIDUAL',
          companyName: dto.companyName || null,
          companyNumber: dto.companyNumber || null,
          vatNumber: dto.vatNumber || null,
          ...(dto.line1 && dto.city
            ? {
                address: {
                  create: {
                    line1: dto.line1,
                    line2: dto.line2 || null,
                    city: dto.city,
                    state: dto.state || dto.city,
                    postalCode: dto.postalCode || '',
                    country: dto.country || 'United Kingdom',
                  },
                },
              }
            : {}),
        },
      }).catch((profileErr) => {
        this.logger.warn(`Failed to auto-create initial profile for ${user.id}: ${profileErr?.message}`);
      });
    } catch (err: any) {
      // P2002 = unique constraint violation (email already exists)
      if (err?.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    if (autoVerify) {
      this.logger.warn(
        `AUTO_VERIFY_EMAIL is enabled — user ${user.email} was auto-verified (dev mode)`,
      );
    } else {
      // Fire verification email (fire-and-forget — never block registration)
      this.notification
        .sendVerificationEmail(user.email, user.name, rawToken)
        .catch((err) =>
          this.logger.error(`Failed to send verification email to ${user.email}: ${err?.message}`),
        );
    }

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode || newReferralCode,
        accountType: dto.accountType || 'INDIVIDUAL',
        companyName: dto.companyName || null,
      },
      autoVerified: autoVerify,
      ...tokens,
    };
  }

  /**
   * First-use bootstrap: creates the first ADMIN user.
   *
   * Secure by design:
   *  - Requires ADMIN_SETUP_TOKEN in env (constant-time compared).
   *  - Only works while NO admin user exists yet, so it cannot be re-run to
   *    escalate later — even if the token or endpoint is exposed.
   *  - Returns 503 when ADMIN_SETUP_TOKEN is not configured (inert by default).
   */
  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const expectedToken = this.configService.get<string>('ADMIN_SETUP_TOKEN');
    if (!expectedToken) {
      throw new ServiceUnavailableException('Admin bootstrap is not configured');
    }
    if (!this.matchesSetupToken(dto.setupToken, expectedToken)) {
      throw new ForbiddenException('Invalid admin bootstrap token');
    }

    const existingAdminCount = await this.prisma.user.count({
      where: { role: 'ADMIN' },
    });
    if (existingAdminCount > 0) {
      throw new ConflictException(
        'Admin bootstrap is only available before the first admin exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'ADMIN',
        isEmailVerified: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await this.prisma.profile.create({
      data: {
        userId: user.id,
        displayName: dto.name,
        firstName: dto.name.split(' ')[0],
        lastName: dto.name.split(' ').slice(1).join(' ') || null,
      },
    });

    this.logger.log(`Bootstrapped first admin user: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.role);

    // Fire-and-forget welcome email — never block bootstrap on delivery
    this.notification
      .sendWelcomeEmail(user.email, user.name)
      .catch((err) =>
        this.logger.error(`Failed to send welcome email to ${user.email}: ${err?.message}`),
      );

    return { user, ...tokens };
  }

  private matchesSetupToken(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  async login(dto: LoginDto) {
    // Per-account brute-force protection, independent of the caller's IP.
    const failureKey = `login_fail:${dto.email}`;
    const failures = Number((await this.redis.get<number>(failureKey).catch(() => 0)) ?? 0);
    if (failures >= LOGIN_MAX_FAILURES) {
      throw new HttpException(
        'Too many failed sign-in attempts. Please wait 15 minutes or reset your password.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Explicit select: passwordHash is required for comparison here, but
    // verification/reset tokens are never loaded.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        passwordHash: true,
      },
    });

    // Always run bcrypt so response timing doesn't reveal whether the email exists,
    // and only disclose account state after the password has been proven.
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid) {
      await this.incrementCounter(failureKey, LOGIN_LOCKOUT_SECONDS).catch(() => 0);
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.redis.del(failureKey).catch(() => undefined);

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email address before logging in');
    }

    const [profile] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId: user.id },
        select: { accountType: true, companyName: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountType: profile?.accountType || 'INDIVIDUAL',
        companyName: profile?.companyName || null,
      },
      ...tokens,
    };
  }

  async socialLogin(dto: SocialAuthDto) {
    // SECURITY: the email comes only from the provider-verified ID token.
    const identity = await this.socialTokenVerifier.verify(dto.provider, dto.idToken);
    const email = identity.email;
    const avatarUrl = dto.avatarUrl && /^https:\/\//i.test(dto.avatarUrl) ? dto.avatarUrl : null;
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
      },
    });

    if (existingUser) {
      // 1. Strict Conflict check: If user clicked "register" / "sign up" with social,
      // prevent silent login into existing accounts.
      if (dto.action === 'register') {
        throw new ConflictException(
          'An account with this email address already exists. Please sign in instead.',
        );
      }

      if (!existingUser.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }

      // 2. Strict Email Verification check:
      // Even with social login, require verification from our own platform if not verified.
      if (!existingUser.isEmailVerified) {
        throw new ForbiddenException(
          'Please verify your email address before logging in. Check your inbox for the verification link.',
        );
      }

      const [profile, address] = await Promise.all([
        this.prisma.profile.findUnique({
          where: { userId: existingUser.id },
          select: {
            accountType: true,
            companyName: true,
            avatarUrl: true,
            phone: true,
            isPhoneVerified: true,
          },
        }),
        this.prisma.address.findFirst({
          where: { profile: { userId: existingUser.id } },
          select: { id: true },
        }),
        this.prisma.user.update({
          where: { id: existingUser.id },
          data: { lastLoginAt: new Date() },
        }),
      ]);

      const isProfileComplete = Boolean(profile?.phone && address?.id);
      const tokens = await this.generateTokens(existingUser.id, existingUser.role);

      return {
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          accountType: profile?.accountType || 'INDIVIDUAL',
          companyName: profile?.companyName || null,
          avatarUrl: profile?.avatarUrl || avatarUrl,
          isEmailVerified: existingUser.isEmailVerified,
          isPhoneVerified: Boolean(profile?.isPhoneVerified),
          profileCompleted: isProfileComplete,
        },
        ...tokens,
        isNewUser: false,
        requiresEmailVerification: false,
        requiresProfileCompletion: !isProfileComplete,
      };
    }

    // If attempting to log in, but no account exists, require sign-up
    if (dto.action === 'login') {
      throw new NotFoundException(
        'No account found with this email. Please sign up first.',
      );
    }

    // New user sign up via Google / Apple. The provider has already verified
    // ownership of the email address (email_verified claim), so no extra
    // verification email is needed.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    let referredById: string | null = null;
    if (dto.referralCode) {
      try {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: dto.referralCode.trim().toUpperCase() },
          select: { id: true, name: true },
        });
        if (referrer) {
          referredById = referrer.id;
        }
      } catch (err: any) {
        this.logger.warn(`Referral lookup failed for social signup code ${dto.referralCode}: ${err?.message}`);
      }
    }

    const newReferralCode = 'VB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const displayName = dto.name?.trim() || identity.name?.trim() || email.split('@')[0];

    let newUser: {
      id: string;
      name: string;
      email: string;
      role: string;
      referralCode: string | null;
      isEmailVerified: boolean;
    };

    try {
      newUser = await this.prisma.user.create({
        data: {
          name: displayName,
          email,
          passwordHash,
          isEmailVerified: true,
          referralCode: newReferralCode,
          referredById: referredById || null,
          lastLoginAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          referralCode: true,
          isEmailVerified: true,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('An account with this email address already exists. Please sign in instead.');
      }
      throw err;
    }

    // Create default profile for newly registered social account
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || null;

    await this.prisma.profile.create({
      data: {
        userId: newUser.id,
        displayName,
        firstName,
        lastName,
        avatarUrl,
        accountType: 'INDIVIDUAL',
      },
    }).catch((profileErr) => {
      this.logger.warn(`Failed to create initial profile for social user ${newUser.id}: ${profileErr?.message}`);
    });

    if (referredById) {
      await this.prisma.referral.create({
        data: {
          referrerId: referredById,
          referredId: newUser.id,
          status: 'PENDING',
          rewardAmount: 5.00,
          currency: 'GBP',
        },
      }).catch((refErr) => {
        this.logger.warn(`Failed to create pending referral record for social user ${newUser.id}: ${refErr?.message}`);
      });
    }

    this.notification
      .sendWelcomeEmail(newUser.email, newUser.name)
      .catch((err) =>
        this.logger.error(`Failed to send welcome email to ${newUser.email}: ${err?.message}`),
      );

    const tokens = await this.generateTokens(newUser.id, newUser.role);

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        accountType: 'INDIVIDUAL',
        companyName: null,
        avatarUrl,
        isEmailVerified: newUser.isEmailVerified,
        isPhoneVerified: false,
        profileCompleted: false,
      },
      ...tokens,
      isNewUser: true,
      requiresEmailVerification: false,
      requiresProfileCompletion: true,
    };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: tokenHash },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerificationExpiry: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or already used verification link');
    }

    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });
    await this.redis.del(userAuthStateKey(user.id)).catch(() => undefined);

    // Fire welcome email (fire-and-forget)
    this.notification
      .sendWelcomeEmail(user.email, user.name)
      .catch((err) =>
        this.logger.error(`Failed to send welcome email to ${user.email}: ${err?.message}`),
      );

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isEmailVerified: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationExpiry: tokenExpiry,
      },
    });

    // Fire-and-forget
    this.notification
      .sendVerificationEmail(user.email, user.name, rawToken)
      .catch((err) =>
        this.logger.error(`Failed to resend verification email to ${user.email}: ${err?.message}`),
      );

    return { message: 'Verification email sent' };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: { id: true, role: true, isActive: true },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt && Date.now() - stored.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS) {
      // Concurrent refresh lost the race; the winner already set fresh cookies.
      throw new ConflictException('Refresh token was already rotated');
    }

    if (stored.revokedAt) {
      // Reuse of a rotated token means it was likely stolen — kill every session.
      this.logger.warn(`Refresh token reuse detected for user ${stored.user.id}; revoking all sessions`);
      await this.revokeAllSessions(stored.user.id);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Atomic rotation: only one concurrent request can consume this token.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count !== 1) {
      throw new ConflictException('Refresh token was already rotated');
    }

    return this.generateTokens(stored.user.id, stored.user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke every refresh token and invalidate all outstanding access tokens
   * for a user (password change/reset, role change, refresh-token reuse).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.invalidateAccessTokens(userId);
  }

  private async invalidateAccessTokens(userId: string): Promise<void> {
    try {
      await this.redis.set(sessionRevokedBeforeKey(userId), Date.now(), SESSION_REVOCATION_TTL_SECONDS);
      await this.redis.del(userAuthStateKey(userId));
    } catch (err: any) {
      this.logger.error(`Failed to write session revocation marker for ${userId}: ${err?.message}`);
    }
  }

  async verifyAndHydrate(userId: string) {
    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          accountType: true,
          companyName: true,
          companyNumber: true,
          vatNumber: true,
          phone: true,
          isPhoneVerified: true,
        },
      }),
    ]);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or disabled');
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountType: profile?.accountType || 'INDIVIDUAL',
      companyName: profile?.companyName || null,
      companyNumber: profile?.companyNumber || null,
      vatNumber: profile?.vatNumber || null,
      phone: profile?.phone || null,
      isPhoneVerified: profile?.isPhoneVerified || false,
    };
  }

  async getAllUsers(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Admin methods
  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // A role change must take effect immediately, not when tokens expire.
    if (dto.role !== undefined && dto.role !== user.role) {
      await this.revokeAllSessions(userId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role as any }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(userId: string, currentUserId: string) {
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ── ACID Consistency: verify no active constraints before deletion ──
    const [activeListings, openOrders, heldEscrow] = await Promise.all([
      this.prisma.listing.count({
        where: {
          sellerId: userId,
          status: { in: ['ACTIVE', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
        },
      }),
      this.prisma.order.count({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: { in: ['PENDING', 'PAYMENT_RECEIVED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED'] },
        },
      }),
      this.prisma.escrowRecord.count({
        where: {
          order: { OR: [{ buyerId: userId }, { sellerId: userId }] },
          status: 'HELD',
        },
      }),
    ]);

    if (activeListings > 0) {
      throw new ForbiddenException(
        `Cannot delete user with ${activeListings} active listing(s). Delist them first.`,
      );
    }

    if (openOrders > 0) {
      throw new ForbiddenException(
        `Cannot delete user with ${openOrders} open order(s). Resolve them first.`,
      );
    }

    if (heldEscrow > 0) {
      throw new ForbiddenException(
        `Cannot delete user with ${heldEscrow} held escrow record(s). Release or refund first.`,
      );
    }

    // ── Atomic deletion within a single transaction ──
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete dependent records that CASCADE won't cover or need explicit cleanup
      await tx.bid.deleteMany({ where: { bidderId: userId } });
      await tx.notificationLog.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });

      // 2. Nullify optional references (messages stay for audit trail)
      await tx.listing.updateMany({
        where: { highestBidderId: userId },
        data: { highestBidderId: null },
      });

      // 3. Cascade: Profile → Address auto-cascades; User delete triggers profile cascade
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'User deleted successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Sign out every other session; the caller re-authenticates with the new password.
    await this.revokeAllSessions(userId);

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Anti-enumeration: always return the same response regardless of whether the email exists
    const SAFE_RESPONSE = { message: 'If that email is registered, you will receive a password reset link shortly.' };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return SAFE_RESPONSE;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: tokenExpiry,
      },
    });

    // Fire-and-forget — never reveal email existence via timing
    this.notification
      .sendPasswordResetEmail(user.email, user.name, rawToken)
      .catch((err) =>
        this.logger.error(`Failed to send password reset email to ${user.email}: ${err?.message}`),
      );

    return SAFE_RESPONSE;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: tokenHash },
      select: { id: true, passwordResetExpiry: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or already used password reset link');
    }

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('Password reset link has expired. Please request a new one.');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    // Update password, clear reset token, and revoke all refresh tokens in one transaction
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.invalidateAccessTokens(user.id);

    return { message: 'Password reset successfully. You can now sign in with your new password.' };
  }

  private async generateTokens(userId: string, role: string) {
    // JWT payload contains only sub + role — no PII (email intentionally omitted)
    const payload = { sub: userId, role };

    const accessToken = this.jwtService.sign(payload as object);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }

    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    // jti guarantees uniqueness even for tokens minted in the same second.
    const refreshToken = this.jwtService.sign({ ...payload, jti: crypto.randomUUID() } as object, {
      secret: refreshSecret,
      expiresIn: refreshExpiration as any,
    });

    // Derive expiry from config string instead of hardcoding 7 days
    const expiresAt = this.parseExpiration(refreshExpiration);

    await this.prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(refreshToken),
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private parseExpiration(exp: string): Date {
    const now = new Date();
    const match = /^(\d+)([smhd])$/.exec(exp);
    if (!match) {
      // Default to 7 days if format unrecognised
      now.setDate(now.getDate() + 7);
      return now;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': now.setSeconds(now.getSeconds() + value); break;
      case 'm': now.setMinutes(now.getMinutes() + value); break;
      case 'h': now.setHours(now.getHours() + value); break;
      case 'd': now.setDate(now.getDate() + value); break;
    }
    return now;
  }

  normalizeUkPhone(phone: string): string {
    let clean = phone.replace(/[\s\-()]/g, '');
    if (clean.startsWith('0044')) {
      clean = '+44' + clean.slice(4);
    } else if (clean.startsWith('44') && !clean.startsWith('+')) {
      clean = '+' + clean;
    } else if (clean.startsWith('07')) {
      clean = '+44' + clean.slice(1);
    } else if (clean.startsWith('01') || clean.startsWith('02')) {
      clean = '+44' + clean.slice(1);
    }
    return clean;
  }

  async lookupUkPostcode(postcode: string) {
    if (!postcode) {
      throw new BadRequestException('Postcode is required');
    }
    const cleanPostcode = postcode.trim().replace(/\s+/g, '').toUpperCase();
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;
    const looksValid = ukPostcodeRegex.test(cleanPostcode);

    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 200 && data.result) {
          const res = data.result;
          return {
            valid: true,
            postcode: res.postcode,
            adminDistrict: res.admin_district,
            adminCounty: res.admin_county || res.admin_district,
            region: res.region,
            country: res.country,
            latitude: res.latitude,
            longitude: res.longitude,
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(`Postcode lookup failed for ${cleanPostcode}: ${err?.message}`);
    }

    if (looksValid) {
      return {
        valid: true,
        postcode: postcode.trim().toUpperCase(),
        adminDistrict: 'UK Region',
        adminCounty: 'United Kingdom',
        region: 'United Kingdom',
        country: 'United Kingdom',
      };
    }

    return {
      valid: false,
      postcode,
      message: 'Invalid UK Postcode format',
    };
  }

  /**
   * Dev-only static OTP bypass. Requires an explicit opt-in flag and is
   * rejected at boot in production (see env.validation.ts).
   */
  private isDevOtpBypassEnabled(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      this.configService.get<string>('ALLOW_DEV_OTP_BYPASS')?.toLowerCase() === 'true'
    );
  }

  /** Atomically increments a counter, setting its TTL on first use. Fails open to 0 if Redis is down. */
  private async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    const client = this.redis.getClient();
    if (!client) return 0;
    const results = await client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    return Number(results?.[0]?.[1] ?? 0);
  }

  async sendPhoneOtp(dto: SendPhoneOtpDto, userId?: string) {
    const normalizedPhone = this.normalizeUkPhone(dto.phone);
    const cacheKey = `phone_otp:${normalizedPhone}`;

    // Per-phone send limits (anti SMS-pumping / toll fraud), independent of caller IP.
    try {
      const client = this.redis.getClient();
      if (client) {
        const cooldownSet = await client.set(
          `phone_otp_cooldown:${normalizedPhone}`,
          '1',
          'EX',
          OTP_RESEND_COOLDOWN_SECONDS,
          'NX',
        );
        if (cooldownSet !== 'OK') {
          throw new HttpException(
            'Please wait a minute before requesting another code',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      const sends = await this.incrementCounter(`phone_otp_sends:${normalizedPhone}`, 3600);
      if (sends > OTP_MAX_SENDS_PER_HOUR) {
        throw new HttpException(
          'Too many verification codes requested for this number. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Redis rate-limit check failed for phone OTP: ${err?.message}`);
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    try {
      await this.redis.set(
        cacheKey,
        { otpHash: this.hashOtp(normalizedPhone, otp), userId: userId || null, createdAt: Date.now() },
        OTP_TTL_SECONDS,
      );
      await this.redis.del(`phone_otp_attempts:${normalizedPhone}`);
    } catch (err: any) {
      this.logger.error(`Redis set failed for phone OTP: ${err?.message}`);
      throw new ServiceUnavailableException('Unable to send a verification code right now');
    }

    await this.smsService.sendVerificationOtp(normalizedPhone, otp);
    this.logger.log(`Phone verification OTP sent to ${this.maskPhone(normalizedPhone)}`);

    return {
      success: true,
      message: `Verification code sent to ${this.maskPhone(normalizedPhone)}`,
      phone: normalizedPhone,
      expiresSeconds: OTP_TTL_SECONDS,
      ...(this.isDevOtpBypassEnabled() ? { devOtp: otp } : {}),
    };
  }

  async verifyPhoneOtp(dto: VerifyPhoneOtpDto, userId?: string) {
    const normalizedPhone = this.normalizeUkPhone(dto.phone);
    const cacheKey = `phone_otp:${normalizedPhone}`;
    const attemptsKey = `phone_otp_attempts:${normalizedPhone}`;

    // Per-phone attempt cap — the code is burned after too many wrong guesses.
    let attempts = 0;
    try {
      attempts = await this.incrementCounter(attemptsKey, OTP_TTL_SECONDS);
    } catch (err: any) {
      this.logger.error(`Redis attempt counter failed for phone OTP: ${err?.message}`);
    }
    if (attempts > OTP_MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(cacheKey).catch(() => undefined);
      throw new HttpException(
        'Too many incorrect attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let cached: { otpHash?: string; userId?: string | null } | null = null;
    try {
      cached = await this.redis.get<any>(cacheKey);
    } catch (err: any) {
      this.logger.error(`Redis get failed for phone OTP: ${err?.message}`);
    }

    const expectedHash = cached?.otpHash ? Buffer.from(cached.otpHash, 'hex') : null;
    const providedHash = Buffer.from(this.hashOtp(normalizedPhone, dto.code), 'hex');
    const isValid =
      (expectedHash !== null &&
        expectedHash.length === providedHash.length &&
        crypto.timingSafeEqual(expectedHash, providedHash)) ||
      (this.isDevOtpBypassEnabled() && dto.code === '123456');

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    try {
      await this.redis.del(cacheKey);
      await this.redis.del(attemptsKey);
    } catch (err: any) {
      this.logger.warn(`Redis del failed for ${cacheKey}: ${err?.message}`);
    }

    const effectiveUserId = userId || cached?.userId;
    if (effectiveUserId) {
      await this.prisma.profile.updateMany({
        where: { userId: effectiveUserId },
        data: {
          isPhoneVerified: true,
          phoneVerifiedAt: new Date(),
          phone: normalizedPhone,
        },
      });
      try {
        await this.redis.del(`profile:${effectiveUserId}`);
      } catch {
        // Cache eviction is best-effort — never fail phone verification on it.
      }
    }

    return {
      success: true,
      message: 'Phone number verified successfully',
      phone: normalizedPhone,
      isPhoneVerified: true,
    };
  }

  private hashOtp(phone: string, otp: string): string {
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
  }

  private maskPhone(phone: string): string {
    return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : '****';
  }
}
