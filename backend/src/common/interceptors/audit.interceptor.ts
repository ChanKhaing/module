import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { ClickHouseService } from '../../infra/clickhouse';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly clickhouse: ClickHouseService,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip WS
    if (context.getType() !== 'http') return next.handle();

    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Audit → pass through
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as
      | { id?: string; sub?: string; email?: string; role?: string; roles?: string[] }
      | undefined;

    const actorId = user?.id ?? user?.sub ?? '';
    const actorEmail = user?.email ?? '';
    const actorRole = user?.role ?? user?.roles?.[0] ?? '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.ip
      ?? '';
    const userAgent = (req.headers['user-agent'] as string) ?? '';
    const method = req.method;
    const path = req.originalUrl ?? req.url;

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Fire and forget — do not await
          this.clickhouse
            .insertAuditLog({
              actorId,
              actorEmail,
              actorRole,
              action: meta.action,
              target: meta.target,
              targetId: this.extractTargetId(data),
              method,
              path,
              ip,
              userAgent,
              statusCode: 200,
              metadata: {},
            })
            .catch((err) =>
              this.logger.warn(
                `Audit log failed: ${(err as Error).message}`,
                AuditInterceptor.name,
              ),
            );
        },
        error: (err) => {
          const status = err?.status ?? err?.statusCode ?? 500;
          this.clickhouse
            .insertAuditLog({
              actorId,
              actorEmail,
              actorRole,
              action: meta.action,
              target: meta.target,
              method,
              path,
              ip,
              userAgent,
              statusCode: status,
              metadata: { error: err?.message ?? 'unknown' },
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  private extractTargetId(data: any): string {
    if (!data) return '';
    const obj = data?.data ?? data;
    if (obj && typeof obj === 'object') {
      if (obj._id) return String(obj._id);
      if (obj.id) return String(obj.id);
    }
    return '';
  }
}
