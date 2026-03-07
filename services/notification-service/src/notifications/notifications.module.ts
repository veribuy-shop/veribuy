import { Module } from '@nestjs/common';
import { UnotificationsController } from './notifications.controller';
import { UnotificationsService } from './notifications.service';

@Module({
  controllers: [UnotificationsController],
  providers: [UnotificationsService],
  exports: [UnotificationsService],
})
export class UnotificationsModule {}
