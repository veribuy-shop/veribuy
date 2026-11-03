import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule, RedisService } from '@veribuy/redis-cache';
import { HttpLoggerMiddleware } from '@veribuy/logger';
import { AuthModule } from '../modules/auth/src/auth/auth.module';
import { UsersModule } from '../modules/users/src/users/users.module';
import { UlistingsModule } from '../modules/listings/src/listings/listings.module';
import { AdminModule } from '../modules/admin/src/admin/admin.module';
import { TrustLensModule } from '../modules/trust-lens/src/trust-lens/trust-lens.module';
import { ImeiCheckModule } from '../modules/trust-lens/src/imei-check/imei-check.module';
import { EvidenceModule } from '../modules/evidence/src/evidence/evidence.module';
import { CloudinaryModule as EvidenceCloudinaryModule } from '../modules/evidence/src/cloudinary/cloudinary.module';
import { TransactionsModule } from '../modules/transactions/src/transactions/transactions.module';
import { InvoicesModule } from '../modules/transactions/src/invoices/invoices.module';
import { CloudinaryModule as TransactionCloudinaryModule } from '../modules/transactions/src/cloudinary/cloudinary.module';
import { NotificationsModule } from '../modules/notifications/src/notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './database/prisma.module';
import { validateEnv } from './config/env.validation';
import { RedisThrottlerStorage } from './security/redis-throttler.storage';
import { ClientAwareThrottlerGuard } from './security/client-aware-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } }),
    TerminusModule,
    RedisModule,
    HealthModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    UlistingsModule,
    TrustLensModule,
    AdminModule,
    ImeiCheckModule,
    EvidenceCloudinaryModule,
    EvidenceModule,
    TransactionCloudinaryModule,
    InvoicesModule,
    TransactionsModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientAwareThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
