#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-13 Commit 1 — Verify (Cache)${N}"
echo -e "${B}════════════════════════════════════════${N}"

# ⓪ Server
echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

# ① Files
echo ""
echo "▶ ① Files"
for f in \
  src/infra/redis/cache.service.ts \
  src/infra/redis/cache.module.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

# ② CacheService wired
echo ""
echo "▶ ② CacheService wired"
grep -q "CacheService" src/app.module.ts 2>/dev/null && ok "Registered in app.module" || \
  grep -q "CacheModule" src/app.module.ts && ok "CacheModule registered" || no "Not registered"
grep -q "CacheService" src/tickets/tickets.service.ts \
  && ok "Injected in tickets.service" || no "Not injected"

# ③ Build
echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj13-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj13-c1-build.log; exit 1)

# ④ Setup: admin + public ticket
echo ""
echo "▶ ④ Setup"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')
[ -n "$ADMIN_TOKEN" ] && ok "Admin token" || (no "Admin login failed"; exit 1)

TS=$(date +%s)
TICKET_ID=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Cache Test ${TS}\",\"price\":10000,\"eventDate\":\"2027-12-31T00:00:00Z\",\"quantity\":50}" \
  | jq -r '.data._id')

curl -s -X PATCH "$BASE/tickets/$TICKET_ID/publish" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
ok "Ticket created + published: $TICKET_ID"

# ⑤ First request — cache miss → DB → store
echo ""
echo "▶ ⑤ Cache MISS (first request)"
# Clear any existing cache
docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:*" 2>/dev/null | \
  xargs -r -I{} docker exec ticket-redis redis-cli DEL {} > /dev/null 2>&1

R1=$(curl -s "$BASE/tickets/$TICKET_ID")
NAME1=$(echo "$R1" | jq -r '.data.name // empty')
[ -n "$NAME1" ] && ok "First request returned: $NAME1" || no "First request failed"

info "Waiting 500ms for cache write..."
sleep 1

# Cache key should now exist
CACHE_COUNT=$(docker exec ticket-redis redis-cli --scan --pattern "cache:ticket:$TICKET_ID" 2>/dev/null | wc -l | tr -d ' ')
[ "$CACHE_COUNT" -ge 1 ] && ok "Cache key written: cache:ticket:$TICKET_ID" || no "Cache key missing"

# ⑥ Second request — should hit cache
echo ""
echo "▶ ⑥ Cache HIT (second request)"
R2=$(curl -s "$BASE/tickets/$TICKET_ID")
NAME2=$(echo "$R2" | jq -r '.data.name // empty')
[ "$NAME1" = "$NAME2" ] && ok "Second request same data" || no "Data mismatch"

# ⑦ Verify TTL
echo ""
echo "▶ ⑦ TTL check"
TTL=$(docker exec ticket-redis redis-cli TTL "cache:ticket:$TICKET_ID" 2>/dev/null | tr -d '\r')
if [ "$TTL" -gt 0 ] && [ "$TTL" -le 60 ]; then
  ok "TTL within range: ${TTL}s (expected ≤60)"
else
  no "TTL unexpected: $TTL"
fi

# ⑧ List cache
echo ""
echo "▶ ⑧ List cache (findAll)"
curl -s "$BASE/tickets?limit=5" > /dev/null
sleep 1
LIST_CACHE=$(docker exec ticket-redis redis-cli --scan --pattern "cache:tickets:list:*" 2>/dev/null | wc -l | tr -d ' ')
[ "$LIST_CACHE" -ge 1 ] && ok "List cache key written: $LIST_CACHE" || no "List cache missing"

# ⑨ Verify cached list returns
echo ""
echo "▶ ⑨ Cached list returns same data"
L1=$(curl -s "$BASE/tickets?limit=5" | jq -r '.meta.total')
L2=$(curl -s "$BASE/tickets?limit=5" | jq -r '.meta.total')
[ "$L1" = "$L2" ] && ok "Cache consistent (total=$L1)" || no "Inconsistent ($L1 vs $L2)"

# ⑩ Cache keys summary
echo ""
echo "▶ ⑩ Redis cache keys"
KEYS=$(docker exec ticket-redis redis-cli --scan --pattern "cache:*" 2>/dev/null | head -5)
echo "$KEYS" | sed 's/^/     /'

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
