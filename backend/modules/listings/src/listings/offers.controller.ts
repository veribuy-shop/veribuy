import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, assertEmailVerified } from '@veribuy/common';
import { OffersService } from './offers.service';
import { CreateOfferDto, RespondToOfferDto } from './dto/offer.dto';

interface AuthenticatedUser {
  userId: string;
  role: string;
  isEmailVerified?: boolean;
}

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /** Make (or replace) an offer on a listing. Buyer derived from the JWT. */
  @Post('listing/:listingId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  create(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    assertEmailVerified(user);
    return this.offersService.createOffer(listingId, user.userId, dto);
  }

  /** Offers the caller made (`role=buyer`) or received (`role=seller`). */
  @Get()
  @Roles('BUYER', 'SELLER', 'ADMIN')
  list(@Query('role') role: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offersService.listForUser(user.userId, role === 'seller' ? 'seller' : 'buyer');
  }

  /** Seller accepts/declines, buyer withdraws. */
  @Patch(':offerId')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  respond(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: RespondToOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offersService.respond(offerId, user.userId, dto);
  }
}
