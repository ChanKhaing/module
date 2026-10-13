export const CLICKHOUSE_TABLES = {
  APPLICATION_LOGS: 'application_logs',
  AUDIT_LOGS: 'audit_logs',
  ACTIVITY_LOGS: 'activity_logs',
} as const;

export const TABLE_DDL: string[] = [
  // ─── Application logs (Winston) ───
  `CREATE TABLE IF NOT EXISTS application_logs (
    timestamp DateTime64(3) DEFAULT now64(3),
    level LowCardinality(String),
    context String,
    message String,
    request_id String DEFAULT '',
    user_id String DEFAULT '',
    method String DEFAULT '',
    path String DEFAULT '',
    meta String DEFAULT '{}'
  ) ENGINE = MergeTree()
  ORDER BY (level, timestamp)
  TTL timestamp + INTERVAL 30 DAY`,

  // ─── Audit logs (admin/user actions) ───
  `CREATE TABLE IF NOT EXISTS audit_logs (
    timestamp DateTime64(3) DEFAULT now64(3),
    actor_id String,
    actor_email String,
    actor_role String,
    action String,
    target String DEFAULT '',
    target_id String DEFAULT '',
    method String DEFAULT '',
    path String DEFAULT '',
    ip String DEFAULT '',
    user_agent String DEFAULT '',
    status_code UInt16 DEFAULT 0,
    metadata String DEFAULT '{}'
  ) ENGINE = MergeTree()
  ORDER BY (actor_id, timestamp)
  TTL timestamp + INTERVAL 90 DAY`,

  // ─── Activity logs (business events) ───
  `CREATE TABLE IF NOT EXISTS activity_logs (
    timestamp DateTime64(3) DEFAULT now64(3),
    user_id String DEFAULT '',
    event_type String,
    entity String DEFAULT '',
    entity_id String DEFAULT '',
    payload String DEFAULT '{}'
  ) ENGINE = MergeTree()
  ORDER BY (event_type, timestamp)
  TTL timestamp + INTERVAL 180 DAY`,
];
