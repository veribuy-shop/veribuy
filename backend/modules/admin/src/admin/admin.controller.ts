import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@veribuy/common';
import { PayoutsService } from '../../../transactions/src/payouts/payouts.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.adminService.getSummary();
  }

  @Get('review-queue')
  getReviewQueue(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getReviewQueue(page, limit);
  }

  @Get('listings')
  getListings(
    @Query('view') view?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getListings({ view, search, page, limit });
  }

  @Get('orders')
  getOrders(
    @Query('view') view?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOrders({ view, search, page, limit });
  }

  /** Seller payouts: what is owed, what was paid, and what needs a decision. */
  @Get('payouts')
  getPayouts(@Query('view') view?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.payoutsService.listForAdmin({ view, page, limit });
  }

  @Get('audit-log')
  getAuditLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLog(page, limit);
  }
}
