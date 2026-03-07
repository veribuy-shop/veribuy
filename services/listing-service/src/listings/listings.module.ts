import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UlistingsController } from './listings.controller';
import { UlistingsService } from './listings.service';

@Module({
  imports: [ConfigModule],
  controllers: [UlistingsController],
  providers: [UlistingsService],
  exports: [UlistingsService],
})
export class UlistingsModule {}
