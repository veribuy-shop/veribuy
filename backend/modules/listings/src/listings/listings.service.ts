import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { generateUsername } from '../../../../src/common/username';
import { publicSellerName } from '../../../../src/common/public-name';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { ALLOWED_TRANSITIONS, SELLER_TRANSITIONS } from './dto/update-status.dto';
import { Prisma, Listing, ListingStatus, TrustLensStatus, ReviewStatus, IntegrityFlag, ListingFormat, DeviceType } from '.prisma/veribuy-client';
import {
  PaginationDto,
  PaginatedResponse,
  calculateMinimumNextBid,
  calculateProxyBidOutcome,
  auctionPaymentDeadline,
  anonymizeBidderHandle,
} from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';
import { NotificationClient } from './notification.client';
import { abandonedListingRetentionDays, auctionPaymentWindowHours } from '../../../../src/config/marketplace.config';

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
  quantity: true,
  isBulkListing: true,
  freeShipping: true,
  format: true,
  startingBid: true,
  reservePrice: true,
  currentBid: true,
  bidCount: true,
  highestBidderId: true,
  auctionEndsAt: true,
  buyItNowPrice: true,
  status: true,
  trustLensStatus: true,
  integrityFlags: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  // imei and serialNumber intentionally excluded from public shape
} as const;

export { publicSellerName };

/** Share of a seller's ratings that are 4 or 5 stars. New sellers start at 100%. */
export function feedbackSummary(ratings: number[]): { feedbackPercent: number; feedbackCount: number } {
  if (ratings.length === 0) return { feedbackPercent: 100, feedbackCount: 0 };
  const positive = ratings.filter((rating) => rating >= 4).length;
  return { feedbackPercent: Math.round((positive / ratings.length) * 100), feedbackCount: ratings.length };
}

/**
 * The only listing fields a draft may hold. Anything else, including IMEI and
 * serial numbers, is dropped so identifiers are never stored before submission.
 */
const DRAFT_FIELD_MAX_LENGTH: Record<string, number> = {
  title: 200,
  description: 5000,
  deviceType: 40,
  brand: 100,
  model: 100,
  conditionGrade: 10,
  storageCapacity: 40,
  color: 60,
  price: 20,
  currency: 3,
  format: 20,
  startingBid: 20,
  reservePrice: 20,
  buyItNowPrice: 20,
  cosmeticCondition: 2000,
  functionalIssues: 2000,
  city: 100,
};
const DRAFT_NON_TEXT_FIELDS = new Set(['freeShipping', 'isBulkListing', 'quantity', 'durationDays']);

type DraftValue = string | number | boolean | string[];

function pickDraftFields(data: Record<string, unknown>): Record<string, DraftValue> {
  const safe: Record<string, DraftValue> = {};
  for (const [key, value] of Object.entries(data)) {
    const maxLength = DRAFT_FIELD_MAX_LENGTH[key];
    if (maxLength && typeof value === 'string') {
      safe[key] = value.slice(0, maxLength);
    } else if (DRAFT_NON_TEXT_FIELDS.has(key) && (typeof value === 'boolean' || typeof value === 'number')) {
      safe[key] = value;
    } else if (key === 'accessories' && Array.isArray(value)) {
      safe[key] = value.filter((item): item is string => typeof item === 'string').slice(0, 30);
    }
  }
  return safe;
}

@Injectable()
export class UlistingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UlistingsService.name);
  private settleTimer?: NodeJS.Timeout;
  private purgeTimer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notifications: NotificationClient,
  ) {}

  /**
   * Auctions must close on time even with no external scheduler: settle
   * expired auctions every minute (moves them to AUCTION_ENDED and notifies
   * the winner). Settlement is compare-and-set, so concurrent instances are safe.
   */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.settleTimer = setInterval(() => {
      this.settleExpiredAuctions().catch((err) =>
        this.logger.warn(`Auction settlement run failed: ${(err as Error).message}`),
      );
      this.releaseUnpaidAuctions().catch((err) =>
        this.logger.warn(`Unpaid auction run failed: ${(err as Error).message}`),
      );
    }, 60 * 1000);
    this.settleTimer.unref?.();

    const purge = () =>
      this.purgeAbandonedListings().catch((err) =>
        this.logger.warn(`Abandoned listing purge failed: ${(err as Error).message}`),
      );
    purge();
    this.purgeTimer = setInterval(purge, 60 * 60 * 1000);
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.settleTimer) clearInterval(this.settleTimer);
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async create(dto: CreateListingDto): Promise<Listing> {
    const initialFlags: IntegrityFlag[] = [IntegrityFlag.CLEAN];
    // Bulk inventory is a business-account feature, and it is NOT pre-verified:
    // business status is self-declared, so every listing (bulk included) goes
    // through Trust Lens / manual review before it can be sold.
    const needsImei = dto.deviceType === DeviceType.SMARTPHONE && !dto.isBulkListing && !dto.imei?.trim();
    if (dto.isBulkListing || needsImei) {
      const profile = await this.prisma.profile.findUnique({
        where: { userId: dto.sellerId! },
        select: { accountType: true },
      });
      const isBusiness = profile?.accountType === 'BUSINESS';
      if (dto.isBulkListing && !isBusiness) {
        throw new ForbiddenException('Bulk inventory listings are only available to business accounts');
      }
      // Private sellers must give a phone's IMEI. Businesses may list without
      // one; those listings go to manual review instead of the IMEI check.
      if (needsImei && !isBusiness) {
        throw new BadRequestException('Please enter the phone’s 15-digit IMEI. Dial *#06# to find it.');
      }
    }
    // A seller retrying after a failed photo upload carries on with the same listing.
    const unfinished = await this.findUnfinishedListing(dto);
    if (!unfinished) await this.assertNotDuplicateListing(dto);

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

    const isAuction = dto.format === ListingFormat.AUCTION || (dto.format as string) === 'AUCTION';
    const startingBid = isAuction ? (dto.startingBid ?? dto.price ?? 0.99) : null;
    const currentBid = isAuction ? startingBid : null;
    const auctionEndsAt = isAuction
      ? new Date(Date.now() + (dto.durationDays || 7) * 24 * 60 * 60 * 1000)
      : null;
    const reservePrice = isAuction ? (dto.reservePrice ?? null) : null;
    const buyItNowPrice = isAuction ? (dto.buyItNowPrice ?? null) : null;
    const listingFormat = isAuction ? ListingFormat.AUCTION : ListingFormat.FIXED_PRICE;

    const data = {
      sellerId: dto.sellerId!,
      title: dto.title,
      description: dto.description,
      deviceType: dto.deviceType,
      brand: dto.brand,
      model: dto.model,
      price: isAuction ? (buyItNowPrice ?? startingBid ?? dto.price) : dto.price,
      currency: 'GBP', // Orders settle in GBP only — never trust a client currency
      conditionGrade: dto.conditionGrade,
      color: dto.color || null,
      storageCapacity: dto.storageCapacity || null,
      quantity: isAuction ? 1 : (dto.quantity || 1),
      isBulkListing: isAuction ? false : !!dto.isBulkListing,
      freeShipping: !!dto.freeShipping,
      format: listingFormat,
      startingBid,
      reservePrice,
      currentBid,
      auctionEndsAt,
      buyItNowPrice,
      bidCount: 0,
      imei: dto.imei,
      serialNumber: dto.serialNumber,
      status: ListingStatus.DRAFT,
      trustLensStatus: initialTrustStatus,
      integrityFlags: initialFlags,
    };

    if (unfinished) {
      // The seller sends all their photos again, so drop the partial set from last time.
      await this.prisma.evidenceItem.deleteMany({ where: { pack: { listingId: unfinished.id } } });
      return this.prisma.listing.update({ where: { id: unfinished.id }, data });
    }

    const listing = await this.prisma.listing.create({ data });

    if (cleanImei && cleanImei.length >= 8) {
      await this.checkAndRecordImei(
        cleanImei,
        dto.sellerId!,
        listing.id,
        dto.brand,
        dto.model,
      );
    }

    // If dispatch location/city was specified, save it to the seller's profile address
    const locationCity = (dto.city || dto.location || '').trim();
    if (locationCity && dto.sellerId) {
      this.prisma.profile.upsert({
        where: { userId: dto.sellerId },
        update: {
          address: {
            upsert: {
              create: {
                city: locationCity,
                line1: '',
                state: '',
                postalCode: '',
                country: 'United Kingdom',
              },
              update: {
                city: locationCity,
              },
            },
          },
        },
        create: {
          userId: dto.sellerId,
          username: generateUsername(),
          displayName: 'Seller',
          address: {
            create: {
              city: locationCity,
              line1: '',
              state: '',
              postalCode: '',
              country: 'United Kingdom',
            },
          },
        },
      }).catch((err: Error) => this.logger.warn(`Failed to update seller dispatch location: ${err?.message}`));
    }

    return listing;
  }

  /**
   * Tells the seller their listing is in for verification. Called once the
   * photos are uploaded and the check has been requested, not when the listing
   * row is first saved: an upload can still fail at that point.
   */
  async notifyListingSubmitted(id: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, title: true, sellerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    const seller = await this.getSellerInfo(listing.sellerId);
    if (!seller) return;
    this.notifications.notifyListingCreated({
      sellerEmail: seller.email,
      sellerName: seller.name,
      listingTitle: listing.title,
      listingId: listing.id,
    });
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

    if (query.format) {
      where.format = query.format;
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

    // Dynamic sort
    let orderBy: any;
    if (query.sortBy === 'endingSoonest') {
      where.auctionEndsAt = { not: null, gt: new Date() };
      orderBy = { auctionEndsAt: 'asc' };
    } else if (query.sortBy === 'mostBids') {
      orderBy = { bidCount: 'desc' };
    } else {
      const sortField = query.sortBy ?? 'createdAt';
      const sortDir = query.sortOrder ?? 'desc';
      orderBy = { [sortField]: sortDir };
    }

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
    const sellerIds = Array.from(new Set(data.map((l) => l.sellerId)));
    let coverImages: Map<string, string> = new Map();
    const sellersMap: Map<string, any> = new Map();

    if (listingIds.length > 0) {
      try {
        const [packs, profiles, users] = await Promise.all([
          this.prisma.evidencePack.findMany({
            where: { listingId: { in: listingIds } },
            select: {
              listingId: true,
              items: {
                select: { url: true },
                orderBy: { createdAt: 'asc' as const },
              },
            },
          }),
          this.prisma.profile.findMany({
            where: { userId: { in: sellerIds } },
            select: {
              userId: true,
              username: true,
              accountType: true,
              companyName: true,
              avatarUrl: true,
              sellerRating: true,
              createdAt: true,
              address: {
                select: {
                  city: true,
                  country: true,
                  state: true,
                },
              },
            },
          }),
          this.prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, createdAt: true },
          }),
        ]);

        coverImages = new Map(
          packs
            .map((p): [string, string] => [p.listingId, p.items[0]?.url ?? ''])
            .filter(([, url]) => url.length > 0),
        );

        const usersMap = new Map(users.map((u) => [u.id, u.createdAt]));
        profiles.forEach((p) => {
          const userCreated = usersMap.get(p.userId) || p.createdAt;
          const joinedYear = userCreated ? new Date(userCreated).getFullYear() : new Date().getFullYear();
          const city = p.address?.city || 'London';
          const country = p.address?.country || 'UK';
          const location = `${city}, ${country}`;
          const displayName = publicSellerName(p);
          sellersMap.set(p.userId, {
            displayName,
            avatarUrl: p.avatarUrl,
            joinedYear,
            location,
            city,
            country,
            sellerRating: p.sellerRating ?? 5.0,
          });
        });
      } catch (err) {
        this.logger.warn(`Failed to fetch evidence covers or seller info for listings: ${(err as Error).message}`);
      }
    }

    const withImagesAndSeller = data.map((l) => ({
      ...l,
      imageUrl: coverImages.get(l.id) ?? null,
      seller: sellersMap.get(l.sellerId) || {
        displayName: 'VeriBuy seller',
        joinedYear: new Date(l.createdAt).getFullYear(),
        location: 'London, UK',
        city: 'London',
        country: 'UK',
      },
    }));

    return {
      data: withImagesAndSeller,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Enforces the owner-facing listing state machine. Owners can submit,
   * pause, relist and delist — but can only (re)activate a listing that has
   * passed TrustLens verification and is not reserved by an in-flight checkout.
   */
  /**
   * Stops a seller listing the same device twice, usually from a retried submit.
   * Without an identifier, only a repeat within minutes counts, because bulk
   * sellers can honestly have several listings with the same title.
   */
  /** This seller's copy of the device that was created but never reached review. */
  private async findUnfinishedListing(dto: CreateListingDto): Promise<{ id: string } | null> {
    const imei = dto.imei?.replace(/[^0-9]/g, '').trim();
    const serial = dto.serialNumber?.trim();
    return this.prisma.listing.findFirst({
      where: {
        sellerId: dto.sellerId,
        status: ListingStatus.DRAFT,
        trustLensStatus: TrustLensStatus.PENDING,
        verificationRequest: { is: null },
        ...(imei || serial
          ? { OR: [...(imei ? [{ imei }] : []), ...(serial ? [{ serialNumber: serial }] : [])] }
          : { title: dto.title }),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  /**
   * Deletes listings abandoned before review: drafts and taken-down copies that
   * have no photos and were never sent for review, once their retention period
   * ends. Anything with an order, bid, offer or message stays. The audit log
   * keeps a note of each deletion.
   */
  async purgeAbandonedListings(): Promise<number> {
    const abandoned: Prisma.ListingWhereInput = {
      status: { in: [ListingStatus.DRAFT, ListingStatus.DELISTED] },
      trustLensStatus: TrustLensStatus.PENDING,
      updatedAt: { lt: new Date(Date.now() - abandonedListingRetentionDays() * 24 * 60 * 60 * 1000) },
      verificationRequest: { is: null },
      OR: [{ evidencePack: { is: null } }, { evidencePack: { is: { items: { none: {} } } } }],
      orders: { none: {} },
      bids: { none: {} },
      offers: { none: {} },
      messages: { none: {} },
    };
    const listings = await this.prisma.listing.findMany({
      where: abandoned,
      select: { id: true, title: true, status: true, createdAt: true },
      take: 200,
    });

    let purged = 0;
    for (const listing of listings) {
      const { count } = await this.prisma.listing.deleteMany({ where: { ...abandoned, id: listing.id } });
      if (count !== 1) continue;
      purged += 1;
      await this.redis.del(`listing:${listing.id}`).catch(() => {});
      await this.prisma.adminAuditLog
        .create({
          data: {
            action: 'Purged abandoned listing',
            targetType: 'purged listing',
            targetId: listing.id,
            note: `${listing.title}, was ${listing.status}, created ${listing.createdAt.toISOString().slice(0, 10)}`,
          },
        })
        .catch((err: Error) => this.logger.error(`Failed to record listing purge: ${err.message}`));
    }
    return purged;
  }

  private async assertNotDuplicateListing(dto: CreateListingDto): Promise<void> {
    const imei = dto.imei?.replace(/[^0-9]/g, '').trim();
    const serial = dto.serialNumber?.trim();
    const open = { sellerId: dto.sellerId, status: { notIn: [ListingStatus.SOLD, ListingStatus.DELISTED, ListingStatus.REJECTED] } };

    const existing = await this.prisma.listing.findFirst({
      where:
        imei || serial
          ? { ...open, OR: [...(imei ? [{ imei }] : []), ...(serial ? [{ serialNumber: serial }] : [])] }
          : { ...open, title: dto.title, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('You already have a listing for this device. Open it from your listings to carry on.');
    }
  }

  async assertSellerTransition(
    listing: Pick<Listing, 'id' | 'status' | 'trustLensStatus'>,
    target: ListingStatus,
  ): Promise<void> {
    const allowed = SELLER_TRANSITIONS[listing.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Cannot transition listing from ${listing.status} to ${target}`,
      );
    }

    if (target === ListingStatus.ACTIVE) {
      if (listing.trustLensStatus !== TrustLensStatus.PASSED) {
        throw new BadRequestException(
          'This listing must pass TrustLens verification before it can go live',
        );
      }
      const pendingCheckouts = await this.prisma.order.count({
        where: { listingId: listing.id, status: 'PENDING' },
      });
      if (pendingCheckouts > 0) {
        throw new BadRequestException(
          'A buyer is currently checking out this listing. Please try again later.',
        );
      }
    }
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

      // Enrich with seller public profile (join year, location, rating)
      const seller = await this.getPublicSellerDetails(listing.sellerId);
      listing = {
        ...listing,
        seller,
      };

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

  /**
   * Fetch public seller details (displayName, join year, location/city/country, rating)
   */
  async getPublicSellerDetails(sellerId: string) {
    try {
      const [user, ratings, profile] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: sellerId },
          select: { createdAt: true },
        }),
        this.prisma.rating.findMany({
          where: { order: { sellerId } },
          select: { rating: true },
        }),
        this.prisma.profile.findUnique({
          where: { userId: sellerId },
          select: {
            username: true,
            avatarUrl: true,
            sellerRating: true,
            verificationStatus: true,
            accountType: true,
            companyName: true,
            createdAt: true,
            // Postcode is deliberately not selected: only the city/county is public.
            address: {
              select: {
                city: true,
                state: true,
                country: true,
              },
            },
          },
        }),
      ]);

      const joinedYear = (user?.createdAt || profile?.createdAt)?.getFullYear() || new Date().getFullYear();
      const city = profile?.address?.city || 'London';
      const country = profile?.address?.country || 'UK';
      const state = profile?.address?.state || '';
      const location = city && country ? `${city}, ${country}` : city || country || 'United Kingdom';
      const displayName = publicSellerName(profile);

      return {
        displayName,
        accountType: profile?.accountType || 'INDIVIDUAL',
        companyName: profile?.companyName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        joinedYear,
        location,
        city,
        country,
        state,
        sellerRating: profile?.sellerRating ?? 5.0,
        ...feedbackSummary(ratings.map((r) => r.rating)),
      };
    } catch {
      return {
        displayName: 'VeriBuy seller',
        accountType: 'INDIVIDUAL',
        companyName: null,
        avatarUrl: null,
        joinedYear: new Date().getFullYear(),
        location: 'London, UK',
        city: 'London',
        country: 'UK',
        sellerRating: 5.0,
        ...feedbackSummary([]),
      };
    }
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

    const packs = await this.prisma.evidencePack.findMany({
      where: { listingId: { in: data.map((l) => l.id) } },
      select: {
        listingId: true,
        items: {
          select: { url: true },
          orderBy: { createdAt: 'asc' as const },
          take: 1,
        },
      },
    });
    const covers = new Map(packs.map((pack) => [pack.listingId, pack.items[0]?.url ?? null]));

    return {
      data: data.map((listing) => ({ ...listing, imageUrl: covers.get(listing.id) ?? null })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** User-facing status update with state machine validation */
  async updateStatus(
    id: string,
    status: ListingStatus,
    currentStatus: ListingStatus,
    isAdmin = false,
    reason?: string,
  ): Promise<Listing> {
    // Atomic update: only update if current status hasn't changed concurrently
    const updateData: Record<string, unknown> = {
      status,
      publishedAt: status === ListingStatus.ACTIVE ? new Date() : undefined,
    };
    // Only an administrator activation counts as a verification decision.
    // Owners can only re-activate listings that already PASSED (enforced upstream).
    const adminActivation = isAdmin && status === ListingStatus.ACTIVE;
    if (adminActivation) {
      updateData.trustLensStatus = TrustLensStatus.PASSED;
    }

    const listing = await this.prisma.listing.updateMany({
      where: { id, status: currentStatus },
      data: updateData as any,
    });

    if (listing.count === 0) {
      throw new BadRequestException(
        'Status update failed — listing status may have changed concurrently',
      );
    }

    if (adminActivation) {
      await this.prisma.verificationRequest.updateMany({
        where: { listingId: id, status: { not: ReviewStatus.PASSED } },
        data: {
          status: ReviewStatus.PASSED,
          completedAt: new Date(),
          reviewNotes: 'Activated by administrator',
        },
      }).catch(() => {});
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
          reason: reason?.trim() || undefined,
        });
      }
    }).catch((err: Error) => this.logger.error(`listing_status notify fetch failed: ${err.message}`));

    return updated;
  }

  /** Internal service-to-service status update — bypasses state machine */
  async updateStatusInternal(id: string, status: ListingStatus): Promise<Listing> {
    try {
      const current = await this.prisma.listing.findUnique({
        where: { id },
        select: { quantity: true, isBulkListing: true, status: true },
      });

      if (!current) {
        throw new NotFoundException('Listing not found');
      }

      // If marking SOLD but multi-unit quantity exists, decrement quantity and keep listing ACTIVE
      if (status === ListingStatus.SOLD && current.quantity > 1) {
        const updated = await this.prisma.listing.update({
          where: { id },
          data: {
            quantity: { decrement: 1 },
            status: ListingStatus.ACTIVE,
          },
        });
        await this.redis.del(`listing:${id}`).catch(() => {});
        return updated;
      }

      const updateData: any = { status };

      if (status === ListingStatus.ACTIVE) {
        updateData.publishedAt = new Date();
      }
      if (status === ListingStatus.SOLD) {
        updateData.quantity = 0;
      }

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

  async update(id: string, dto: UpdateListingDto, isAdmin = false): Promise<Listing> {
    try {
      const current = await this.prisma.listing.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Listing not found');
      }
      if (current.status === ListingStatus.SOLD) {
        throw new BadRequestException('Sold listings cannot be edited');
      }

      // Bidders committed to the auction as it stood.
      if (
        !isAdmin &&
        current.format === ListingFormat.AUCTION &&
        (current.bidCount ?? 0) > 0 &&
        dto.price !== undefined &&
        Number(dto.price) !== Number(current.price)
      ) {
        throw new BadRequestException('The price can’t change once bidding has started');
      }

      // Same state machines as the dedicated status endpoint, so the generic
      // PATCH can't be used to bypass verification.
      let targetStatus = dto.status !== undefined && dto.status !== current.status ? dto.status : undefined;
      if (targetStatus !== undefined) {
        if (isAdmin) {
          const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
          if (!allowed.includes(targetStatus)) {
            throw new BadRequestException(
              `Cannot transition listing from ${current.status} to ${targetStatus}`,
            );
          }
        } else {
          await this.assertSellerTransition(current, targetStatus);
        }
      }

      // Changing what the buyer is told about the device invalidates the
      // verification it earned (bait-and-switch protection). Price changes are fine.
      const changed = <K extends keyof Listing>(key: K, value: unknown) =>
        value !== undefined && (value || null) !== (current[key] || null);
      const materialChange =
        changed('title', dto.title) ||
        changed('description', dto.description) ||
        changed('conditionGrade', dto.conditionGrade) ||
        changed('color', dto.color) ||
        changed('storageCapacity', dto.storageCapacity);
      const requiresReverification =
        !isAdmin &&
        materialChange &&
        current.trustLensStatus === TrustLensStatus.PASSED;
      if (requiresReverification) {
        targetStatus = ListingStatus.UNDER_REVIEW;
      }

      const listing = await this.prisma.listing.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          // Orders are settled in GBP only; listing currency is fixed.
          ...(dto.conditionGrade !== undefined && { conditionGrade: dto.conditionGrade }),
          ...(targetStatus !== undefined && { status: targetStatus }),
          ...(requiresReverification && { trustLensStatus: TrustLensStatus.REQUIRES_REVIEW }),
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
    reviewNotes?: string,
  ): Promise<Listing> {
    try {
      const current = await this.prisma.listing.findUnique({ where: { id }, select: { status: true } });
      if (!current) {
        throw new NotFoundException('Listing not found');
      }

      // Derive the listing status from the trust lens outcome — relative to where
      // the listing is now. A verification (re-)run must never resurrect a sold,
      // delisted or mid-checkout listing, and a failed/flagged result must take
      // a live listing off sale.
      const statusUpdate: Record<string, unknown> = {};
      const awaitingPublication: string[] = [
        ListingStatus.DRAFT,
        ListingStatus.SUBMITTED,
        ListingStatus.UNDER_REVIEW,
        ListingStatus.APPROVED,
      ];
      if (trustLensStatus === 'PASSED' && awaitingPublication.includes(current.status)) {
        statusUpdate['status'] = ListingStatus.ACTIVE;
        statusUpdate['publishedAt'] = new Date();
      } else if (trustLensStatus === 'FAILED' && current.status !== ListingStatus.SOLD) {
        statusUpdate['status'] = ListingStatus.REJECTED;
      } else if (
        trustLensStatus === 'REQUIRES_REVIEW' &&
        (current.status === ListingStatus.ACTIVE || current.status === ListingStatus.APPROVED)
      ) {
        statusUpdate['status'] = ListingStatus.UNDER_REVIEW;
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

      // Tell the seller why their listing was rejected so they can fix and resubmit.
      if (statusUpdate['status'] === ListingStatus.REJECTED) {
        this.getSellerInfo(listing.sellerId)
          .then((seller) => {
            if (seller) {
              this.notifications.notifyListingStatusChanged({
                sellerEmail: seller.email,
                sellerName: seller.name,
                listingTitle: listing.title,
                listingId: listing.id,
                status: ListingStatus.REJECTED,
                reason: reviewNotes,
              });
            }
          })
          .catch(() => {});
      }

      return listing;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  async getDraft(userId: string) {
    return this.prisma.listingDraft.findUnique({
      where: { userId },
      select: { data: true, step: true, updatedAt: true },
    });
  }

  async saveDraft(userId: string, data: Record<string, unknown>, step: number) {
    const safe = pickDraftFields(data);
    return this.prisma.listingDraft.upsert({
      where: { userId },
      create: { userId, data: safe, step },
      update: { data: safe, step },
      select: { data: true, step: true, updatedAt: true },
    });
  }

  async deleteDraft(userId: string): Promise<void> {
    await this.prisma.listingDraft.deleteMany({ where: { userId } });
  }

  /**
   * Deletes a listing and what hangs off it. A listing someone has paid for,
   * or is paying for, is a record of a sale and stays; checkouts that were
   * abandoned unpaid don't hold a listing back and are removed with it.
   */
  async delete(id: string): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: { listingId: id },
      select: { status: true, paidAt: true, refundedAt: true },
    });
    const abandoned = (o: (typeof orders)[number]) => o.status === 'CANCELLED' && !o.paidAt && !o.refundedAt;
    if (orders.some((o) => o.status === 'PENDING')) {
      throw new ConflictException('A buyer is checking out this listing right now. Try again in a little while.');
    }
    if (orders.some((o) => !abandoned(o))) {
      throw new ConflictException('This listing has an order, so it can’t be deleted. It stays in your sales history.');
    }
    try {
      await this.prisma.$transaction([
        this.prisma.order.deleteMany({ where: { listingId: id, status: 'CANCELLED', paidAt: null, refundedAt: null } }),
        this.prisma.listing.delete({ where: { id } }),
      ]);
      await this.redis.del(`listing:${id}`).catch(() => {});
      this.logger.log(`Deleted listing ${id}`);
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw err;
    }
  }

  /**
   * Places a proxy bid on an active auction.
   * Includes anti-sniping soft close (extends auction by 2 mins if bid placed within last 2 mins).
   */
  async placeBid(listingId: string, bidderId: string, maxBid: number) {
    if (typeof maxBid !== 'number' || maxBid <= 0 || isNaN(maxBid)) {
      throw new BadRequestException('Invalid bid amount');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.format !== ListingFormat.AUCTION) {
      throw new BadRequestException('Bids can only be placed on auction listings');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Auction is not active');
    }

    if (listing.sellerId === bidderId) {
      throw new BadRequestException('Sellers cannot bid on their own listings');
    }

    if (!listing.auctionEndsAt || new Date() >= listing.auctionEndsAt) {
      throw new BadRequestException('Auction has ended');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // ACID Isolation: acquire a row-level lock on the listing to prevent
      // concurrent bid race conditions. SELECT FOR UPDATE blocks other
      // transactions from reading this row until we commit.
      if (typeof (tx as any).$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "listings" WHERE id = ${listingId} FOR UPDATE`;
      }

      // Re-fetch listing within the locked transaction
      const current = await tx.listing.findUnique({
        where: { id: listingId },
      });

      if (!current || current.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException('Auction is no longer active');
      }

      if (!current.auctionEndsAt || new Date() >= current.auctionEndsAt) {
        throw new BadRequestException('Auction has ended');
      }

      const startingBid = current.startingBid ? Number(current.startingBid) : 0.99;
      const currentBidNum = current.currentBid ? Number(current.currentBid) : null;
      const highestMaxBidNum = current.highestMaxBid ? Number(current.highestMaxBid) : null;
      const reservePriceNum = current.reservePrice ? Number(current.reservePrice) : null;

      const minNextBid = calculateMinimumNextBid(
        currentBidNum,
        startingBid,
        current.bidCount,
      );

      if (maxBid < minNextBid) {
        throw new BadRequestException(
          `Bid amount £${maxBid.toFixed(2)} must be at least the minimum bid of £${minNextBid.toFixed(2)}`,
        );
      }

      const outcome = calculateProxyBidOutcome({
        newBidderId: bidderId,
        newMaxBid: maxBid,
        currentBid: currentBidNum,
        startingBid,
        reservePrice: reservePriceNum,
        highestBidderId: current.highestBidderId,
        highestMaxBid: highestMaxBidNum,
        bidCount: current.bidCount,
      });

      // Anti-sniping soft close: If bid placed within last 2 minutes, extend by 2 minutes
      const now = Date.now();
      const endTime = current.auctionEndsAt.getTime();
      const twoMinutesMs = 2 * 60 * 1000;
      let newEndsAt = current.auctionEndsAt;
      let extended = false;

      if (endTime - now < twoMinutesMs) {
        newEndsAt = new Date(endTime + twoMinutesMs);
        extended = true;
      }

      // Record bid in audit history
      await tx.bid.create({
        data: {
          listingId,
          bidderId,
          amount: outcome.bidPlacedAmount,
          maxBid,
        },
      });

      // Update listing state
      const updatedListing = await tx.listing.update({
        where: { id: listingId },
        data: {
          currentBid: outcome.currentBid,
          highestBidderId: outcome.leadingBidderId,
          highestMaxBid: outcome.highestMaxBid,
          bidCount: { increment: 1 },
          auctionEndsAt: newEndsAt,
        },
        select: PUBLIC_SELECT,
      });

      return {
        listing: updatedListing,
        outcome,
        extended,
        newEndsAt,
      };
    });

    await this.redis.del(`listing:${listingId}`).catch(() => {});

    // Notify outbid user if someone was outbid
    if (
      result.outcome.outbidBidderId &&
      result.outcome.outbidBidderId !== bidderId
    ) {
      await this.recordAuctionNotice(
        listing.sellerId,
        result.outcome.outbidBidderId,
        listing.id,
        'You’ve been outbid',
        `Someone outbid you on ${listing.title}. The current bid is £${result.outcome.currentBid.toFixed(2)}.`,
      );
      this.getBidderInfo(result.outcome.outbidBidderId).then((bidder) => {
        if (bidder) {
          this.notifications.notifyOutbid({
            bidderEmail: bidder.email,
            bidderName: bidder.name,
            listingTitle: listing.title,
            listingId: listing.id,
            newCurrentBid: result.outcome.currentBid,
          });
        }
      }).catch((err: Error) => this.logger.warn(`Failed to notify outbid bidder: ${err.message}`));
    }

    return {
      success: true,
      currentBid: result.outcome.currentBid,
      highestBidderId: result.outcome.leadingBidderId,
      isLeading: result.outcome.leadingBidderId === bidderId,
      bidCount: result.listing.bidCount,
      auctionEndsAt: result.newEndsAt,
      extended: result.extended,
      reserveMet: result.outcome.reserveMet,
    };
  }

  /**
   * Returns anonymized bid history for a listing (e.g. j***n)
   */
  async getBidHistory(listingId: string) {
    const bids = await this.prisma.bid.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bidderId: true,
        amount: true,
        createdAt: true,
      },
    });

    return bids.map((b) => ({
      id: b.id,
      bidder: anonymizeBidderHandle(b.bidderId),
      amount: Number(b.amount),
      createdAt: b.createdAt,
    }));
  }

  /**
   * Settles auctions that have passed their endsAt timestamp.
   * Can be invoked via scheduled cron or on-demand.
   */
  async settleExpiredAuctions(): Promise<number> {
    const expired = await this.prisma.listing.findMany({
      where: {
        format: ListingFormat.AUCTION,
        status: ListingStatus.ACTIVE,
        auctionEndsAt: { lte: new Date() },
      },
    });

    let settledCount = 0;
    for (const listing of expired) {
      try {
        const curBid = listing.currentBid ? Number(listing.currentBid) : 0;
        const resPrice = listing.reservePrice ? Number(listing.reservePrice) : 0;
        const reserveMet = !listing.reservePrice || curBid >= resPrice;
        const hasWinner = listing.highestBidderId && reserveMet;

        // Compare-and-set: only one instance/run may settle (and notify) each auction.
        const { count } = await this.prisma.listing.updateMany({
          where: { id: listing.id, status: ListingStatus.ACTIVE },
          data: {
            status: ListingStatus.AUCTION_ENDED,
          },
        });
        if (count !== 1) continue;

        await this.redis.del(`listing:${listing.id}`).catch(() => {});
        settledCount++;

        if (hasWinner && listing.highestBidderId) {
          await this.recordAuctionNotice(
            listing.sellerId,
            listing.highestBidderId,
            listing.id,
            'You won the auction',
            `You won ${listing.title} at £${curBid.toFixed(2)}. Open the listing and pay within ${auctionPaymentWindowHours()} hours, or the sale lapses.`,
          );
          const winnerInfo = await this.getBidderInfo(listing.highestBidderId);
          if (winnerInfo) {
            const checkoutDeadline = auctionPaymentDeadline(listing.auctionEndsAt ?? new Date(), auctionPaymentWindowHours()).toISOString();
            this.notifications.notifyAuctionWon({
              winnerEmail: winnerInfo.email,
              winnerName: winnerInfo.name,
              listingTitle: listing.title,
              listingId: listing.id,
              winningBid: curBid,
              checkoutDeadline,
            });
          }
        }
      } catch (err) {
        this.logger.error(`Failed to settle expired auction ${listing.id}: ${(err as Error).message}`);
      }
    }

    return settledCount;
  }

  /**
   * Fetch user info for bidder notifications.
   */
  /**
   * Takes back an auction the winner didn't pay for in time, so it doesn't sit
   * unsold and the seller can list it again. A checkout in progress holds the
   * listing as INACTIVE, so it's left alone until that checkout ends.
   */
  async releaseUnpaidAuctions(): Promise<number> {
    const cutoff = new Date(Date.now() - auctionPaymentWindowHours() * 60 * 60 * 1000);
    const lapsed = await this.prisma.listing.findMany({
      where: {
        format: ListingFormat.AUCTION,
        status: ListingStatus.AUCTION_ENDED,
        highestBidderId: { not: null },
        auctionEndsAt: { lte: cutoff },
      },
      select: {
        id: true,
        title: true,
        sellerId: true,
        highestBidderId: true,
        currentBid: true,
        reservePrice: true,
      },
    });

    let released = 0;
    for (const listing of lapsed) {
      try {
        const { count } = await this.prisma.listing.updateMany({
          where: { id: listing.id, status: ListingStatus.AUCTION_ENDED },
          data: { status: ListingStatus.DELISTED, highestBidderId: null, highestMaxBid: null },
        });
        if (count !== 1) continue;
        released++;
        await this.redis.del(`listing:${listing.id}`).catch(() => {});

        // Below the reserve nobody won, so there's no missed payment to report.
        const won = !listing.reservePrice || Number(listing.currentBid) >= Number(listing.reservePrice);
        if (won && listing.highestBidderId) {
          await this.recordAuctionNotice(
            listing.sellerId,
            listing.highestBidderId,
            listing.id,
            'Your auction win has lapsed',
            `You didn’t pay for ${listing.title} within ${auctionPaymentWindowHours()} hours, so the sale has been cancelled.`,
          );
          await this.recordAuctionNotice(
            listing.highestBidderId,
            listing.sellerId,
            listing.id,
            'The winning bidder didn’t pay',
            `The winner of ${listing.title} didn’t pay within ${auctionPaymentWindowHours()} hours. The listing is off sale, and you can list the device again.`,
          );
        }
      } catch (err) {
        this.logger.error(`Failed to release unpaid auction ${listing.id}: ${(err as Error).message}`);
      }
    }
    return released;
  }

  /** Shows in the bidder's VeriBuy updates, so the app can tell them as well as email. */
  private async recordAuctionNotice(
    senderId: string,
    recipientId: string,
    listingId: string,
    subject: string,
    content: string,
  ): Promise<void> {
    await this.prisma.message
      .create({ data: { senderId, recipientId, listingId, subject, content, isSystem: true } })
      .catch((err: Error) => this.logger.warn(`Failed to record auction notice: ${err.message}`));
  }

  private async getBidderInfo(
    bidderId: string,
  ): Promise<{ name: string; email: string } | null> {
    return this.getSellerInfo(bidderId);
  }

  /**
   * Fetch seller name + email from auth-service.
   * Returns null on any failure — callers must handle gracefully.
   */
  private async getSellerInfo(
    sellerId: string,
  ): Promise<{ name: string; email: string } | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: sellerId },
        select: { name: true, email: true },
      });
      if (!user || !user.email) return null;
      return { name: user.name, email: user.email };
    } catch {
      return null;
    }
  }
}
