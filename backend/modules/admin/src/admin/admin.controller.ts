import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@veribuy/common';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get('audit-log')
  getAuditLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLog(page, limit);
  }
}
