import { Module } from '@nestjs/common';
import { TrustLensController } from './trust-lens.controller';
import { TrustLensService } from './trust-lens.service';
import { ListingSyncService } from './listing-sync.service';
import { UserSyncService } from './user-sync.service';
import { ImeiCheckModule } from '../imei-check/imei-check.module';

@Module({
  imports: [ImeiCheckModule],
  controllers: [TrustLensController],
  providers: [TrustLensService, ListingSyncService, UserSyncService],
  exports: [TrustLensService],
})
export class TrustLensModule {}
