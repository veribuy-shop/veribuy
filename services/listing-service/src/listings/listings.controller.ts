import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Headers,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UlistingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateStatusDto, ALLOWED_TRANSITIONS } from './dto/update-status.dto';
import { UpdateTrustLensDto } from './dto/update-trust-lens.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';
import * as crypto from 'crypto';

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller('listings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UlistingsController {
  constructor(
    private readonly listingsService: UlistingsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthenticatedUser) {
    // Override sellerId from JWT — never trust client-supplied sellerId
    dto.sellerId = user.userId;
    return this.listingsService.create(dto);
  }

  @Get()
  @Public()
  async findAll(@Query() query: GetListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  // Static routes MUST be declared before dynamic `:id` to avoid wildcard capturing them
  @Get('seller/:sellerId')
  @Public()
  async findBySeller(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.listingsService.findBySeller(sellerId, pagination);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.findOne(id);
  }

  /**
   * PUT :id/status — authenticated user-facing status update (SELLER transitions own listing)
   */
  @Put(':id/status')
  @Roles('SELLER', 'ADMIN')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const listing = await this.listingsService.findOneRaw(id);

    // Verify ownership unless admin
    if (user.role !== 'ADMIN' && listing.sellerId !== user.userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    // Enforce state machine
    const allowed = ALLOWED_TRANSITIONS[listing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition listing from ${listing.status} to ${dto.status}`,
      );
    }

    return this.listingsService.updateStatus(id, dto.status, listing.status);
  }

  /**
   * PATCH :id/status — internal service-to-service endpoint (e.g. transaction-service).
   * Protected by INTERNAL_SERVICE_TOKEN header comparison.
   * Bypasses state machine so transaction-service can force SOLD/DELISTED.
   */
  @Patch(':id/status')
  async updateListingStatusInternal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @Headers('x-internal-token') token: string,
  ) {
    const internalToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN');
    if (!internalToken) {
      throw new UnauthorizedException('Internal token not configured');
    }

    // Timing-safe comparison
    const tokenBuf = Buffer.from(token ?? '');
    const expectedBuf = Buffer.from(internalToken);
    const same =
      tokenBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(tokenBuf, expectedBuf);

    if (!same) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return this.listingsService.updateStatusInternal(id, dto.status);
  }

  @Patch(':id')
  @Roles('SELLER', 'ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const listing = await this.listingsService.findOneRaw(id);

    // Verify ownership unless admin
    if (user.role !== 'ADMIN' && listing.sellerId !== user.userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    return this.listingsService.update(id, dto);
  }

  @Put(':id/trust-lens')
  @Roles('ADMIN')
  async updateTrustLensStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrustLensDto,
  ) {
    return this.listingsService.updateTrustLensStatus(
      id,
      dto.trustLensStatus,
      dto.conditionGrade,
      dto.integrityFlags,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('SELLER', 'ADMIN')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const listing = await this.listingsService.findOneRaw(id);

    // Verify ownership unless admin
    if (user.role !== 'ADMIN' && listing.sellerId !== user.userId) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    return this.listingsService.delete(id);
  }
}
