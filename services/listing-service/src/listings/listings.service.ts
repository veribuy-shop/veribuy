import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { Listing, ListingStatus, TrustLensStatus, IntegrityFlag } from '.prisma/listing-client';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';

@Injectable()
export class UlistingsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(dto: CreateListingDto): Promise<Listing> {
    // Create listing with default status DRAFT and trustLensStatus PENDING
    const listing = await this.prisma.listing.create({
      data: {
        sellerId: dto.sellerId,
        title: dto.title,
        description: dto.description,
        deviceType: dto.deviceType,
        brand: dto.brand,
        model: dto.model,
        price: dto.price,
        currency: dto.currency || 'GBP',
        conditionGrade: dto.conditionGrade,
        imei: dto.imei,
        serialNumber: dto.serialNumber,
        status: ListingStatus.DRAFT,
        trustLensStatus: TrustLensStatus.PENDING,
        integrityFlags: [IntegrityFlag.CLEAN], // Default to clean, will be updated by Trust Lens
      },
    });

    return listing;
  }

  async findAll(query: GetListingsQueryDto & PaginationDto): Promise<PaginatedResponse<Listing>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.deviceType) {
      where.deviceType = query.deviceType;
    }

    if (query.brand) {
      where.brand = { contains: query.brand, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    } else {
      // By default, exclude SOLD and DELISTED listings from browse
      where.status = { notIn: ['SOLD', 'DELISTED'] };
    }

    if (query.trustLensStatus) {
      where.trustLensStatus = query.trustLensStatus;
    }

    if (query.sellerId) {
      where.sellerId = query.sellerId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count({ where }),
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

  async findOne(id: string): Promise<Listing> {
    const cacheKey = `listing:${id}`;

    // Try to get from cache first
    const cached = await this.redis.get<Listing>(cacheKey);
    if (cached) {
      // Still increment view count in background
      this.prisma.listing.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(err => console.error('Failed to update view count:', err));

      return cached;
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Increment view count
    await this.prisma.listing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Cache the listing for 5 minutes (300 seconds)
    await this.redis.set(cacheKey, listing, 300);

    return listing;
  }

  async findBySeller(sellerId: string, pagination: PaginationDto): Promise<PaginatedResponse<Listing>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: { sellerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.count({ where: { sellerId } }),
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

  async updateStatus(id: string, status: ListingStatus): Promise<Listing> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        status,
        publishedAt: status === ListingStatus.ACTIVE ? new Date() : undefined,
      },
    });

    // Invalidate cache
    await this.redis.del(`listing:${id}`);

    return listing;
  }

  async update(id: string, updateData: { title?: string; price?: number; status?: string }): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const data: any = {};
    if (updateData.title) data.title = updateData.title;
    if (updateData.price) data.price = updateData.price;
    if (updateData.status) data.status = updateData.status;

    const updated = await this.prisma.listing.update({
      where: { id },
      data,
    });

    // Invalidate cache
    await this.redis.del(`listing:${id}`);

    return updated;
  }

  async updateTrustLensStatus(
    id: string,
    trustLensStatus: TrustLensStatus,
    conditionGrade?: string,
    integrityFlags?: IntegrityFlag[],
  ): Promise<Listing> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        trustLensStatus,
        conditionGrade: conditionGrade as any,
        integrityFlags: integrityFlags || undefined,
      },
    });

    // Invalidate cache
    await this.redis.del(`listing:${id}`);

    return listing;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.listing.delete({
      where: { id },
    });

    // Invalidate cache
    await this.redis.del(`listing:${id}`);
  }
}
