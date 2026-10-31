import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, assertTlsInProduction } from '@veribuy/logger';
import { getInternalApiUrl } from '@veribuy/common';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { isValidInternalToken } from './security/internal-token';

async function bootstrap() {
  const port = Number(process.env.PORT || process.env.BACKEND_PORT || 3000);
  const backendUrl = getInternalApiUrl();

  // Render Postgres requires TLS; ensure sslmode=require for production connections.
  const dbUrl = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'production' && dbUrl && !dbUrl.includes('sslmode=')) {
    process.env.DATABASE_URL = dbUrl.includes('?')
      ? `${dbUrl}&sslmode=require`
      : `${dbUrl}?sslmode=require`;
  }

  assertTlsInProduction('backend');
  const app = await NestFactory.create(AppModule);

  // Behind Render's load balancer: trust a fixed number of proxy hops (default 1)
  // so req.ip is the real client address used by the rate limiter, and can't be
  // spoofed by prepending entries to X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

  // Prometheus metrics expose internals — require the internal service token.
  app.use('/metrics', (req: Request, res: Response, next: NextFunction) => {
    if (!isValidInternalToken(req.headers['x-internal-service'])) {
      res.status(404).end();
      return;
    }
    next();
  });

  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://www.veribuy.shop', 'http://localhost:3010'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('VeriBuy Backend API')
      .setDescription('Development API documentation for the VeriBuy modular backend.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
      customSiteTitle: 'VeriBuy Backend API Docs',
    });
  }

  await app.listen(port);
}

bootstrap();
