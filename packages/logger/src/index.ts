import {
  Injectable,
  NestMiddleware,
  Logger,
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize, json, errors } = format;

// Skip noisy health/metrics routes from HTTP logs
const SKIP_PATHS = new Set(['/health', '/metrics', '/favicon.ico']);

// Fields that must never appear in logs (passwords, tokens, secrets).
// All values MUST be lowercase — redact() compares k.toLowerCase() against this set.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'x-internal-service',
  'secret',
  'apikey',
  'api_key',
  'stripesecret',
  'cardnumber',
  'cvv',
]);

/**
 * Recursively redact sensitive fields from an object so it is safe to log.
 */
function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return result;
}

/**
 * Console format that handles both plain string messages and structured object
 * messages, rendered as multi-line Object: blocks:
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

  if (typeof message === 'object' && message !== null) {
    body = `Object:\n${JSON.stringify(message, null, 2)}`;
  } else if (typeof message === 'string') {
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

  const EXCLUDED_META_KEYS = new Set(['service', 'environment', 'version', 'splat', 'ms']);
  const extraKeys = Object.keys(metadata).filter((k) => !EXCLUDED_META_KEYS.has(k));
  if (extraKeys.length > 0) {
    const extra = Object.fromEntries(
      extraKeys.map((k) => [k, (metadata as Record<string, unknown>)[k]]),
    );
    body += ` ${JSON.stringify(extra)}`;
  }

  let msg = `${timestamp} [${level}] [${ctx}] ${body}`;
  if (trace) msg += `\n${trace}`;
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
 * On success:
 *   →  POST /orders
 *   ←  201 POST /orders 45ms
 *
 * On 4xx/5xx the response line is logged at warn/error AND the sanitised
 * request body is appended so you can reproduce the exact call:
 *   ←  422 POST /orders/pay 12ms  body: { "amount": "abc" }
 *
 * Health/metrics routes are skipped to avoid log noise.
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

/**
 * Global exception filter — catches every unhandled exception thrown anywhere
 * in the NestJS pipeline (guards, pipes, interceptors, services, controllers)
 * and logs a structured error entry before returning the HTTP response.
 *
 * Log output for a 404:
 *   [ExceptionFilter] NotFoundException: Order abc123 not found
 *     GET /transactions/orders/abc123 — userId: u-456 — 404
 *
 * Log output for an unexpected 500:
 *   [ExceptionFilter] TypeError: Cannot read properties of undefined
 *     POST /transactions/orders — userId: u-789 — 500
 *     <full stack trace>
 *
 * Register once in every main.ts:
 *   app.useGlobalFilters(new AllExceptionsFilter());
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Determine HTTP status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Determine response body (mirrors NestJS default behaviour)
    let responseBody: Record<string, unknown>;
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      responseBody =
        typeof resp === 'object' && resp !== null
          ? (resp as Record<string, unknown>)
          : { message: resp };
    } else {
      responseBody = {
        statusCode: status,
        message: 'Internal server error',
        error: 'Internal Server Error',
      };
    }

    // Build a rich log line
    const method = req.method;
    const url = req.originalUrl;
    const userId = (req as Request & { user?: { userId?: string } }).user?.userId ?? 'unauthenticated';
    const errorName =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const stack =
      exception instanceof Error && status >= 500 ? exception.stack : undefined;

    // Sanitise body for the log (strip sensitive fields)
    const reqBody =
      req.body && Object.keys(req.body as object).length > 0
        ? redact(req.body as Record<string, unknown>)
        : undefined;

    const logPayload = [
      `${errorName}: ${errorMessage}`,
      `  ${method} ${url} — userId: ${userId} — ${status}`,
      reqBody ? `  request body: ${JSON.stringify(reqBody)}` : null,
      stack ? `\n${stack}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (status >= 500) {
      this.logger.error(logPayload);
    } else if (status >= 400) {
      this.logger.warn(logPayload);
    }
    // 3xx and below are not errors — NestJS handles redirects internally

    res.status(status).json(responseBody);
  }
}
