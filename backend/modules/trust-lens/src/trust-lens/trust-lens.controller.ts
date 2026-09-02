import { Controller, Get, Post, Delete, Body, Param, Patch, Query, UseGuards, ForbiddenException, NotFoundException, ParseUUIDPipe, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as nodeCrypto from 'crypto';
import { TrustLensService } from './trust-lens.service';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';
import { UpdateVerificationStatusDto } from './dto/update-verification-status.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto, Public } from '@veribuy/common';

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller('trust-lens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrustLensController {
  constructor(private readonly trustlensService: TrustLensService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@Query() pagination: PaginationDto) {
    return this.trustlensService.getAllVerificationRequests(pagination);
  }

  @Get(':listingId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  async findOne(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAdmin = user.role === 'ADMIN';
    const verification = await this.trustlensService.getVerificationRequest(listingId, isAdmin);
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }
    // Sellers can only view their own verification requests
    if (!isAdmin && verification.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own verification requests');
    }
    return verification;
  }

  /**
   * Public sanitized check-result summary, safe for any viewer (buyers,
   * unauthenticated, and the lister). Returns the stored booleans only — never
   * the raw IMEI/serial/API payload. Returns null when no check has run yet.
   * Must be declared before the auth-guarded `:listingId` route so it matches
   * first for the `/summary` path.
   */
  @Get(':listingId/summary')
  @Public()
  async publicSummary(@Param('listingId', ParseUUIDPipe) listingId: string) {
    // Always return a JSON body (never a bare null — Nest would emit an empty
    // body that the frontend .json() parse would reject). Wrap so there is a
    // stable { check } shape regardless of whether a check has run yet.
    return { check: await this.trustlensService.getPublicCheckSummary(listingId) };
  }

  @Post()
  @Roles('BUYER', 'SELLER', 'ADMIN')
  create(
    @Body() dto: CreateVerificationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Override sellerId from JWT — never trust client-supplied value
    return this.trustlensService.createVerificationRequest({ ...dto, sellerId: user.userId });
  }

  @Patch(':listingId/status')
  @Roles('ADMIN')
  updateStatus(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: UpdateVerificationStatusDto,
  ) {
    return this.trustlensService.updateVerificationStatus(
      listingId,
      dto.status,
      dto.reviewNotes,
      dto.integrityFlags,
    );
  }

  @Delete(':listingId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('listingId', ParseUUIDPipe) listingId: string) {
    await this.trustlensService.deleteVerificationRequest(listingId);
    return { message: 'Verification request deleted' };
  }

  /**
   * Internal endpoint — called by evidence-service after a file is uploaded to
   * mark the corresponding EvidenceChecklist item as fulfilled.
   * Protected by timing-safe INTERNAL_SERVICE_TOKEN check (no JWT).
   */
  @Post(':listingId/fulfill-checklist')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async fulfillChecklist(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Headers('x-internal-service') internalToken: string,
    @Body() body: { evidenceType: string },
  ) {
    this.verifyInternalToken(internalToken);
    await this.trustlensService.fulfillEvidenceChecklist(listingId, body.evidenceType);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private verifyInternalToken(internalToken: string): void {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Internal service token not configured');
    }

    let valid = false;
    try {
      const a = Buffer.from(internalToken ?? '');
      const b = Buffer.from(expected);
      valid = a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid x-internal-service token');
    }
  }
}
