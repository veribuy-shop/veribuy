import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UlistingsController } from './listings.controller';
import { UlistingsService } from './listings.service';
import { NotificationClient } from './notification.client';

@Module({
  imports: [ConfigModule],
  controllers: [UlistingsController],
  providers: [UlistingsService, NotificationClient],
  exports: [UlistingsService],
})
export class UlistingsModule {}
