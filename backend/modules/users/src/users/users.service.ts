import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Safe profile shape — excludes kycVerifiedAt and other internal fields
const PROFILE_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  firstName: true,
  lastName: true,
  bio: true,
  avatarUrl: true,
  phone: true,
  verificationStatus: true,
  sellerRating: true,
  totalSales: true,
  totalPurchases: true,
  createdAt: true,
  updatedAt: true,
  address: {
    select: {
      id: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
    },
  },
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findByUserId(userId: string) {
    const cacheKey = `profile:${userId}`;

    // Try cache first — fail open (Redis outage must not break profile reads)
    try {
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      this.logger.warn(`Redis GET failed for key ${cacheKey}: ${(err as Error).message}`);
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    });

    if (!profile) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, createdAt: true, updatedAt: true },
      });
      if (!user) {
        throw new NotFoundException('Profile not found');
      }
      return {
        id: user.id,
        userId: user.id,
        displayName: user.email ? user.email.split('@')[0] : 'User',
        firstName: null,
        lastName: null,
        bio: null,
        avatarUrl: null,
        phone: null,
        verificationStatus: 'PENDING',
        sellerRating: null,
        totalSales: 0,
        totalPurchases: 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        address: null,
      };
    }

    // Write to cache — fail open
    try {
      await this.redis.set(cacheKey, profile, 600);
    } catch (err) {
      this.logger.warn(`Redis SET failed for key ${cacheKey}: ${(err as Error).message}`);
    }

    return profile;
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    try {
      const profile = await this.prisma.profile.create({
        data: {
          userId,
          displayName: dto.displayName,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        select: PROFILE_SELECT,
      });

      // Write-through cache
      try {
        await this.redis.set(`profile:${userId}`, profile, 600);
      } catch (err) {
        this.logger.warn(`Redis SET failed after createProfile: ${(err as Error).message}`);
      }

      return profile;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Profile already exists for this user');
      }
      throw err;
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const hasAddressUpdates =
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.postalCode !== undefined ||
      dto.country !== undefined ||
      dto.line1 !== undefined ||
      dto.line2 !== undefined ||
      dto.address !== undefined;

    const addressCreate = {
      line1: dto.address?.line1 ?? dto.line1 ?? '',
      line2: dto.address?.line2 ?? dto.line2 ?? null,
      city: dto.address?.city ?? dto.city ?? '',
      state: dto.address?.state ?? dto.state ?? '',
      postalCode: dto.address?.postalCode ?? dto.postalCode ?? '',
      country: dto.address?.country ?? dto.country ?? 'United Kingdom',
    };

    const addressUpdate: Record<string, any> = {};
    if (dto.address?.line1 !== undefined || dto.line1 !== undefined) addressUpdate.line1 = dto.address?.line1 ?? dto.line1;
    if (dto.address?.line2 !== undefined || dto.line2 !== undefined) addressUpdate.line2 = dto.address?.line2 ?? dto.line2;
    if (dto.address?.city !== undefined || dto.city !== undefined) addressUpdate.city = dto.address?.city ?? dto.city;
    if (dto.address?.state !== undefined || dto.state !== undefined) addressUpdate.state = dto.address?.state ?? dto.state;
    if (dto.address?.postalCode !== undefined || dto.postalCode !== undefined) addressUpdate.postalCode = dto.address?.postalCode ?? dto.postalCode;
    if (dto.address?.country !== undefined || dto.country !== undefined) addressUpdate.country = dto.address?.country ?? dto.country;

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(hasAddressUpdates && {
          address: {
            upsert: {
              create: addressCreate,
              update: addressUpdate,
            },
          },
        }),
      },
      create: {
        userId,
        displayName: dto.displayName || 'User',
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        ...(hasAddressUpdates && {
          address: {
            create: addressCreate,
          },
        }),
      },
      select: PROFILE_SELECT,
    });

    // Invalidate then write-through
    try {
      await this.redis.del(`profile:${userId}`);
      await this.redis.set(`profile:${userId}`, profile, 600);
    } catch (err) {
      this.logger.warn(`Redis update failed for profile:${userId}: ${(err as Error).message}`);
    }

    return profile;
  }

  async updateVerificationStatus(
    userId: string,
    verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED',
  ) {
    // Fetch current status to enforce state-machine rules
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
      select: { verificationStatus: true, kycVerifiedAt: true },
    });

    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    // State-machine guard: once VERIFIED, only REJECTED, SUSPENDED, or re-VERIFIED
    // can override. UNVERIFIED and PENDING must never regress a verified seller.
    // Trust-lens only sends REJECTED after the seller hits the failure threshold (3+).
    const ALLOWED_FROM_VERIFIED = new Set(['VERIFIED', 'REJECTED', 'SUSPENDED']);
    if (
      existing.verificationStatus === 'VERIFIED' &&
      !ALLOWED_FROM_VERIFIED.has(verificationStatus)
    ) {
      this.logger.warn(
        `Blocked ${existing.verificationStatus} -> ${verificationStatus} transition for user ${userId}`,
      );
      return;
    }

    const data: Record<string, unknown> = { verificationStatus };

    // Only set kycVerifiedAt on first verification — preserve the original timestamp
    if (verificationStatus === 'VERIFIED' && !existing.kycVerifiedAt) {
      data['kycVerifiedAt'] = new Date();
    }

    try {
      await this.prisma.profile.update({
        where: { userId },
        data: data as any,
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Profile not found');
      }
      throw err;
    }

    // Invalidate cache so the next read reflects the new status
    try {
      await this.redis.del(`profile:${userId}`);
    } catch (err) {
      this.logger.warn(
        `Redis DEL failed after verificationStatus update for profile:${userId}: ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `Updated verificationStatus to ${verificationStatus} for user ${userId}`,
    );
  }

  async updateSellerRating(
    userId: string,
    sellerRating: number | null,
    totalRatings: number,
  ) {
    try {
      await this.prisma.profile.update({
        where: { userId },
        data: {
          sellerRating,
          totalSales: totalRatings,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Profile not found');
      }
      throw err;
    }

    // Invalidate cache so the next read reflects the new rating
    try {
      await this.redis.del(`profile:${userId}`);
    } catch (err) {
      this.logger.warn(
        `Redis DEL failed after sellerRating update for profile:${userId}: ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `Updated sellerRating to ${sellerRating} (${totalRatings} ratings) for user ${userId}`,
    );
  }
}
