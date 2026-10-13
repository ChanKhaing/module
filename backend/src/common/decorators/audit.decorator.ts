import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: string;
  target?: string;
}

/**
 * @Audit('user.create', 'user')
 * → Log to ClickHouse after request completes
 */
export const Audit = (action: string, target?: string) =>
  SetMetadata(AUDIT_KEY, { action, target } as AuditMeta);
