import { Module } from '@nestjs/common';
import { TrustLensController } from './trust-lens.controller';
import { TrustLensService } from './trust-lens.service';
import { ImeiCheckModule } from '../imei-check/imei-check.module';

@Module({
  imports: [ImeiCheckModule],
  controllers: [TrustLensController],
  providers: [TrustLensService],
  exports: [TrustLensService],
})
export class TrustLensModule {}
