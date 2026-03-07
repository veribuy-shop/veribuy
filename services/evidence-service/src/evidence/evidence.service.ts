import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateEvidencePackDto } from './dto/create-evidence-pack.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { EvidenceType } from '.prisma/evidence-client';
import { v4 as uuidv4 } from 'uuid';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';

@Injectable()
export class UevidenceService {
  private readonly logger = new Logger(UevidenceService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Create or get an evidence pack for a listing
   */
  async createEvidencePack(dto: CreateEvidencePackDto) {
    // Check if evidence pack already exists
    const existing = await this.prisma.evidencePack.findUnique({
      where: { listingId: dto.listingId },
      include: {
        items: {
          select: {
            id: true,
            type: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            timestamp: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new evidence pack
    const pack = await this.prisma.evidencePack.create({
      data: {
        listingId: dto.listingId,
        sellerId: dto.sellerId,
      },
      include: {
        items: {
          select: {
            id: true,
            type: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            timestamp: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    this.logger.log(`Created evidence pack ${pack.id} for listing ${dto.listingId}`);
    return pack;
  }

  /**
   * Upload evidence file to Cloudinary and create database record
   */
  async uploadEvidence(
    dto: UploadEvidenceDto,
    file: Express.Multer.File,
  ) {
    // Ensure evidence pack exists
    let pack = await this.prisma.evidencePack.findUnique({
      where: { listingId: dto.listingId },
    });

    if (!pack) {
      pack = await this.createEvidencePack({
        listingId: dto.listingId,
        sellerId: dto.sellerId,
      });
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

    // Parse metadata if provided
    let metadata = null;
    if (dto.metadata) {
      try {
        metadata = JSON.parse(dto.metadata);
      } catch (error) {
        this.logger.warn(`Failed to parse metadata: ${error.message}`);
      }
    }

    // Create database record — url is the Cloudinary secure_url
    const evidenceItem = await this.prisma.evidenceItem.create({
      data: {
        packId: pack.id,
        type: dto.type as EvidenceType,
        url,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        metadata: metadata || {
          description: dto.description,
          cloudinaryPublicId: `${folder}/${publicId}`,
        },
      },
    });

    this.logger.log(
      `Uploaded evidence ${evidenceItem.id} for listing ${dto.listingId}`,
    );

    return evidenceItem;
  }

  /**
   * Get evidence pack by listing ID
   */
  async getEvidencePackByListing(listingId: string) {
    const pack = await this.prisma.evidencePack.findUnique({
      where: { listingId },
      include: {
        items: {
          select: {
            id: true,
            type: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            timestamp: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pack) {
      throw new NotFoundException(
        `Evidence pack not found for listing ${listingId}`,
      );
    }

    return pack;
  }

  /**
   * Get evidence pack by ID
   */
  async getEvidencePack(packId: string) {
    const pack = await this.prisma.evidencePack.findUnique({
      where: { id: packId },
      include: {
        items: {
          select: {
            id: true,
            type: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            timestamp: true,
            metadata: true,
            createdAt: true,
          },
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
   * Get a single evidence item with its parent pack (for ownership verification)
   */
  async getEvidenceItem(itemId: string) {
    const item = await this.prisma.evidenceItem.findUnique({
      where: { id: itemId },
      include: {
        pack: {
          select: {
            id: true,
            sellerId: true,
            listingId: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Evidence item not found: ${itemId}`);
    }

    return item;
  }

  /**
   * Delete evidence item and its Cloudinary asset
   */
  async deleteEvidenceItem(itemId: string) {
    const item = await this.prisma.evidenceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Evidence item not found: ${itemId}`);
    }

    // Attempt to delete the asset from Cloudinary
    const publicId = this.cloudinaryService.extractPublicId(item.url);
    if (publicId) {
      try {
        await this.cloudinaryService.deleteFile(publicId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete Cloudinary asset for item ${itemId}: ${error.message}`,
        );
      }
    }

    // Delete from database
    await this.prisma.evidenceItem.delete({
      where: { id: itemId },
    });

    this.logger.log(`Deleted evidence item ${itemId}`);
  }

  /**
   * Get all evidence packs for a seller
   */
  async getSellerEvidencePacks(sellerId: string, pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.evidencePack.findMany({
        where: { sellerId },
        skip,
        take: limit,
        include: {
          items: {
            select: {
              id: true,
              type: true,
              url: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
              timestamp: true,
              metadata: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.evidencePack.count({ where: { sellerId } }),
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
