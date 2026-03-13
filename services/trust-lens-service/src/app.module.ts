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
    // Rate limiting: 100 requests per minute per IP
    // (BFF server-to-server calls share a single source IP, so the limit must
    // accommodate multiple concurrent frontend users)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
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
