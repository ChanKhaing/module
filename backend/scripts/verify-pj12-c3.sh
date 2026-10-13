#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-12 Commit 3 — Verify (Hooks)${N}"
echo -e "${B}════════════════════════════════════════${N}"

curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Support service has hooks"
grep -q "SUPPORT_REPLY" src/support/support.service.ts \
  && ok "SUPPORT_REPLY hook" || no "SUPPORT_REPLY missing"
grep -q "SUPPORT_RESOLVED" src/support/support.service.ts \
  && ok "SUPPORT_RESOLVED hook" || no "SUPPORT_RESOLVED missing"
grep -q "SUPPORT_ASSIGNED" src/support/support.service.ts \
  && ok "SUPPORT_ASSIGNED hook" || no "SUPPORT_ASSIGNED missing"

echo ""
echo "▶ ② Build"
npm run build > /tmp/pj12-c3-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj12-c3-build.log; exit 1)

echo ""
echo "▶ ③ Setup"
# Admin
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')

# Customer
CUST_EMAIL="notif-c3-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Cust C3\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUST_EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
CUST_ID=$(echo "$CUST_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')

ok "Setup: customer=$CUST_ID"

# Create ticket
TICKET_ID=$(curl -s -X POST "$BASE/support-tickets" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Notif hook test","description":"Testing notification hooks on reply"}' \
  | jq -r '.data._id')
ok "Ticket: $TICKET_ID"

# Clear customer notifications (fresh)
docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval "
    db.notifications.deleteMany({ userId: ObjectId('$CUST_ID') });
  " > /dev/null 2>&1

echo ""
echo "▶ ④ HOOK ① — Agent reply → notify customer"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Agent here, looking into it"}' > /dev/null

sleep 1
COUNT1=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.notifications.countDocuments({ userId: ObjectId('$CUST_ID'), type: 'support_reply' })" 2>/dev/null | tr -d '\r')
[ "$COUNT1" = "1" ] && ok "Reply → customer notified" || no "Expected 1 reply notif, got: $COUNT1"

# Get notification
N1=$(curl -s "$BASE/notifications/me?type=support_reply" -H "Authorization: Bearer $CUST_TOKEN")
T1=$(echo "$N1" | jq -r '.meta.total // 0')
[ "$T1" = "1" ] && ok "REST shows reply notif" || no "REST missing"
TITLE1=$(echo "$N1" | jq -r '.data[0].title // empty')
echo "  ↳ title: $TITLE1"

echo ""
echo "▶ ⑤ Internal note → NO notification"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Internal only","isInternal":true}' > /dev/null

sleep 1
COUNT2=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.notifications.countDocuments({ userId: ObjectId('$CUST_ID'), type: 'support_reply' })" 2>/dev/null | tr -d '\r')
[ "$COUNT2" = "1" ] && ok "Internal note → no notify (still 1)" || no "Expected 1, got: $COUNT2"

echo ""
echo "▶ ⑥ Customer self-reply → NO notification"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/replies" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Thanks!"}' > /dev/null

sleep 1
COUNT3=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.notifications.countDocuments({ userId: ObjectId('$CUST_ID'), type: 'support_reply' })" 2>/dev/null | tr -d '\r')
[ "$COUNT3" = "1" ] && ok "Self-reply → no notify (still 1)" || no "Expected 1, got: $COUNT3"

echo ""
echo "▶ ⑦ HOOK ② — Resolve → notify customer"
curl -s -X POST "$BASE/support-tickets/$TICKET_ID/resolve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolutionNote":"Fixed the issue"}' > /dev/null

sleep 1
COUNT4=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.notifications.countDocuments({ userId: ObjectId('$CUST_ID'), type: 'support_resolved' })" 2>/dev/null | tr -d '\r')
[ "$COUNT4" = "1" ] && ok "Resolve → customer notified" || no "Expected 1 resolved notif, got: $COUNT4"

N2=$(curl -s "$BASE/notifications/me?type=support_resolved" -H "Authorization: Bearer $CUST_TOKEN")
TITLE2=$(echo "$N2" | jq -r '.data[0].title // empty')
echo "  ↳ title: $TITLE2"
[ -n "$TITLE2" ] && ok "Resolve notif has title" || no "Title missing"

echo ""
echo "▶ ⑧ HOOK ③ — Assign → notify agent"
# New ticket
TICKET2=$(curl -s -X POST "$BASE/support-tickets" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Assign test","description":"Testing assign hook notification"}' \
  | jq -r '.data._id')

# Get admin id
ADMIN_ID=$(echo "$ADMIN_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')

# Clear admin notifications
docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval "
    db.notifications.deleteMany({ userId: ObjectId('$ADMIN_ID') });
  " > /dev/null 2>&1

curl -s -X PATCH "$BASE/support-tickets/$TICKET2/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$ADMIN_ID\"}" > /dev/null

sleep 1
COUNT5=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.notifications.countDocuments({ userId: ObjectId('$ADMIN_ID'), type: 'support_assigned' })" 2>/dev/null | tr -d '\r')
[ "$COUNT5" = "1" ] && ok "Assign → agent notified" || no "Expected 1 assign notif, got: $COUNT5"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
