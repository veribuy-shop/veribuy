import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize, json, errors } = format;

// Custom format for console output (human-readable)
const consoleFormat = printf(({ level, message, timestamp, context, trace, ...metadata }) => {
  let msg = `${timestamp} [${level}] [${context || 'Application'}] ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0 && Object.keys(metadata).some(k => !['service', 'environment'].includes(k))) {
    const filteredMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key]) => !['service', 'environment'].includes(key))
    );
    msg += ` ${JSON.stringify(filteredMetadata)}`;
  }
  
  // Add stack trace if present
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
 * Create a Winston logger instance configured for VeriBuy services
 * @param options Logger configuration options
 * @returns Winston logger instance compatible with NestJS
 */
export const createLogger = (options: LoggerOptions) => {
  const {
    serviceName,
    logLevel = process.env.LOG_LEVEL || 'info',
    enableFileLogging = true,
    enableJsonLogging = true,
  } = options;

  const transports: winston.transport[] = [
    // Console transport (human-readable, colored)
    new winston.transports.Console({
      level: logLevel,
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize({ all: true }),
        consoleFormat
      ),
    }),
  ];

  if (enableFileLogging && enableJsonLogging) {
    // JSON file transport for structured logging (for Loki/parsing)
    transports.push(
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}.json`,
        level: logLevel,
        format: combine(
          errors({ stack: true }),
          timestamp(),
          json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    // Error-only JSON file
    transports.push(
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}-error.json`,
        level: 'error',
        format: combine(
          errors({ stack: true }),
          timestamp(),
          json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
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
