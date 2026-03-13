import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
      throw new NotFoundException('Profile not found');
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
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      create: {
        userId,
        displayName: dto.displayName || 'User',
        firstName: dto.firstName,
        lastName: dto.lastName,
        bio: dto.bio,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
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
    const data: Record<string, unknown> = { verificationStatus };
    if (verificationStatus === 'VERIFIED') {
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
