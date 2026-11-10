import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransactionsModule } from '../../../transactions/src/transactions/transactions.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditInterceptor } from './audit.interceptor';

@Module({
  imports: [TransactionsModule],
  controllers: [AdminController],
  providers: [AdminService, { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
})
export class AdminModule {}
