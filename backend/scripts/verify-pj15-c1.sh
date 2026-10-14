#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-15 Commit 1 — Verify (Dashboard)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in \
  src/admin/admin.module.ts \
  src/admin/dashboard/dashboard.service.ts \
  src/admin/dashboard/dashboard.controller.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Routes"
grep -q "Mapped {/admin/dashboard/stats, GET}" /tmp/server.log \
  && ok "GET /admin/dashboard/stats" || no "stats route missing"
grep -q "Mapped {/admin/dashboard/recent-activity, GET}" /tmp/server.log \
  && ok "GET /admin/dashboard/recent-activity" || no "recent-activity missing"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj15-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj15-c1-build.log; exit 1)

echo ""
echo "▶ ④ Setup"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')
ok "Admin token"

echo ""
echo "▶ ⑤ GET /admin/dashboard/stats"
STATS=$(curl -s "$BASE/admin/dashboard/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$STATS" | jq '.data' | sed 's/^/     /'

U_TOTAL=$(echo "$STATS" | jq -r '.data.users.total // empty')
T_TOTAL=$(echo "$STATS" | jq -r '.data.tickets.total // empty')
O_TOTAL=$(echo "$STATS" | jq -r '.data.orders.total // empty')
[ -n "$U_TOTAL" ] && ok "users.total: $U_TOTAL" || no "users.total missing"
[ -n "$T_TOTAL" ] && ok "tickets.total: $T_TOTAL" || no "tickets.total missing"
[ -n "$O_TOTAL" ] && ok "orders.total: $O_TOTAL" || no "orders.total missing"

REVENUE=$(echo "$STATS" | jq -r '.data.payments.totalRevenue // empty')
[ -n "$REVENUE" ] && ok "revenue: $REVENUE MMK" || no "revenue missing"

echo ""
echo "▶ ⑥ Customer → denied"
CUST_EMAIL="pj15-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"PJ15\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

DENY=$(curl -s "$BASE/admin/dashboard/stats" -H "Authorization: Bearer $CUST_TOKEN")
D_CODE=$(echo "$DENY" | jq -r '.error.code // empty')
[ "$D_CODE" = "PERMISSION_DENIED" ] && ok "Customer denied" || no "Expected deny, got: $D_CODE"

echo ""
echo "▶ ⑦ Recent activity"
RA=$(curl -s "$BASE/admin/dashboard/recent-activity?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
CNT=$(echo "$RA" | jq -r '.data | length // 0')
ok "Recent activity returned: $CNT rows"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
