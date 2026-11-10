import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Public, Roles, RolesGuard, assertEmailVerified } from '@veribuy/common';
import { validateInternalToken } from '../transactions/transactions.controller';
import { BuyerMoneyEvent, PayoutsService } from './payouts.service';

const BUYER_MONEY_EVENTS: BuyerMoneyEvent[] = ['CHARGEBACK_OPENED', 'CHARGEBACK_WON', 'CHARGEBACK_LOST', 'REFUNDED'];

interface AuthenticatedUser {
  userId: string;
  role: string;
  isEmailVerified?: boolean;
}

/**
 * Seller payouts. Every seller route acts on the signed-in user only, so one
 * seller can never read or change another's payout account.
 */
@Controller('transactions/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('account')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  getAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.getAccountStatus(user.userId);
  }

  @Post('account/onboarding-link')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  createOnboardingLink(@CurrentUser() user: AuthenticatedUser) {
    assertEmailVerified(user);
    return this.payoutsService.createOnboardingLink(user.userId);
  }

  @Post('account/dashboard-link')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  createDashboardLink(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.createDashboardLink(user.userId);
  }

  @Get('mine')
  @Roles('BUYER', 'SELLER', 'ADMIN')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.listForSeller(user.userId);
  }

  /**
   * Internal endpoint for the Stripe webhook: the buyer's payment was charged back or refunded.
   * No JWT required; validated via x-internal-service header with timingSafeEqual.
   */
  @Post('internal/buyer-money-event')
  @Public()
  recordBuyerMoneyEvent(
    @Body() body: { paymentIntentId?: unknown; event?: unknown },
    @Headers('x-internal-service') internalService: string,
  ) {
    validateInternalToken(internalService);
    const event = BUYER_MONEY_EVENTS.find((known) => known === body?.event);
    if (typeof body?.paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(body.paymentIntentId) || !event) {
      throw new BadRequestException('paymentIntentId and a known event are required');
    }
    return this.payoutsService.recordBuyerMoneyEvent(body.paymentIntentId, event);
  }

  @Post(':payoutId/reverse')
  @Roles('ADMIN')
  reverse(@Param('payoutId', ParseUUIDPipe) payoutId: string) {
    return this.payoutsService.reverse(payoutId);
  }

  @Post(':payoutId/dismiss-flag')
  @Roles('ADMIN')
  dismissFlag(@Param('payoutId', ParseUUIDPipe) payoutId: string) {
    return this.payoutsService.dismissFlag(payoutId);
  }

  @Post(':payoutId/retry')
  @Roles('ADMIN')
  retry(@Param('payoutId', ParseUUIDPipe) payoutId: string) {
    return this.payoutsService.retry(payoutId);
  }
}
