import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService } from './evidence.service';
import { CreateEvidencePackDto } from './dto/create-evidence-pack.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';

/** Allowed MIME types — must also match magic bytes below. */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Maximum number of evidence items per pack. */
const MAX_ITEMS_PER_PACK = 20;

/** Maximum file size: 10 MB. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Validate magic bytes (file signature) against expected MIME type.
 * Prevents MIME-type spoofing attacks where a client lies about file type.
 */
function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  // WebP: 52 49 46 46 __ __ __ __ 57 45 42 50 (RIFF....WEBP)
  if (mimetype === 'image/webp') {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return false;
}

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller('evidence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @Public()
  healthCheck() {
    return { message: 'evidence-service is running', timestamp: new Date() };
  }

  /**
   * Create an evidence pack for a listing.
   * sellerId is always taken from the authenticated JWT — never from the client body.
   */
  @Post('packs')
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async createEvidencePack(
    @Body() dto: CreateEvidencePackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evidenceService.createEvidencePack({ ...dto, sellerId: user.userId });
  }

  /**
   * Upload evidence file.
   * sellerId is always taken from the authenticated JWT — never from the client body.
   * File size is capped at 10 MB at the interceptor level.
   * Magic bytes are validated to prevent MIME-type spoofing.
   * Pack item count is capped at MAX_ITEMS_PER_PACK.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async uploadEvidence(
    @Body() dto: UploadEvidenceDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate MIME type (allow-list)
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    // Magic byte check — prevents MIME spoofing
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File content does not match the declared MIME type.',
      );
    }

    // Validate metadata JSON length (enforced by DTO @MaxLength, but also parse-check)
    if (dto.metadata) {
      try {
        JSON.parse(dto.metadata);
      } catch {
        throw new BadRequestException('metadata must be valid JSON');
      }
    }

    // Override sellerId from JWT
    const enrichedDto = { ...dto, sellerId: user.userId };

    return this.evidenceService.uploadEvidence(enrichedDto, file);
  }

  /**
   * Get evidence pack by listing ID — public so buyers and anonymous visitors can see product photos.
   */
  @Get('listing/:listingId')
  @Public()
  async getEvidencePackByListing(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.evidenceService.getEvidencePackByListing(listingId);
  }

  /**
   * Get evidence pack by pack ID.
   */
  @Get('packs/:packId')
  @Roles('SELLER', 'ADMIN')
  async getEvidencePack(
    @Param('packId', ParseUUIDPipe) packId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const pack = await this.evidenceService.getEvidencePack(packId);
    if (pack && user.role !== 'ADMIN' && pack.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own evidence packs');
    }
    return pack;
  }

  /**
   * Get all evidence packs for a seller.
   */
  @Get('seller/:sellerId')
  @Roles('SELLER', 'ADMIN')
  async getSellerEvidencePacks(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'ADMIN' && sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own evidence packs');
    }
    return this.evidenceService.getSellerEvidencePacks(sellerId, pagination);
  }

  /**
   * Delete an evidence item.
   * Ownership is verified in a single service call that fetches the item + pack together.
   */
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('SELLER', 'ADMIN')
  async deleteEvidenceItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.evidenceService.deleteEvidenceItemWithOwnerCheck(itemId, user.userId, user.role);
  }
}
