import { createLogger as _createLogger, HttpLoggerMiddleware } from '@veribuy/logger';

/**
 * Thin adapter so existing main.ts calls — createLogger('trust-lens-service') —
 * continue to work unchanged while delegating to the shared @veribuy/logger package.
 */
export const createLogger = (serviceName: string) =>
  _createLogger({ serviceName });

export { HttpLoggerMiddleware };
