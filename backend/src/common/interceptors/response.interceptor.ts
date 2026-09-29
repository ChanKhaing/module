import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../dto';
import { SKIP_WRAP_KEY } from '../decorators';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    // 1. @SkipWrap() ရှိလား စစ်
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_WRAP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((payload) => this.wrap(payload, request.requestId)),
    );
  }

  private wrap(payload: any, requestId: string): ApiSuccessResponse {
    const base = {
      success: true as const,
      requestId: requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };

    // undefined ဖြစ်ရင် null ပြ
    if (payload === undefined || payload === null) {
      return { ...base, data: null };
    }

    // Pagination shape ရှိလား?
    if (this.isPaginated(payload)) {
      const { data, page, limit, total, ...rest } = payload;
      return {
        ...base,
        data,
        meta: {
          page,
          limit,
          total,
          ...rest,
        },
      };
    }

    // ကျန် → data အနေနဲ့ ထည့်
    return { ...base, data: payload };
  }

  private isPaginated(payload: any): boolean {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      !Array.isArray(payload) &&
      'data' in payload &&
      ('total' in payload || 'page' in payload || 'limit' in payload)
    );
  }
}