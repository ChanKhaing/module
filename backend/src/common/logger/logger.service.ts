import {
  Injectable,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { getRequestContext } from './request-context';

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

// ─── Dev format (colorized, single line) ───
const devFormat = format.combine(
  format.colorize({ all: false }),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, context, requestId, ...meta }) => {
    const rid = requestId ? `(${String(requestId).slice(0, 8)})` : '(--------)';
    const ctx = context ? `[${context}]` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${rid} ${ctx} ${message}${extra}`;
  }),
);

// ─── Prod format (JSON, ClickHouse ready) ───
const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: WinstonLogger;

  constructor() {
    this.logger = createLogger({
      level: logLevel,
      format: isProd ? prodFormat : devFormat,
      defaultMeta: { service: 'pj-a-backend' },
      transports: [new transports.Console()],
    });
  }

  // ─── Auto-enrich: requestId, userId, method, path ───
  private enrich(meta: Record<string, any> = {}): Record<string, any> {
    const ctx = getRequestContext();
    if (!ctx) return meta;
    return {
      requestId: ctx.requestId,
      userId: ctx.userId,
      method: ctx.method,
      path: ctx.path,
      ...meta,
    };
  }

  log(message: any, context?: string): void {
    this.logger.info(message, this.enrich({ context }));
  }

  error(message: any, trace?: string, context?: string): void {
    this.logger.error(message, this.enrich({ context, trace }));
  }

  warn(message: any, context?: string): void {
    this.logger.warn(message, this.enrich({ context }));
  }

  debug(message: any, context?: string): void {
    this.logger.debug(message, this.enrich({ context }));
  }

  verbose(message: any, context?: string): void {
    this.logger.verbose(message, this.enrich({ context }));
  }
}