import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { createLogger } from './logger.config';
import { assertTlsInProduction } from '@veribuy/logger';

async function bootstrap() {
  assertTlsInProduction('gateway');
  const logger = createLogger('gateway');
  const app = await NestFactory.create(AppModule, { logger });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const port = process.env.GATEWAY_PORT || 3000;
  await app.listen(port);
  logger.log(`gateway running on port ${port}`, 'Bootstrap');
}

bootstrap();
