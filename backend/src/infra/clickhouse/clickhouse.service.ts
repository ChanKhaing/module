import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickHouseClient, createClient } from '@clickhouse/client';

import {
  CLICKHOUSE_TABLES,
  TABLE_DDL,
} from './clickhouse.constants';

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private readonly client: ClickHouseClient;
  private ready = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('CLICKHOUSE_URL') ?? 'http://localhost:8123';
    const username = this.config.get<string>('CLICKHOUSE_USER') ?? 'default';
    const password = this.config.get<string>('CLICKHOUSE_PASSWORD') ?? '';

    this.client = createClient({
      url,
      username,
      password,
      database: this.config.get<string>('CLICKHOUSE_DATABASE') ?? 'default',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        wait_for_async_insert: 1,       // ← Sync — insert ပြီးရင် query ရ
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      await this.createTables();
      this.ready = true;
      this.logger.log('ClickHouse ready');
    } catch (err) {
      this.logger.error(
        `ClickHouse init failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close().catch(() => undefined);
  }

  isReady(): boolean {
    return this.ready;
  }

  // ─────────────────────────────────────────
  // Application log
  // ─────────────────────────────────────────
  async insertApplicationLog(row: {
    level: string;
    context: string;
    message: string;
    requestId?: string;
    userId?: string;
    method?: string;
    path?: string;
    meta?: Record<string, any>;
  }): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.insert({
        table: CLICKHOUSE_TABLES.APPLICATION_LOGS,
        values: [
          {
            level: row.level,
            context: row.context ?? '',
            message: String(row.message).slice(0, 4000),
            request_id: row.requestId ?? '',
            user_id: row.userId ?? '',
            method: row.method ?? '',
            path: row.path ?? '',
            meta: JSON.stringify(row.meta ?? {}),
          },
        ],
        format: 'JSONEachRow',
      });
    } catch (err) {
      this.logger.warn(
        `ClickHouse app-log insert failed: ${(err as Error).message}`,
      );
    }
  }

  // ─────────────────────────────────────────
  // Audit log
  // ─────────────────────────────────────────
  async insertAuditLog(row: {
    actorId: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    target?: string;
    targetId?: string;
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
    statusCode?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.insert({
        table: CLICKHOUSE_TABLES.AUDIT_LOGS,
        values: [
          {
            actor_id: row.actorId,
            actor_email: row.actorEmail,
            actor_role: row.actorRole,
            action: row.action,
            target: row.target ?? '',
            target_id: row.targetId ?? '',
            method: row.method ?? '',
            path: row.path ?? '',
            ip: row.ip ?? '',
            user_agent: row.userAgent ?? '',
            status_code: row.statusCode ?? 0,
            metadata: JSON.stringify(row.metadata ?? {}),
          },
        ],
        format: 'JSONEachRow',
      });
    } catch (err) {
      this.logger.warn(
        `ClickHouse audit-log insert failed: ${(err as Error).message}`,
      );
    }
  }

  // ─────────────────────────────────────────
  // Activity log
  // ─────────────────────────────────────────
  async insertActivityLog(row: {
    userId?: string;
    eventType: string;
    entity?: string;
    entityId?: string;
    payload?: Record<string, any>;
  }): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.insert({
        table: CLICKHOUSE_TABLES.ACTIVITY_LOGS,
        values: [
          {
            user_id: row.userId ?? '',
            event_type: row.eventType,
            entity: row.entity ?? '',
            entity_id: row.entityId ?? '',
            payload: JSON.stringify(row.payload ?? {}),
          },
        ],
        format: 'JSONEachRow',
      });
    } catch (err) {
      this.logger.warn(
        `ClickHouse activity-log insert failed: ${(err as Error).message}`,
      );
    }
  }

  // ─────────────────────────────────────────
  // Query (for admin viewing)
  // ─────────────────────────────────────────
  async query<T = any>(sql: string): Promise<T[]> {
    if (!this.ready) return [];
    try {
      const result = await this.client.query({
        query: sql,
        format: 'JSONEachRow',
      });
      return (await result.json()) as T[];
    } catch (err) {
      this.logger.warn(`ClickHouse query failed: ${(err as Error).message}`);
      return [];
    }
  }

  // ─────────────────────────────────────────
  // Table setup
  // ─────────────────────────────────────────
  private async createTables(): Promise<void> {
    for (const ddl of TABLE_DDL) {
      await this.client.command({ query: ddl });
    }
    this.logger.log(`ClickHouse tables ensured (${TABLE_DDL.length})`);
  }
}
