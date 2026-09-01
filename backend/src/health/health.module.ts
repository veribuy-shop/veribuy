import { Module } from '@nestjs/common';
import { RootController, HealthController } from './health.controller';

@Module({
  controllers: [RootController, HealthController],
})
export class HealthModule {}
