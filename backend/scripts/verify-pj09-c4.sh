#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-09 Commit 4 — Verify${N}"
echo -e "${B}════════════════════════════════════════${N}"

# ─── Pre-flight: Server must already be running ───
echo ""
echo "▶ ⓪ Server health (already running)"
if curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200"; then
  ok "Server running at $BASE"
else
  no "Server not running — please run 'npm run start:dev' in another terminal"
  exit 1
fi

echo ""
echo "▶ ① Service methods"
grep -q "async addMessage" src/support/support.service.ts \
  && ok "addMessage" || no "addMessage missing"
grep -q "async listMessages" src/support/support.service.ts \
  && ok "listMessages" || no "listMessages missing"

echo ""
echo "▶ ② Build"
if npm run build > /tmp/pj09-c4-build.log 2>&1; then
  ok "Build passes"
else
  no "Build failed"
  tail -10 /tmp/pj09-c4-build.log
  exit 1
fi

echo ""
echo "▶ ③ Smoke tests"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' \
  | jq -r '.data.accessToken')

EMAIL="sup-c4-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Sup4\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

TICKET_ID=$(curl -s -X POST $BASE/support-tickets \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"C4 messages","description":"Testing message thread flow"}' \
  | jq -r '.data._id')

echo "  ⓐ Customer reply"
M1=$(curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Hello, I need help"}')
M1_ROLE=$(echo "$M1" | jq -r '.data.senderRole // empty')
[ "$M1_ROLE" = "customer" ] && ok "Customer reply (senderRole=customer)" || no "Customer reply failed: $M1_ROLE"

echo "  ⓑ Agent reply"
M2=$(curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Hi, looking into it"}')
M2_ROLE=$(echo "$M2" | jq -r '.data.senderRole // empty')
[ "$M2_ROLE" = "admin" ] && ok "Admin reply (senderRole=admin)" || no "Admin reply failed: $M2_ROLE"

echo "  ⓒ Customer sees 2"
L=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" \
  -H "Authorization: Bearer $CUST_TOKEN")
LT=$(echo "$L" | jq -r '.data | length')
[ "$LT" = "2" ] && ok "Customer sees: $LT" || no "Expected 2, got: $LT"

echo "  ⓓ Agent internal note"
M3=$(curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Internal note — check logs","isInternal":true}')
M3_INT=$(echo "$M3" | jq -r '.data.isInternal // empty')
[ "$M3_INT" = "true" ] && ok "Internal note created" || no "Internal note failed"

echo "  ⓔ Customer does NOT see internal"
L2=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" \
  -H "Authorization: Bearer $CUST_TOKEN")
LT2=$(echo "$L2" | jq -r '.data | length')
[ "$LT2" = "2" ] && ok "Customer still sees: $LT2 (internal hidden)" || no "Expected 2, got: $LT2"

echo "  ⓕ Admin sees all 3"
L3=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
LT3=$(echo "$L3" | jq -r '.data | length')
[ "$LT3" = "3" ] && ok "Admin sees: $LT3" || no "Expected 3, got: $LT3"

echo "  ⓖ messageCount bumped"
T=$(curl -s "$BASE/support-tickets/$TICKET_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
MC=$(echo "$T" | jq -r '.data.messageCount // 0')
[ "$MC" = "3" ] && ok "messageCount: $MC" || no "Expected 3, got: $MC"

echo "  ⓗ Auto status → in_progress"
TS=$(echo "$T" | jq -r '.data.status // empty')
[ "$TS" = "in_progress" ] && ok "Status: in_progress" || no "Expected in_progress, got: $TS"

echo "  ⓘ Other user → denied"
EMAIL2="sup-c4b-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\",\"fullName\":\"Sup4b\"}" > /dev/null
CUST2=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

DENY=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" -H "Authorization: Bearer $CUST2")
D_CODE=$(echo "$DENY" | jq -r '.error.code // empty')
[ "$D_CODE" = "TICKET_ACCESS_DENIED" ] && ok "Other user denied" || no "Expected denial, got: $D_CODE"

echo "  ⓙ Customer cannot set internal=true"
DENY2=$(curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"sneaky","isInternal":true}')
D2_CODE=$(echo "$DENY2" | jq -r '.error.code // empty')
[ "$D2_CODE" = "PERMISSION_DENIED" ] && ok "Customer internal blocked" || no "Expected denial, got: $D2_CODE"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"

[ $FAIL -gt 0 ] && exit 1 || exit 0
