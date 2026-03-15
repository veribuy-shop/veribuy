import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { ALLOWED_TRANSITIONS } from './dto/update-status.dto';
import { Listing, ListingStatus, TrustLensStatus, IntegrityFlag } from '.prisma/listing-client';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationClient } from './notification.client';

// Fields safe to return to public callers — strips IMEI and serial number
const PUBLIC_SELECT = {
  id: true,
  sellerId: true,
  title: true,
  description: true,
  deviceType: true,
  brand: true,
  model: true,
  price: true,
  currency: true,
  conditionGrade: true,
  status: true,
  trustLensStatus: true,
  integrityFlags: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  // imei and serialNumber intentionally excluded from public shape
} as const;

@Injectable()
export class UlistingsService {
  private readonly logger = new Logger(UlistingsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notifications: NotificationClient,
  ) {}

  async create(dto: CreateListingDto): Promise<Listing> {
    const listing = await this.prisma.listing.create({
      data: {
        sellerId: dto.sellerId!,
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
        integrityFlags: [IntegrityFlag.CLEAN],
      },
    });

    // Fire-and-forget: notify seller of successful listing submission
    this.getSellerInfo(listing.sellerId).then((seller) => {
      if (seller) {
        this.notifications.notifyListingCreated({
          sellerEmail: seller.email,
          sellerName: seller.name,
          listingTitle: listing.title,
          listingId: listing.id,
        });
      }
    }).catch((err: Error) => this.logger.error(`listing_created notify fetch failed: ${err.message}`));

    return listing;
  }

  async findAll(query: GetListingsQueryDto & PaginationDto): Promise<PaginatedResponse<any>> {
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
      // Public browse: only show ACTIVE listings
      where.status = ListingStatus.ACTIVE;
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

    // conditionGrade: DTO normalises to string[] via @Transform
    if (query.conditionGrade && query.conditionGrade.length > 0) {
      where.conditionGrade = { in: query.conditionGrade };
    }

    // Price range filters (query params arrive as strings)
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = parseFloat(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = parseFloat(query.maxPrice);
      }
    }

    // Dynamic sort: default to createdAt desc
    const sortField = query.sortBy ?? 'createdAt';
    const sortDir = query.sortOrder ?? 'desc';
    const orderBy = { [sortField]: sortDir };

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        select: PUBLIC_SELECT,
        skip,
        take: limit,
        orderBy,
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

  /** Returns raw listing WITH imei/serial — for owner or internal use only */
  async findOneRaw(id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  /** Returns listing WITHOUT imei/serial (safe for public) + increments view count */
  async findOne(id: string): Promise<any> {
    const cacheKey = `listing:${id}`;

    // Try cache first — fail open
    try {
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        // Increment view count in background, don't block response
        this.prisma.listing
          .update({ where: { id }, data: { viewCount: { increment: 1 } } })
          .catch((err: Error) => this.logger.warn(`View count update failed: ${err.message}`));
        return cached;
      }
    } catch (err) {
      this.logger.warn(`Redis GET failed for listing:${id}: ${(err as Error).message}`);
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Increment view count
    await this.prisma.listing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Cache for 5 minutes — fail open
    try {
      await this.redis.set(cacheKey, listing, 300);
    } catch (err) {
      this.logger.warn(`Redis SET failed for listing:${id}: ${(err as Error).message}`);
    }

    return listing;
  }

  async findBySeller(sellerId: string, pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: { sellerId },
        select: PUBLIC_SELECT,
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

  /** User-facing status update with state machine validation */
  async updateStatus(id: string, status: ListingStatus, currentStatus: ListingStatus): Promise<Listing> {
    // Atomic update: only update if current status hasn't changed concurrently
    const listing = await this.prisma.listing.updateMany({
      where: { id, status: currentStatus },
      data: {
        status,
        publishedAt: status === ListingStatus.ACTIVE ? new Date() : undefined,
      },
    });

    if (listing.count === 0) {
      throw new BadRequestException(
        'Status update failed — listing status may have changed concurrently',
      );
    }

    await this.redis.del(`listing:${id}`).catch(() => {});
    const updated = await this.findOneRaw(id);

    // Fire-and-forget: notify seller of status change
    this.getSellerInfo(updated.sellerId).then((seller) => {
      if (seller) {
        this.notifications.notifyListingStatusChanged({
          sellerEmail: seller.email,
          sellerName: seller.name,
          listingTitle: updated.title,
          listingId: updated.id,
          status: updated.status,
        });
      }
    }).catch((err: Error) => this.logger.error(`listing_status notify fetch failed: ${err.message}`));

    return updated;
  }

  /** Internal service-to-service status update — bypasses state machine */
  async updateStatusInternal(id: string, status: ListingStatus): Promise<Listing> {
    let updateData: any = { status };

    if (status === ListingStatus.ACTIVE) {
      updateData.publishedAt = new Date();
    }

    try {
      const updated = await this.prisma.listing.update({
        where: { id },
        data: updateData,
      });

      await this.redis.del(`listing:${id}`).catch(() => {});

      // Fire-and-forget: notify seller of status change
      this.getSellerInfo(updated.sellerId).then((seller) => {
        if (seller) {
          this.notifications.notifyListingStatusChanged({
            sellerEmail: seller.email,
            sellerName: seller.name,
            listingTitle: updated.title,
            listingId: updated.id,
            status: updated.status,
          });
        }
      }).catch((err: Error) => this.logger.error(`listing_status notify fetch failed: ${err.message}`));

      return updated;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateListingDto): Promise<Listing> {
    try {
      const listing = await this.prisma.listing.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
        },
      });

      await this.redis.del(`listing:${id}`).catch(() => {});
      return listing;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  async updateTrustLensStatus(
    id: string,
    trustLensStatus: TrustLensStatus,
    conditionGrade?: string,
    integrityFlags?: IntegrityFlag[],
  ): Promise<Listing> {
    try {
      // Derive the listing status from the trust lens outcome
      const statusUpdate: Record<string, unknown> = {};
      if (trustLensStatus === 'PASSED') {
        statusUpdate['status'] = 'ACTIVE';
        statusUpdate['publishedAt'] = new Date();
      } else if (trustLensStatus === 'FAILED') {
        statusUpdate['status'] = 'REJECTED';
      }

      const listing = await this.prisma.listing.update({
        where: { id },
        data: {
          trustLensStatus,
          conditionGrade: conditionGrade as any,
          // Use Prisma's set syntax to properly clear/replace array
          ...(integrityFlags !== undefined && { integrityFlags: { set: integrityFlags } }),
          ...statusUpdate,
        },
      });

      await this.redis.del(`listing:${id}`).catch(() => {});
      return listing;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.listing.delete({ where: { id } });
      await this.redis.del(`listing:${id}`).catch(() => {});
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  /**
   * Fetch seller name + email from auth-service.
   * Returns null on any failure — callers must handle gracefully.
   */
  private async getSellerInfo(
    sellerId: string,
  ): Promise<{ name: string; email: string } | null> {
    const AUTH_SERVICE_URL =
      process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    try {
      const response = await fetch(
        `${AUTH_SERVICE_URL}/auth/internal/users/${sellerId}`,
        {
          headers: {
            'x-internal-service': process.env.INTERNAL_SERVICE_TOKEN ?? '',
          },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as Record<string, unknown>;
      const name = typeof data['name'] === 'string' ? data['name'] : '';
      const email = typeof data['email'] === 'string' ? data['email'] : '';
      if (!email) return null;
      return { name, email };
    } catch {
      return null;
    }
  }
}
