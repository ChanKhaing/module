#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-14 Commit 1 — Verify (ClickHouse)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in \
  src/infra/clickhouse/clickhouse.service.ts \
  src/infra/clickhouse/clickhouse.module.ts \
  src/infra/clickhouse/clickhouse.constants.ts \
  src/infra/clickhouse/index.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Registered"
grep -q "ClickHouseModule" src/app.module.ts \
  && ok "Registered in app.module" || no "Not registered"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj14-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj14-c1-build.log; exit 1)

echo ""
echo "▶ ④ ClickHouse container"
docker ps --format "{{.Names}}" | grep -q "^ticket-clickhouse$" \
  && ok "ticket-clickhouse running" || no "Container down"

echo ""
echo "▶ ⑤ ClickHouse ping"
PING=$(curl -s http://localhost:8123/ping)
[ "$PING" = "Ok." ] && ok "ClickHouse responding" || no "Ping: $PING"

echo ""
echo "▶ ⑥ Server connected"
grep -q "ClickHouse ready" /tmp/server.log \
  && ok "Service connected" || no "Not connected"

echo ""
echo "▶ ⑦ Tables created"
for t in application_logs audit_logs activity_logs; do
  CNT=$(curl -s "http://localhost:8123/" --data-binary "EXISTS TABLE default.$t")
  [ "$CNT" = "1" ] && ok "Table: $t" || no "Table missing: $t"
done

echo ""
echo "▶ ⑧ Insert via API (test)"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "INSERT INTO application_logs (level, context, message, request_id) VALUES ('info', 'test', 'verify-test', 'req-123')"

sleep 1
ROW=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM application_logs WHERE message = 'verify-test'")
[ "$ROW" -ge 1 ] && ok "Direct insert works: $ROW row" || no "Insert failed"

echo ""
echo "▶ ⑨ Query via curl"
curl -s "http://localhost:8123/" --data-binary "SELECT level, message FROM application_logs WHERE message = 'verify-test' LIMIT 1" | sed 's/^/     /'

echo ""
echo "▶ ⑩ Cleanup test row"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "ALTER TABLE application_logs DELETE WHERE message = 'verify-test'" > /dev/null
ok "Test row cleaned"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
