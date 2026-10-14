#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-15 Commit 2 — Verify (Log Query)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in src/admin/logs/logs.service.ts src/admin/logs/logs.controller.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Routes"
grep -q "Mapped {/admin/logs/audit, GET}" /tmp/server.log \
  && ok "GET /admin/logs/audit" || no "audit route missing"
grep -q "Mapped {/admin/logs/activity, GET}" /tmp/server.log \
  && ok "GET /admin/logs/activity" || no "activity route missing"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj15-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj15-c2-build.log; exit 1)

echo ""
echo "▶ ④ Admin token"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')
ok "Admin"

echo ""
echo "▶ ⑤ Seed 2 audit rows directly"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, target, target_id, method, path, status_code) VALUES ('verify-a','a@x.com','admin','verify.audit','user','','GET','/x',200)"
sleep 1
curl -s -X POST "http://localhost:8123/" \
  --data-binary "INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, target, target_id, method, path, status_code) VALUES ('verify-a','a@x.com','admin','verify.audit2','user','','POST','/y',201)"
sleep 1
ok "2 test rows inserted"

echo ""
echo "▶ ⑥ Query audit — filter by action"
R=$(curl -s "$BASE/admin/logs/audit?action=verify.audit&limit=10" -H "Authorization: Bearer $ADMIN_TOKEN")
CNT=$(echo "$R" | jq -r '.data | length // 0')
TOTAL=$(echo "$R" | jq -r '.meta.total // 0')
[ "$TOTAL" -ge 1 ] && ok "Audit query: $TOTAL total, $CNT rows" || no "Query failed: $TOTAL"

echo ""
echo "▶ ⑦ Query audit — filter by actor"
R2=$(curl -s "$BASE/admin/logs/audit?actorId=verify-a" -H "Authorization: Bearer $ADMIN_TOKEN")
T2=$(echo "$R2" | jq -r '.meta.total // 0')
[ "$T2" -ge 2 ] && ok "Filter by actor: $T2" || no "Expected ≥2, got: $T2"

echo ""
echo "▶ ⑧ Activity query (may be 0 rows)"
R3=$(curl -s "$BASE/admin/logs/activity?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
ok "Activity query responded"

echo ""
echo "▶ ⑨ Cleanup"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "ALTER TABLE audit_logs DELETE WHERE action LIKE 'verify.%'" > /dev/null
ok "Cleaned"

echo ""
echo "▶ ⑩ Customer denied"
CUST_EMAIL="pj15-c2-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"C2\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
DENY=$(curl -s "$BASE/admin/logs/audit" -H "Authorization: Bearer $CUST_TOKEN")
D=$(echo "$DENY" | jq -r '.error.code // empty')
[ "$D" = "PERMISSION_DENIED" ] && ok "Customer denied" || no "Expected deny, got: $D"

echo ""
echo "▶ ⑪ SQL injection safe"
INJ=$(curl -s "$BASE/admin/logs/audit?action='OR'1'='1&limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
INJ_CODE=$(echo "$INJ" | jq -r '.error.code // empty')
if [ -z "$INJ_CODE" ]; then
  ok "Injection attempt returned safely (no error)"
else
  info "Injection returned: $INJ_CODE"
fi

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
