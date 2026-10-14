#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-16 Commit 2 — Verify (Rate Limit)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① ThrottlerModule registered"
grep -q "ThrottlerModule" src/app.module.ts && ok "Imported" || no "Missing"
grep -q "ThrottlerGuard" src/app.module.ts && ok "Guard registered" || no "Guard missing"

echo ""
echo "▶ ② Build"
npm run build > /tmp/pj16-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj16-c2-build.log; exit 1)

echo ""
echo "▶ ③ Rate limit headers on response"
H=$(curl -s -D - -o /dev/null $BASE/health)
echo "$H" | grep -qi "x-ratelimit" \
  && ok "RateLimit headers present" \
  || info "No RateLimit headers (may be hidden for 200)"

echo ""
echo "▶ ④ Burst test — 50 requests, count 429s"
LIMITED=0
SUCCESS=0
for i in $(seq 1 50); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/health)
  if [ "$CODE" = "429" ]; then LIMITED=$((LIMITED+1)); fi
  if [ "$CODE" = "200" ]; then SUCCESS=$((SUCCESS+1)); fi
done
info "50 requests → $SUCCESS success, $LIMITED limited (429)"

if [ "$LIMITED" -ge 1 ]; then
  ok "Rate limiting triggered ($LIMITED x 429)"
else
  no "Rate limit not triggered (unexpected)"
fi

echo ""
echo "▶ ⑤ After 1s — should recover"
sleep 2
RECOVER=$(curl -s -o /dev/null -w "%{http_code}" $BASE/health)
[ "$RECOVER" = "200" ] && ok "Recovered: 200" || info "Still $RECOVER"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
