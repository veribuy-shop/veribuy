import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UlistingsController } from './listings.controller';
import { UlistingsService } from './listings.service';
import { NotificationClient } from './notification.client';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [ConfigModule],
  controllers: [UlistingsController, OffersController],
  providers: [UlistingsService, NotificationClient, OffersService],
  exports: [UlistingsService],
})
export class UlistingsModule {}
