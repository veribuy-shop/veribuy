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
} from '@nestjs/common';
import { UlistingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { GetListingsQueryDto } from './dto/get-listings-query.dto';
import { JwtAuthGuard, RolesGuard, Roles, Public, CurrentUser, PaginationDto } from '@veribuy/common';

@Controller('listings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UlistingsController {
  constructor(private readonly listingsService: UlistingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SELLER')
  async create(@Body() dto: CreateListingDto, @CurrentUser() user: any) {
    // Ensure the seller ID in the DTO matches the authenticated user
    if (dto.sellerId !== user.userId) {
      throw new ForbiddenException('You can only create listings for yourself');
    }
    return this.listingsService.create(dto);
  }

  @Get()
  @Public()
  async findAll(@Query() query: GetListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  // Static routes MUST be declared before dynamic `:id` to avoid the wildcard capturing them
  @Get('seller/:sellerId')
  @Public()
  async findBySeller(@Param('sellerId') sellerId: string, @Query() pagination: PaginationDto) {
    return this.listingsService.findBySeller(sellerId, pagination);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Put(':id/status')
  @Roles('SELLER', 'ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    // Verify ownership unless admin
    if (user.role !== 'ADMIN') {
      const listing = await this.listingsService.findOne(id);
      if (listing.sellerId !== user.userId) {
        throw new ForbiddenException('You can only update your own listings');
      }
    }
    return this.listingsService.updateStatus(id, status as any);
  }

  @Patch(':id/status')
  @Public()
  async updateListingStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    // Internal endpoint for service-to-service communication
    // No auth required - used by transaction service
    return this.listingsService.updateStatus(id, status as any);
  }

  @Patch(':id')
  @Roles('USER', 'ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateData: { title?: string; price?: number; status?: string },
    @CurrentUser() user: any,
  ) {
    // Verify ownership unless admin
    if (user.role !== 'ADMIN') {
      const listing = await this.listingsService.findOne(id);
      if (listing.sellerId !== user.userId) {
        throw new ForbiddenException('You can only update your own listings');
      }
    }
    return this.listingsService.update(id, updateData);
  }

  @Put(':id/trust-lens')
  @Roles('ADMIN')
  async updateTrustLensStatus(
    @Param('id') id: string,
    @Body() body: { trustLensStatus: string; conditionGrade?: string; integrityFlags?: string[] },
  ) {
    return this.listingsService.updateTrustLensStatus(
      id,
      body.trustLensStatus as any,
      body.conditionGrade,
      body.integrityFlags as any,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('SELLER', 'ADMIN')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    // Verify ownership unless admin
    if (user.role !== 'ADMIN') {
      const listing = await this.listingsService.findOne(id);
      if (listing.sellerId !== user.userId) {
        throw new ForbiddenException('You can only delete your own listings');
      }
    }
    return this.listingsService.delete(id);
  }
}
