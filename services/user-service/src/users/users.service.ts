import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '@veribuy/redis-cache';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findByUserId(userId: string) {
    const cacheKey = `profile:${userId}`;

    // Try to get from cache first
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
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
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Cache the profile for 10 minutes (600 seconds)
    await this.redis.set(cacheKey, profile, 600);

    return profile;
  }

  async createProfile(userId: string, data: { displayName: string; firstName?: string; lastName?: string }) {
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        displayName: data.displayName,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    return profile;
  }

  async updateProfile(userId: string, data: Partial<{ displayName: string; firstName: string; lastName: string; bio: string; phone: string; avatarUrl: string }>) {
    // Use upsert to create the profile if it doesn't exist
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        displayName: data.displayName || 'User',
        firstName: data.firstName,
        lastName: data.lastName,
        bio: data.bio,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
      },
    });

    // Invalidate cache
    await this.redis.del(`profile:${userId}`);

    return profile;
  }
}
