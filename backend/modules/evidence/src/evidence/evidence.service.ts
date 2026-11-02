import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TrustLensSyncService } from './trust-lens-sync.service';
import { CreateEvidencePackDto } from './dto/create-evidence-pack.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { EvidenceType } from '.prisma/veribuy-client';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { RedisService } from '@veribuy/redis-cache';

/** Maximum number of evidence items per pack. */
const MAX_ITEMS_PER_PACK = 20;

/** Shared item select shape — used across all queries. */
const ITEM_SELECT = {
  id: true,
  type: true,
  url: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  timestamp: true,
  metadata: true,
  createdAt: true,
} as const;

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private trustLensSync: TrustLensSyncService,
    private redis: RedisService,
  ) {}

  /**
   * Upsert an evidence pack for a listing.
   * If a pack already exists for this listing, return it.
   * Uses upsert to avoid P2002 race conditions on concurrent first uploads.
   */
  async assertListingOwner(listingId: string, userId: string, isAdmin: boolean): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true, status: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (!isAdmin && listing.sellerId !== userId) {
      throw new ForbiddenException('You can only add evidence to your own listings');
    }
    if (listing.status === 'SOLD') {
      throw new BadRequestException('Evidence cannot be changed on a sold listing');
    }
  }

  async createEvidencePack(dto: CreateEvidencePackDto) {
    const upsertPack = () =>
      this.prisma.evidencePack.upsert({
        where: { listingId: dto.listingId },
        create: {
          listingId: dto.listingId,
        },
        update: {},
        include: {
          items: { select: ITEM_SELECT },
        },
      });

    // Prisma's upsert is not atomic: parallel first uploads for the same listing
    // can both try to INSERT. The loser gets P2002 — the pack now exists, so retry.
    let pack: Awaited<ReturnType<typeof upsertPack>>;
    try {
      pack = await upsertPack();
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      pack = await upsertPack();
    }

    this.logger.log(`Upserted evidence pack ${pack.id} for listing ${dto.listingId}`);
    return pack;
  }

  /**
   * Upload evidence file to Cloudinary and create database record.
   * Enforces per-pack item count limit (MAX_ITEMS_PER_PACK).
   * sellerId is always taken from the dto (which was injected from JWT in the controller).
   */
  async uploadEvidence(dto: UploadEvidenceDto, file: Express.Multer.File, isAdmin = false) {
    // SECURITY: only the listing owner (or an admin) may attach evidence —
    // uploads also fulfil TrustLens checklist items for the listing.
    await this.assertListingOwner(dto.listingId, dto.sellerId, isAdmin);
    if (!isAdmin) await this.assertPhotosCanChange(dto.listingId);

    // Ensure evidence pack exists (upsert handles race conditions)
    const pack = await this.createEvidencePack({
      listingId: dto.listingId,
      sellerId: dto.sellerId,
    });

    // Enforce item count limit
    const itemCount = await this.prisma.evidenceItem.count({
      where: { packId: pack.id },
    });
    if (itemCount >= MAX_ITEMS_PER_PACK) {
      throw new BadRequestException(
        `Evidence pack is full. Maximum ${MAX_ITEMS_PER_PACK} items allowed per pack.`,
      );
    }

    // Build Cloudinary folder and public ID
    const folder = `evidence-packs/${dto.listingId}/${dto.type.toLowerCase()}`;
    const publicId = uuidv4();

    // Upload to Cloudinary — returns the permanent secure_url
    const url = await this.cloudinaryService.uploadFile(
      file.buffer,
      folder,
      publicId,
      file.mimetype,
    );

    const cloudinaryPublicId = `${folder}/${publicId}`;

    // Parse metadata if provided
    let parsedMetadata: Record<string, unknown> | null = null;
    if (dto.metadata) {
      try {
        parsedMetadata = JSON.parse(dto.metadata);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to parse metadata for listing ${dto.listingId}: ${message}`);
      }
    }

    // Create database record
    const evidenceItem = await this.prisma.evidenceItem.create({
      data: {
        packId: pack.id,
        type: dto.type as EvidenceType,
        url,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        metadata: {
          ...(parsedMetadata ?? {}),
          description: dto.description,
          cloudinaryPublicId,
        },
      },
    });

    this.logger.log(`Uploaded evidence ${evidenceItem.id} for listing ${dto.listingId}`);

    if (!isAdmin) await this.returnToReviewIfVerified(dto.listingId);

    // Notify trust-lens-service to mark the corresponding checklist item fulfilled.
    // Fire-and-forget — evidence upload must never fail because trust-lens is unreachable.
    this.trustLensSync
      .notifyEvidenceUploaded(dto.listingId, dto.type)
      .catch(() => {});

    return evidenceItem;
  }

  /**
   * Get evidence pack by listing ID.
   */
  async getEvidencePackByListing(listingId: string) {
    const pack = await this.prisma.evidencePack.findUnique({
      where: { listingId },
      include: {
        items: {
          select: ITEM_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pack) {
      throw new NotFoundException(`Evidence pack not found for listing ${listingId}`);
    }

    return pack;
  }

  /**
   * Get evidence pack by ID.
   */
  async getEvidencePack(packId: string) {
    const pack = await this.prisma.evidencePack.findUnique({
      where: { id: packId },
      include: {
        listing: {
          select: { sellerId: true },
        },
        items: {
          select: ITEM_SELECT,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pack) {
      throw new NotFoundException(`Evidence pack not found: ${packId}`);
    }

    return pack;
  }

  /**
   * Delete an evidence item with integrated ownership check.
   * Fetches item + pack in a single query, verifies ownership, then deletes.
   */
  async deleteEvidenceItemWithOwnerCheck(
    itemId: string,
    requestingUserId: string,
    requestingRole: string,
  ) {
    const item = await this.prisma.evidenceItem.findUnique({
      where: { id: itemId },
      include: {
        pack: {
          select: {
            id: true,
            listingId: true,
            listing: {
              select: { sellerId: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Evidence item not found: ${itemId}`);
    }

    if (requestingRole !== 'ADMIN' && item.pack.listing.sellerId !== requestingUserId) {
      throw new ForbiddenException('You can only delete your own evidence items');
    }

    const isAdmin = requestingRole === 'ADMIN';
    if (!isAdmin) await this.assertPhotosCanChange(item.pack.listingId);

    // Attempt to delete the Cloudinary asset
    const cloudinaryPublicId =
      (item.metadata as any)?.cloudinaryPublicId ??
      this.cloudinaryService.extractPublicId(item.url);

    if (cloudinaryPublicId) {
      try {
        await this.cloudinaryService.deleteFile(cloudinaryPublicId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to delete Cloudinary asset for item ${itemId}: ${message}`,
        );
      }
    }

    await this.prisma.evidenceItem.delete({ where: { id: itemId } });

    if (!isAdmin) await this.returnToReviewIfVerified(item.pack.listingId);

    this.logger.log(`Deleted evidence item ${itemId}`);
  }

  /** A buyer's dispute relies on these photos, so they're fixed once there's a buyer. */
  private async assertPhotosCanChange(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { status: true },
    });
    if (listing?.status === 'SOLD' || listing?.status === 'AUCTION_ENDED') {
      throw new BadRequestException('Photos can’t be changed once the device has a buyer');
    }
  }

  /**
   * Trust Lens reviewed the photos, so changing them invalidates a pass, the
   * same as editing the description (bait-and-switch protection).
   */
  private async returnToReviewIfVerified(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { status: true, trustLensStatus: true },
    });
    if (listing?.trustLensStatus !== 'PASSED') return;

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        trustLensStatus: 'REQUIRES_REVIEW',
        ...(listing.status === 'ACTIVE' && { status: 'UNDER_REVIEW' }),
      },
    });
    await this.redis.del(`listing:${listingId}`).catch(() => {});
  }

  /**
   * Get all evidence packs for a seller.
   */
  async getSellerEvidencePacks(
    sellerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.evidencePack.findMany({
        where: { listing: { sellerId } },
        skip,
        take: limit,
        include: {
          items: {
            select: ITEM_SELECT,
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.evidencePack.count({ where: { listing: { sellerId } } }),
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
}
