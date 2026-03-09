import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
