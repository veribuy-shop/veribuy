import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { ALLOWED_TRANSITIONS } from './dto/update-status.dto';
import { Listing, ListingStatus, TrustLensStatus, IntegrityFlag } from '.prisma/veribuy-client';
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
  color: true,
  storageCapacity: true,
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
    const initialFlags: IntegrityFlag[] = [IntegrityFlag.CLEAN];
    let initialTrustStatus: TrustLensStatus = TrustLensStatus.PENDING;

    // Check if duplicate IMEI before creating
    const cleanImei = dto.imei ? dto.imei.replace(/[^0-9]/g, '').trim() : null;
    if (cleanImei && cleanImei.length >= 8) {
      try {
        const existingImei = await this.prisma.imeiRegistry.findUnique({
          where: { imei: cleanImei },
        });
        if (existingImei && existingImei.firstSellerId !== dto.sellerId) {
          initialFlags.length = 0;
          initialFlags.push(IntegrityFlag.DUPLICATE_IMEI);
          initialTrustStatus = TrustLensStatus.REQUIRES_REVIEW;
        }
      } catch (err) {
        this.logger.warn(`Failed initial IMEI check: ${(err as Error).message}`);
      }
    }

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
        trustLensStatus: initialTrustStatus,
        integrityFlags: initialFlags,
      },
    });

    if (cleanImei && cleanImei.length >= 8) {
      await this.checkAndRecordImei(
        cleanImei,
        dto.sellerId!,
        listing.id,
        dto.brand,
        dto.model,
      );
    }

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

  /**
   * Track IMEI in central ImeiRegistry table and flag if previously listed by a different seller
   */
  private async checkAndRecordImei(
    rawImei: string,
    sellerId: string,
    listingId: string,
    brand?: string,
    model?: string,
  ): Promise<{ isDuplicate: boolean; isFlagged: boolean }> {
    const cleanImei = rawImei.replace(/[^0-9]/g, '').trim();
    if (!cleanImei || cleanImei.length < 8) {
      return { isDuplicate: false, isFlagged: false };
    }

    try {
      const existing = await this.prisma.imeiRegistry.findUnique({
        where: { imei: cleanImei },
      });

      if (existing) {
        const isDifferentSeller = existing.firstSellerId !== sellerId;
        const isFlagged = isDifferentSeller || existing.isFlagged;
        const flagReason = isDifferentSeller
          ? 'Attempted re-listing by different seller'
          : existing.flagReason;

        await this.prisma.imeiRegistry.update({
          where: { imei: cleanImei },
          data: {
            lastListingId: listingId,
            lastSellerId: sellerId,
            timesListed: { increment: 1 },
            lastListedAt: new Date(),
            isFlagged,
            ...(flagReason ? { flagReason } : {}),
            ...(brand && !existing.brand ? { brand } : {}),
            ...(model && !existing.model ? { model } : {}),
          },
        });

        return { isDuplicate: isDifferentSeller, isFlagged };
      } else {
        await this.prisma.imeiRegistry.create({
          data: {
            imei: cleanImei,
            brand: brand || null,
            model: model || null,
            firstListingId: listingId,
            firstSellerId: sellerId,
            lastListingId: listingId,
            lastSellerId: sellerId,
            timesListed: 1,
            isFlagged: false,
          },
        });
        return { isDuplicate: false, isFlagged: false };
      }
    } catch (err) {
      this.logger.error(`Failed to check and record IMEI in registry: ${(err as Error).message}`);
      return { isDuplicate: false, isFlagged: false };
    }
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

    if (query.status && (query.status as any) !== 'ALL') {
      where.status = query.status;
    } else if (query.sellerId || (query.status as any) === 'ALL') {
      // Admin moderation or seller dashboard: return all statuses
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

    // Attach a cover image to each listing so browse cards render a real photo
    // instead of falling back to a device-icon placeholder. Evidence images live
    // in the shared DB (logical `evidence` schema); we fetch them in ONE query for
    // the page's listing IDs (no N+1) and take the first image per pack.
    const listingIds = data.map((l) => l.id);
    let coverImages: Map<string, string> = new Map();
    if (listingIds.length > 0) {
      try {
        const packs = await this.prisma.evidencePack.findMany({
          where: { listingId: { in: listingIds } },
          select: {
            listingId: true,
            items: {
              select: { url: true },
              orderBy: { createdAt: 'asc' as const },
            },
          },
        });
        coverImages = new Map(
          packs
            .map((p): [string, string] => [p.listingId, p.items[0]?.url ?? ''])
            .filter(([, url]) => url.length > 0),
        );
      } catch (err) {
        this.logger.warn(`Failed to fetch evidence covers for listings: ${(err as Error).message}`);
      }
    }

    const withImages = data.map((l) => ({
      ...l,
      imageUrl: coverImages.get(l.id) ?? null,
    }));

    return {
      data: withImages,
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

  /**
   * Returns listing WITHOUT imei/serial (safe for public).
   *
   * `viewerId` is an opaque per-browser token so a real user view is counted once
   * (24h window), and the detail page's polling loop / refreshes from the same
   * session never inflate the counter. When Redis is down we skip counting
   * entirely rather than risk double-counting via the cache-miss path.
   */
  async findOne(id: string, viewerId?: string): Promise<any> {
    const cacheKey = `listing:${id}`;

    // Try cache first — fail open
    let cached: any = null;
    try {
      cached = await this.redis.get<any>(cacheKey);
    } catch (err) {
      this.logger.warn(`Redis GET failed for listing:${id}: ${(err as Error).message}`);
    }

    let listing = cached;
    if (!listing) {
      listing = await this.prisma.listing.findUnique({
        where: { id },
        select: PUBLIC_SELECT,
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      // Cache for 5 minutes — fail open
      try {
        await this.redis.set(cacheKey, listing, 300);
      } catch (err) {
        this.logger.warn(`Redis SET failed for listing:${id}: ${(err as Error).message}`);
      }
    }

    await this.countViewOnce(id, viewerId);

    return listing;
  }

  /** Count a listing view once per viewer within a 24h window (dedupe). */
  private async countViewOnce(id: string, viewerId?: string): Promise<void> {
    const VIEW_WINDOW_SECONDS = 24 * 60 * 60;
    try {
      const client = this.redis.getClient();
      // Redis unavailable → bail (fail-open; no risk of inflating the counter).
      if (!client) return;
      const key = `view:${id}:${viewerId ?? 'anon'}`;
      const counted = await client.set(key, '1', 'EX', VIEW_WINDOW_SECONDS, 'NX');
      if (counted === 'OK') {
        await this.prisma.listing.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        });
      }
    } catch (err: any) {
      this.logger.warn(`View count update failed: ${err?.message ?? err}`);
    }
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
      const current = await this.prisma.listing.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Listing not found');
      }

      // Enforce the same state machine used by the dedicated status endpoint, so the
      // generic PATCH can't bypass an invalid transition.
      if (dto.status !== undefined && dto.status !== current.status) {
        const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
        if (!allowed.includes(dto.status)) {
          throw new BadRequestException(
            `Cannot transition listing from ${current.status} to ${dto.status}`,
          );
        }
      }

      const listing = await this.prisma.listing.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.conditionGrade !== undefined && { conditionGrade: dto.conditionGrade }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.color !== undefined && { color: dto.color || null }),
          ...(dto.storageCapacity !== undefined && { storageCapacity: dto.storageCapacity || null }),
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
