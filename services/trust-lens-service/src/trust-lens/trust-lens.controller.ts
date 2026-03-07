import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { TrustLensService } from './trust-lens.service';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';
import { UpdateVerificationStatusDto } from './dto/update-verification-status.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto } from '@veribuy/common';

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
  @Roles('SELLER', 'ADMIN')
  async findOne(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const verification = await this.trustlensService.getVerificationRequest(listingId);
    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }
    // Sellers can only view their own verification requests
    if (user.role !== 'ADMIN' && verification.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own verification requests');
    }
    return verification;
  }

  @Post()
  @Roles('SELLER')
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
}
