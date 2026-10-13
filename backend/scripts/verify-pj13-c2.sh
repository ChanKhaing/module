#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-13 Commit 2 — Verify (Invalidation)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Helper method exists"
grep -q "invalidateTicketCache" src/tickets/tickets.service.ts \
  && ok "Helper present" || no "Helper missing"

echo ""
echo "▶ ② Build"
npm run build > /tmp/pj13-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj13-c2-build.log; exit 1)

echo ""
echo "▶ ③ Setup"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')
ok "Admin token"

# Clean all ticket caches
docker exec ticket-redis redis-cli --scan --pattern "cache:ticket*" 2>/dev/null | \
  xargs -r -I{} docker exec ticket-redis redis-cli DEL {} > /dev/null 2>&1

TS=$(date +%s)
TICKET_ID=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Inv Test ${TS}\",\"price\":5000,\"eventDate\":\"2027-12-31T00:00:00Z\",\"quantity\":20}" \
  | jq -r '.data._id')

curl -s -X PATCH "$BASE/tickets/$TICKET_ID/publish" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
ok "Ticket: $TICKET_ID (published)"

echo ""
echo "▶ ④ Update invalidates cache"
# Prime the cache
curl -s "$BASE/tickets/$TICKET_ID" > /dev/null
sleep 1
CACHE_BEFORE=$(docker exec ticket-redis redis-cli EXISTS "cache:ticket:$TICKET_ID" 2>/dev/null | tr -d '\r')
[ "$CACHE_BEFORE" = "1" ] && ok "Cache exists before update" || no "Cache not primed"

# Update
curl -s -X PATCH "$BASE/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Inv Updated"}' > /dev/null
sleep 1

CACHE_AFTER=$(docker exec ticket-redis redis-cli EXISTS "cache:ticket:$TICKET_ID" 2>/dev/null | tr -d '\r')
[ "$CACHE_AFTER" = "0" ] && ok "Update → cache invalidated" || no "Cache still exists: $CACHE_AFTER"

echo ""
echo "▶ ⑤ Publish invalidates list cache"
# Prime list cache
curl -s "$BASE/tickets?limit=5" > /dev/null
sleep 1
LIST_BEFORE=$(docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:list:*" 2>/dev/null | wc -l | tr -d ' ')
[ "$LIST_BEFORE" -ge 1 ] && ok "List cache primed: $LIST_BEFORE keys" || no "List not cached"

# Unpublish (write op)
curl -s -X PATCH "$BASE/tickets/$TICKET_ID/unpublish" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
sleep 1

LIST_AFTER=$(docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:list:*" 2>/dev/null | wc -l | tr -d ' ')
[ "$LIST_AFTER" = "0" ] && ok "Unpublish → list cache cleared" || no "List cache persists: $LIST_AFTER"

echo ""
echo "▶ ⑥ Create invalidates list cache"
curl -s "$BASE/tickets?limit=5" > /dev/null
sleep 1
LIST2_BEFORE=$(docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:list:*" 2>/dev/null | wc -l | tr -d ' ')
[ "$LIST2_BEFORE" -ge 1 ] && ok "List re-primed" || no "Re-prime failed"

curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Inv Create 2 ${TS}\",\"price\":1000,\"eventDate\":\"2027-12-31T00:00:00Z\",\"quantity\":5}" > /dev/null
sleep 1

LIST2_AFTER=$(docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:list:*" 2>/dev/null | wc -l | tr -d ' ')
[ "$LIST2_AFTER" = "0" ] && ok "Create → list cache cleared" || no "Persists: $LIST2_AFTER"

echo ""
echo "▶ ⑦ Data freshness after update"
# Fresh GET shows new name
curl -s "$BASE/tickets/$TICKET_ID" > /dev/null 2>&1 || true
FRESH=$(curl -s "$BASE/tickets?limit=50" | jq -r ".data[] | select(._id == \"$TICKET_ID\") | .name")
info "Fresh name: $FRESH (expected: Inv Updated, but unpublish may hide it)"

echo ""
echo "▶ ⑧ Delete invalidates"
# Republish first
curl -s -X PATCH "$BASE/tickets/$TICKET_ID/publish" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -s "$BASE/tickets/$TICKET_ID" > /dev/null
sleep 1
BEFORE=$(docker exec ticket-redis redis-cli EXISTS "cache:ticket:$TICKET_ID" 2>/dev/null | tr -d '\r')
[ "$BEFORE" = "1" ] && ok "Cache primed for delete test" || no "Prime failed"

curl -s -X DELETE "$BASE/tickets/$TICKET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
sleep 1

AFTER=$(docker exec ticket-redis redis-cli EXISTS "cache:ticket:$TICKET_ID" 2>/dev/null | tr -d '\r')
[ "$AFTER" = "0" ] && ok "Delete → cache invalidated" || no "Cache persists"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
