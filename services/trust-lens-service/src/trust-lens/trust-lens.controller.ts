import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { UtrustUlensService } from './trust-lens.service';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, PaginationDto } from '@veribuy/common';

@Controller('trust-lens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UtrustUlensController {
  constructor(private readonly trustlensService: UtrustUlensService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@Query() pagination: PaginationDto) {
    return this.trustlensService.getAllVerificationRequests(pagination);
  }

  @Get(':listingId')
  @Roles('SELLER', 'ADMIN')
  async findOne(@Param('listingId') listingId: string, @CurrentUser() user: any) {
    const verification = await this.trustlensService.getVerificationRequest(listingId);
    if (!verification) {
      throw new ForbiddenException('Verification request not found');
    }
    // Sellers can only view their own verification requests
    if (user.role !== 'ADMIN' && verification.sellerId !== user.userId) {
      throw new ForbiddenException('You can only view your own verification requests');
    }
    return verification;
  }

  @Post()
  @Roles('SELLER')
  create(@Body() dto: CreateVerificationRequestDto, @CurrentUser() user: any) {
    // Ensure the seller ID in the DTO matches the authenticated user
    if (dto.sellerId !== user.userId) {
      throw new ForbiddenException('You can only create verification requests for yourself');
    }
    return this.trustlensService.createVerificationRequest(dto);
  }

  @Patch(':listingId/status')
  @Roles('ADMIN')
  updateStatus(
    @Param('listingId') listingId: string,
    @Body() body: { status: string; reviewNotes?: string; integrityFlags?: string[] },
  ) {
    return this.trustlensService.updateVerificationStatus(
      listingId,
      body.status as any,
      body.reviewNotes,
      body.integrityFlags,
    );
  }
}
