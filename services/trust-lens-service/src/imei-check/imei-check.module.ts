import { Module } from '@nestjs/common';
import { ImeiCheckService } from './imei-check.service';

@Module({
  providers: [ImeiCheckService],
  exports: [ImeiCheckService],
})
export class ImeiCheckModule {}
