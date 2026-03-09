import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize, json, errors } = format;

// Skip noisy health/metrics routes from HTTP logs
const SKIP_PATHS = new Set(['/health', '/metrics', '/favicon.ico']);

/**
 * Console format that handles both plain string messages and structured object
 * messages. When the message is an object (or JSON-parseable), it is printed
 * in the same style as the octocare-prod-be reference logs:
 *
 *   2026-03-09 10:07:17 [info] [OrdersService] Object:
 *   {
 *     "orderId": "abc123",
 *     "status": "ESCROW_HELD"
 *   }
 */
const consoleFormat = printf(({ level, message, timestamp, context, trace, ...metadata }) => {
  const ctx = context || 'Application';

  let body: string;

  // Detect object messages — nest-winston passes objects through as-is
  if (typeof message === 'object' && message !== null) {
    body = `Object:\n${JSON.stringify(message, null, 2)}`;
  } else if (typeof message === 'string') {
    // Try to detect a JSON string that should be pretty-printed
    const trimmed = message.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        body = `Object:\n${JSON.stringify(parsed, null, 2)}`;
      } catch {
        body = message;
      }
    } else {
      body = message;
    }
  } else {
    body = String(message);
  }

  // Append any extra metadata keys (excluding internal winston/nest fields)
  const EXCLUDED_META_KEYS = new Set(['service', 'environment', 'version', 'splat', 'ms']);
  const extraKeys = Object.keys(metadata).filter((k) => !EXCLUDED_META_KEYS.has(k));
  if (extraKeys.length > 0) {
    const extra = Object.fromEntries(extraKeys.map((k) => [k, (metadata as Record<string, unknown>)[k]]));
    body += ` ${JSON.stringify(extra)}`;
  }

  let msg = `${timestamp} [${level}] [${ctx}] ${body}`;

  if (trace) {
    msg += `\n${trace}`;
  }

  return msg;
});

export interface LoggerOptions {
  serviceName: string;
  logLevel?: string;
  enableFileLogging?: boolean;
  enableJsonLogging?: boolean;
}

/**
 * Create a Winston logger instance configured for VeriBuy services.
 * Pass the returned value to NestFactory.create(AppModule, { logger }).
 *
 * Console output format:
 *   2026-03-09 10:07:16 [info]  [Bootstrap] auth-service running on port 3001
 *   2026-03-09 10:07:17 [info]  [OrdersService] Object:
 *   { "orderId": "abc123", ... }
 *
 * Set LOG_LEVEL env var to control verbosity (default: info).
 */
export const createLogger = (options: LoggerOptions) => {
  const {
    serviceName,
    logLevel = process.env.LOG_LEVEL || 'info',
    enableFileLogging = true,
    enableJsonLogging = true,
  } = options;

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: logLevel,
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize({ all: true }),
        consoleFormat,
      ),
    }),
  ];

  if (enableFileLogging && enableJsonLogging) {
    transports.push(
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}.json`,
        level: logLevel,
        format: combine(errors({ stack: true }), timestamp(), json()),
        maxsize: 10485760, // 10 MB
        maxFiles: 5,
      }),
    );
    transports.push(
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}-error.json`,
        level: 'error',
        format: combine(errors({ stack: true }), timestamp(), json()),
        maxsize: 10485760, // 10 MB
        maxFiles: 5,
      }),
    );
  }

  return WinstonModule.createLogger({
    level: logLevel,
    transports,
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.1.0',
    },
    exitOnError: false,
  });
};

/**
 * NestJS middleware that logs every incoming HTTP request and its response.
 *
 * Incoming:  →  POST /orders
 * Outgoing:  ←  201 POST /orders 45ms
 *
 * Health/metrics routes are skipped to avoid log noise.
 *
 * Usage — in any AppModule:
 *
 *   import { MiddlewareConsumer, NestModule } from '@nestjs/common';
 *   import { HttpLoggerMiddleware } from '@veribuy/logger';
 *
 *   export class AppModule implements NestModule {
 *     configure(consumer: MiddlewareConsumer): void {
 *       consumer.apply(HttpLoggerMiddleware).forRoutes('*');
 *     }
 *   }
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const path = originalUrl.split('?')[0];

    if (SKIP_PATHS.has(path)) {
      return next();
    }

    const start = Date.now();
    this.logger.log(`→  ${method} ${originalUrl}`);

    res.on('finish', () => {
      const { statusCode } = res;
      const ms = Date.now() - start;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      this.logger[level](`←  ${statusCode} ${method} ${originalUrl} ${ms}ms`);
    });

    next();
  }
}
