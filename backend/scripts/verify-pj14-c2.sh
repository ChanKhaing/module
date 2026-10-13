#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-14 Commit 2 — Verify (Audit)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in \
  src/common/decorators/audit.decorator.ts \
  src/common/interceptors/audit.interceptor.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Build"
npm run build > /tmp/pj14-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj14-c2-build.log; exit 1)

echo ""
echo "▶ ③ @Audit added to admin endpoints"
# Check users controller has @Audit
AUDIT_CNT=$(grep -c "@Audit" src/users/users.controller.ts 2>/dev/null || echo "0")
info "users.controller @Audit count: $AUDIT_CNT"
[ "$AUDIT_CNT" -ge 1 ] && ok "Has @Audit decorators" || info "No @Audit yet (will add next)"

echo ""
echo "▶ ④ ClickHouse audit_logs table exists"
TBL=$(curl -s "http://localhost:8123/" --data-binary "EXISTS TABLE default.audit_logs")
[ "$TBL" = "1" ] && ok "audit_logs table ready" || no "Table missing"

echo ""
echo "▶ ⑤ Direct insert test"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, target, method, path, status_code) VALUES ('verify-user', 'test@x.com', 'admin', 'verify.audit', 'test', 'POST', '/verify', 200)"

sleep 1
ROW=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM audit_logs WHERE action = 'verify.audit'")
[ "$ROW" -ge 1 ] && ok "Insert works ($ROW)" || no "Insert failed"

echo ""
echo "▶ ⑥ Cleanup"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "ALTER TABLE audit_logs DELETE WHERE action = 'verify.audit'" > /dev/null
ok "Cleaned"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
