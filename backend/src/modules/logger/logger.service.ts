import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as winstonDaily from 'winston-daily-rotate-file';
import * as path from 'path';

@Injectable()
export class Logger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const logDir = path.join(__dirname, '../../../logs');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'nexora-ag' },
      transports: [
        // Debug file (daily rotate)
        new winstonDaily({
          level: 'debug',
          datePattern: 'YYYY-MM-DD',
          dirname: logDir,
          filename: `%DATE%-debug.log`,
          maxFiles: 30,
          zippedArchive: true,
        }),
        // Error file (daily rotate)
        new winstonDaily({
          level: 'error',
          datePattern: 'YYYY-MM-DD',
          dirname: logDir,
          filename: `%DATE%-error.log`,
          maxFiles: 30,
          zippedArchive: true,
        }),
        // Console output
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  }

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace: string) {
    this.logger.error(`[${trace}] ${message}`);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
