import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../dto';

@Catch()   // ← အားလုံးကို ဖမ်း (HttpException + Error + unknown)
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.parse(exception);

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      requestId: request.requestId ?? 'unknown',
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // ─── Log ───
    const logMeta = {
      requestId: body.requestId,
      method: request.method,
      path: request.url,
      status,
      code,
    };

    if (status >= 500) {
      // 5xx → stack trace နဲ့ log (ဒါက ငါတို့ ရဲ့ bug)
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logMeta),
      );
    } else {
      // 4xx → client ရဲ့ အမှား၊ stack မလို
      this.logger.warn(
        `${request.method} ${request.url} → ${status} ${code}: ${message}`,
      );
    }

    response.status(status).json(body);
  }

  private parse(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: string[];
  } {
    // 1. HttpException (NestJS built-in + custom)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, code: this.codeFromStatus(status), message: res };
      }

      const obj = res as Record<string, any>;
      const rawMessage = obj.message;

      // ValidationPipe → message: string[]
      if (Array.isArray(rawMessage)) {
        return {
          status,
          code: this.codeFromStatus(status),
          message: 'Validation failed',
          details: rawMessage,
        };
      }

      return {
        status,
        code: obj.code ?? this.codeFromStatus(status),
        message: rawMessage ?? obj.error ?? exception.message,
      };
    }

    // 2. Mongoose duplicate key error
    if (this.isMongoDuplicate(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE_KEY',
        message: 'Resource already exists',
      };
    }

    // 3. Mongoose validation error
    if (this.isMongoValidation(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
      };
    }

    // 4. Unknown error → 500
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    };
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? `HTTP_${status}`;
  }

  private isMongoDuplicate(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      (e as any).code === 11000
    );
  }

  private isMongoValidation(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      (e as any).name === 'ValidationError'
    );
  }
}