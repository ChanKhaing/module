#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-16 Commit 1 — Verify (Helmet + CORS)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① helmet in main.ts"
grep -q "helmet" src/main.ts && ok "helmet imported" || no "helmet missing"
grep -qE "helmet\(|helmet\(" src/main.ts && ok "helmet applied" || no "not applied"

echo ""
echo "▶ ② CORS in main.ts"
grep -q "enableCors" src/main.ts && ok "enableCors" || no "missing"
grep -q "CORS_ORIGINS" .env && ok "env var present" || no "missing"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj16-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj16-c1-build.log; exit 1)

echo ""
echo "▶ ④ Helmet headers present"
H=$(curl -s -D - -o /dev/null $BASE/health)
echo "$H" | grep -qi "x-content-type-options" && ok "X-Content-Type-Options" || no "missing"
echo "$H" | grep -qi "x-frame-options" && ok "X-Frame-Options" || no "missing"
echo "$H" | grep -qi "strict-transport-security" && ok "HSTS" || no "missing"
echo "$H" | grep -qi "x-dns-prefetch-control" && ok "X-DNS-Prefetch-Control" || no "missing"

echo ""
echo "▶ ⑤ CORS — allowed origin"
C=$(curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" $BASE/health)
echo "$C" | grep -qi "access-control-allow-origin" \
  && ok "Allowed origin accepted" || no "allowed origin failed"

echo ""
echo "▶ ⑥ CORS — blocked origin"
C2=$(curl -s -D - -o /dev/null -H "Origin: http://evil.com" $BASE/health)
if echo "$C2" | grep -qi "access-control-allow-origin: http://evil.com"; then
  no "Evil origin allowed (SECURITY)"
else
  ok "Evil origin blocked"
fi

echo ""
echo "▶ ⑦ Health still works"
curl -s $BASE/health | jq -e '.status == "ok"' > /dev/null \
  && ok "Health endpoint working" || no "broken"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
