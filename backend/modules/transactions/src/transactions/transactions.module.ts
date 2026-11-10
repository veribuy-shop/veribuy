import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { RoyalMailService } from '../shipping/royal-mail.service';
import { PayoutsController } from '../payouts/payouts.controller';
import { PayoutsService } from '../payouts/payouts.service';

@Module({
  imports: [InvoicesModule],
  controllers: [TransactionsController, PayoutsController],
  providers: [TransactionsService, RoyalMailService, PayoutsService],
  exports: [TransactionsService, RoyalMailService, PayoutsService],
})
export class TransactionsModule {}
