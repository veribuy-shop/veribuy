import { Module } from '@nestjs/common';
import { UtrustUlensController } from './trust-lens.controller';
import { UtrustUlensService } from './trust-lens.service';
import { ImeiCheckModule } from '../imei-check/imei-check.module';

@Module({
  imports: [ImeiCheckModule],
  controllers: [UtrustUlensController],
  providers: [UtrustUlensService],
  exports: [UtrustUlensService],
})
export class UtrustUlensModule {}
