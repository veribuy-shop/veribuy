import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditInterceptor } from './audit.interceptor';

@Module({
  controllers: [AdminController],
  providers: [AdminService, { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
})
export class AdminModule {}
