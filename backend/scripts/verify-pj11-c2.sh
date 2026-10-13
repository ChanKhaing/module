#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-11 Commit 2 — Verify (Upload)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in \
  src/attachments/schemas/attachment.schema.ts \
  src/attachments/dto/upload-attachment.dto.ts \
  src/attachments/attachments.service.ts \
  src/attachments/attachments.controller.ts \
  src/attachments/attachments.module.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Routes registered"
grep -q "Mapped {/attachments, POST}" /tmp/server.log \
  && ok "POST /attachments" || no "POST /attachments missing"
grep -q "Mapped {/attachments/:id/url, GET}" /tmp/server.log \
  && ok "GET /attachments/:id/url" || no "presigned route missing"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj11-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj11-c2-build.log; exit 1)

echo ""
echo "▶ ④ Login customer"
EMAIL="att-c2-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Att C2\"}" > /dev/null
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
[ -n "$TOKEN" ] && ok "Customer token" || (no "Login failed"; exit 1)

echo ""
echo "▶ ⑤ Upload valid file"
echo "Hello from PJ-11 commit 2" > /tmp/test-att.txt
UP=$(curl -s -X POST "$BASE/attachments" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-att.txt;type=text/plain" \
  -F "refType=document")
ATT_ID=$(echo "$UP" | jq -r '.data._id // empty')
[ -n "$ATT_ID" ] && ok "Uploaded id=$ATT_ID" || (no "Upload failed: $UP"; exit 1)

echo "  ↳ url: $(echo "$UP" | jq -r '.data.url')"
echo "  ↳ mime: $(echo "$UP" | jq -r '.data.mime')"
echo "  ↳ size: $(echo "$UP" | jq -r '.data.size')"

echo ""
echo "▶ ⑥ Presigned URL"
P=$(curl -s "$BASE/attachments/$ATT_ID/url" -H "Authorization: Bearer $TOKEN")
P_URL=$(echo "$P" | jq -r '.data.url // empty')
echo "$P_URL" | grep -q "http" && ok "Presigned URL returned" || no "Presigned failed"

echo ""
echo "▶ ⑦ Download via presigned"
if [ -n "$P_URL" ]; then
  DL=$(curl -s "$P_URL")
  [ "$DL" = "Hello from PJ-11 commit 2" ] && ok "Download matches" || no "Download mismatch: $DL"
fi

echo ""
echo "▶ ⑧ MIME not allowed"
echo "test" > /tmp/test.exe
BAD=$(curl -s -X POST "$BASE/attachments" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.exe;type=application/x-msdownload" \
  -F "refType=document")
CODE=$(echo "$BAD" | jq -r '.error.code // empty')
[ "$CODE" = "MIME_NOT_ALLOWED" ] && ok "MIME rejected: $CODE" || no "Expected MIME_NOT_ALLOWED, got: $CODE"

echo ""
echo "▶ ⑨ File too large (>10MB)"
dd if=/dev/zero of=/tmp/big.bin bs=1M count=11 status=none
BIG=$(curl -s -X POST "$BASE/attachments" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/big.bin;type=text/plain" \
  -F "refType=document")
CODE=$(echo "$BIG" | jq -r '.error.code // empty')
[ "$CODE" = "FILE_TOO_LARGE" ] && ok "Size rejected: $CODE" || no "Expected FILE_TOO_LARGE, got: $CODE"

echo ""
echo "▶ ⑩ MongoDB metadata"
META=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.attachments.countDocuments({ refType: 'document' })" 2>/dev/null | tr -d '\r')
[ "$META" -ge 1 ] && ok "Metadata persisted: $META" || no "Metadata missing"

echo ""
echo "▶ ⑪ Delete"
DEL=$(curl -s -X DELETE "$BASE/attachments/$ATT_ID" -H "Authorization: Bearer $TOKEN")
MSG=$(echo "$DEL" | jq -r '.data.message // empty')
echo "$MSG" | grep -q "deleted" && ok "Delete works" || no "Delete failed: $DEL"

echo ""
echo "▶ ⑫ Presigned after delete → 404"
AFTER=$(curl -s "$BASE/attachments/$ATT_ID/url" -H "Authorization: Bearer $TOKEN")
CODE=$(echo "$AFTER" | jq -r '.error.code // empty')
[ "$CODE" = "ATTACHMENT_NOT_FOUND" ] && ok "Deleted → 404" || no "Expected 404, got: $CODE"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
