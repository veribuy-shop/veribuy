import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

const consoleFormat = printf(({ level, message, timestamp, context, trace, ...metadata }) => {
  let msg = `${timestamp} [${level}] [${context || 'Application'}] ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (trace) {
    msg += `\n${trace}`;
  }

  return msg;
});

export const createLogger = (serviceName: string) => {
  return WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: combine(
          errors({ stack: true }),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          colorize(),
          consoleFormat,
        ),
      }),
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}.json`,
        format: combine(errors({ stack: true }), timestamp(), winston.format.json()),
      }),
      new winston.transports.File({
        filename: `/tmp/veribuy-${serviceName}-error.json`,
        level: 'error',
        format: combine(errors({ stack: true }), timestamp(), winston.format.json()),
      }),
    ],
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
    },
  });
};
