import { Module } from '@nestjs/common';
import { UlistingsController } from './listings.controller';
import { UlistingsService } from './listings.service';

@Module({
  controllers: [UlistingsController],
  providers: [UlistingsService],
  exports: [UlistingsService],
})
export class UlistingsModule {}
