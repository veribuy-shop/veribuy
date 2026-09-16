import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { RoyalMailService } from '../shipping/royal-mail.service';

@Module({
  imports: [InvoicesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, RoyalMailService],
  exports: [TransactionsService, RoyalMailService],
})
export class TransactionsModule {}
