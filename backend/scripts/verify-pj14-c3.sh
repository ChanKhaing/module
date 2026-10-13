#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-14 Commit 3 — Verify (Activity Events)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① ClickHouseService injected"
grep -q "private readonly clickhouse: ClickHouseService" src/support/support.service.ts \
  && ok "Injected in SupportService" || no "Not injected"

echo ""
echo "▶ ② 4 activity hooks"
CNT=$(grep -c "insertActivityLog" src/support/support.service.ts)
[ "$CNT" = "4" ] && ok "4 hooks present" || no "Expected 4, got: $CNT"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj14-c3-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj14-c3-build.log; exit 1)

echo ""
echo "▶ ④ Cleanup old activity test rows"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'support.%'" > /dev/null 2>&1
sleep 1

echo ""
echo "▶ ⑤ Setup: customer + admin"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')

CUST_EMAIL="act-c3-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Act C3\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
CUST_ID=$(echo "$CUST_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')
ok "Customer: $CUST_ID"

echo ""
echo "▶ ⑥ Create ticket → activity support.ticket_created"
TICKET_ID=$(curl -s -X POST "$BASE/support-tickets" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Activity test","description":"Testing activity log hooks now"}' \
  | jq -r '.data._id')
sleep 1
C1=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM activity_logs WHERE event_type = 'support.ticket_created' AND entity_id = '$TICKET_ID'")
[ "$C1" -ge 1 ] && ok "ticket_created logged: $C1" || no "Missing: $C1"

echo ""
echo "▶ ⑦ Message → activity support.message_sent"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $CUST_TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"Activity test msg"}' > /dev/null
sleep 1
C2=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM activity_logs WHERE event_type = 'support.message_sent' AND entity_id IS NOT NULL")
[ "$C2" -ge 1 ] && ok "message_sent logged: $C2" || no "Missing: $C2"

echo ""
echo "▶ ⑧ Assign → activity support.assigned"
ADMIN_ID=$(echo "$ADMIN_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')
curl -s -X PATCH "$BASE/support-tickets/$TICKET_ID/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$ADMIN_ID\"}" > /dev/null
sleep 1
C3=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM activity_logs WHERE event_type = 'support.assigned' AND entity_id = '$TICKET_ID'")
[ "$C3" -ge 1 ] && ok "assigned logged: $C3" || no "Missing: $C3"

echo ""
echo "▶ ⑨ Resolve → activity support.status_changed"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/resolve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"resolutionNote":"Fixed"}' > /dev/null
sleep 1
C4=$(curl -s "http://localhost:8123/" --data-binary "SELECT count() FROM activity_logs WHERE event_type = 'support.status_changed' AND entity_id = '$TICKET_ID'")
[ "$C4" -ge 1 ] && ok "status_changed logged: $C4" || no "Missing: $C4"

echo ""
echo "▶ ⑩ Sample rows"
curl -s "http://localhost:8123/" \
  --data-binary "SELECT event_type, entity, entity_id FROM activity_logs WHERE event_type LIKE 'support.%' ORDER BY timestamp DESC LIMIT 5" \
  | sed 's/^/     /'

echo ""
echo "▶ ⑪ Cleanup"
curl -s -X POST "http://localhost:8123/" \
  --data-binary "ALTER TABLE activity_logs DELETE WHERE event_type LIKE 'support.%'" > /dev/null
ok "Cleaned"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
