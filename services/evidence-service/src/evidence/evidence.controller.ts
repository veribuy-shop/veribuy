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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UevidenceService } from './evidence.service';
import { CreateEvidencePackDto } from './dto/create-evidence-pack.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';

@Controller('evidence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UevidenceController {
  constructor(private readonly evidenceService: UevidenceService) {}

  @Get()
  @Public()
  healthCheck() {
    return { message: 'evidence-service is running', timestamp: new Date() };
  }

  /**
   * Create an evidence pack for a listing
   */
  @Post('packs')
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async createEvidencePack(@Body() dto: CreateEvidencePackDto, @CurrentUser() user: any) {
    // Ensure the seller ID in the DTO matches the authenticated user
    if (dto.sellerId !== user.userId) {
      throw new ForbiddenException('You can only create evidence packs for yourself');
    }
    return this.evidenceService.createEvidencePack(dto);
  }

  /**
   * Upload evidence file
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async uploadEvidence(
    @Body() dto: UploadEvidenceDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Ensure the seller ID in the DTO matches the authenticated user
    if (dto.sellerId !== user.userId) {
      throw new ForbiddenException('You can only upload evidence for yourself');
    }

    // Validate file type (images only for now)
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 10MB');
    }

    return this.evidenceService.uploadEvidence(dto, file);
  }

  /**
   * Get evidence pack by listing ID — public so buyers and anonymous visitors can see product photos.
   * Seller ownership check is not applicable here; all items in a pack belong to the listing's seller
   * and are intentionally displayed as product images on the marketplace.
   */
  @Get('listing/:listingId')
  @Public()
  async getEvidencePackByListing(@Param('listingId') listingId: string) {
    return this.evidenceService.getEvidencePackByListing(listingId);
  }

  /**
   * Get evidence pack by pack ID
   */
  @Get('packs/:packId')
  @Roles('SELLER', 'ADMIN')
  async getEvidencePack(@Param('packId') packId: string, @CurrentUser() user: any) {
    const pack = await this.evidenceService.getEvidencePack(packId);
    // Sellers can only view their own evidence packs
    if (pack && user.role !== 'ADMIN' && pack.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own evidence packs');
    }
    return pack;
  }

  /**
   * Get all evidence packs for a seller
   */
  @Get('seller/:sellerId')
  @Roles('SELLER', 'ADMIN')
  async getSellerEvidencePacks(@Param('sellerId') sellerId: string, @Query() pagination: PaginationDto, @CurrentUser() user: any) {
    // Users can only view their own evidence packs unless admin
    if (user.role !== 'ADMIN' && sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own evidence packs');
    }
    return this.evidenceService.getSellerEvidencePacks(sellerId, pagination);
  }

  /**
   * Delete an evidence item
   */
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('SELLER', 'ADMIN')
  async deleteEvidenceItem(@Param('itemId') itemId: string, @CurrentUser() user: any) {
    // Fetch item with its parent pack to verify ownership
    const item = await this.evidenceService.getEvidenceItem(itemId);

    if (user.role !== 'ADMIN' && item.pack.sellerId !== user.userId) {
      throw new ForbiddenException('You can only delete your own evidence items');
    }

    await this.evidenceService.deleteEvidenceItem(itemId);
  }
}
