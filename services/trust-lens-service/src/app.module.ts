import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HttpLoggerMiddleware } from '@veribuy/logger';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { TrustLensModule } from './trust-lens/trust-lens.module';
import { AuthModule } from './auth/auth.module';
import { ImeiCheckModule } from './imei-check/imei-check.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    // Rate limiting: 10 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    TerminusModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    TrustLensModule,
    ImeiCheckModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
