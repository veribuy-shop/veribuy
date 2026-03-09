import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createLogger } from './logger.config';
import { AllExceptionsFilter } from '@veribuy/logger';

async function bootstrap() {
  const logger = createLogger('listing-service');
  const app = await NestFactory.create(AppModule, { logger });

  // Security: Helmet middleware for security headers
  app.use(helmet());

  // Security: Restricted CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3010'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter — logs every unhandled exception with full context
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`listing-service running on port ${port}`, 'Bootstrap');
}

bootstrap();
