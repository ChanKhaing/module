#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-11 Commit 3 — Verify (Download + List)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Routes"
grep -q "Mapped {/attachments, GET}" /tmp/server.log \
  && ok "GET /attachments" || no "GET /attachments missing"
grep -q "Mapped {/attachments/:id/download, GET}" /tmp/server.log \
  && ok "GET /attachments/:id/download" || no "download route missing"

echo ""
echo "▶ ② Build"
npm run build > /tmp/pj11-c3-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj11-c3-build.log; exit 1)

echo ""
echo "▶ ③ Setup"
EMAIL="att-c3-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Att C3\"}" > /dev/null
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
[ -n "$TOKEN" ] && ok "Customer token"

echo ""
echo "▶ ④ Upload 3 files with refType=document"
CONTENT="PJ-11 download test content $(date +%s)"
echo "$CONTENT" > /tmp/att-dl.txt

IDS=""
for i in 1 2 3; do
  R=$(curl -s -X POST "$BASE/attachments" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/tmp/att-dl.txt;type=text/plain" \
    -F "refType=document")
  ID=$(echo "$R" | jq -r '.data._id // empty')
  IDS="$IDS $ID"
done
echo "  ↳ 3 IDs: $IDS"

echo ""
echo "▶ ⑤ GET /attachments (list)"
L=$(curl -s "$BASE/attachments?refType=document&limit=10" -H "Authorization: Bearer $TOKEN")
TOTAL=$(echo "$L" | jq -r '.meta.total // 0')
[ "$TOTAL" -ge 3 ] && ok "List total: $TOTAL" || no "List failed: $TOTAL"

echo ""
echo "▶ ⑥ Filter by refType=avatar → 0"
L2=$(curl -s "$BASE/attachments?refType=avatar" -H "Authorization: Bearer $TOKEN")
T2=$(echo "$L2" | jq -r '.meta.total // 0')
[ "$T2" = "0" ] && ok "Filter works (avatar=0)" || no "Filter failed: $T2"

echo ""
echo "▶ ⑦ Download stream — content match"
FIRST_ID=$(echo "$IDS" | awk '{print $1}')
DL_URL="$BASE/attachments/$FIRST_ID/download"
DL_CONTENT=$(curl -s "$DL_URL" -H "Authorization: Bearer $TOKEN")
if [ "$DL_CONTENT" = "$CONTENT" ]; then
  ok "Download content matches"
else
  no "Download mismatch"
  echo "     got:      '$DL_CONTENT'"
  echo "     expected: '$CONTENT'"
fi

echo ""
echo "▶ ⑧ Download — headers check"
curl -s -D /tmp/dl-headers.txt -o /dev/null "$DL_URL" -H "Authorization: Bearer $TOKEN"
grep -qi "content-type: text/plain" /tmp/dl-headers.txt \
  && ok "Content-Type header" || no "Content-Type missing"
grep -qi "content-disposition: attachment" /tmp/dl-headers.txt \
  && ok "Content-Disposition header" || no "Content-Disposition missing"

echo ""
echo "▶ ⑨ Download — no token → 401"
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$DL_URL")
[ "$NOAUTH" = "401" ] && ok "Auth required" || no "Expected 401, got: $NOAUTH"

echo ""
echo "▶ ⑩ Download — 404 after delete"
curl -s -X DELETE "$BASE/attachments/$FIRST_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
AFTER=$(curl -s "$BASE/attachments/$FIRST_ID/download" -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$AFTER" | jq -r '.error.code // empty')
[ "$CODE" = "ATTACHMENT_NOT_FOUND" ] && ok "Deleted → 404" || no "Expected 404, got: $CODE"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
