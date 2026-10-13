#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-11 Commit 3 — Attachment Link Verify${N}"
echo -e "${B}════════════════════════════════════════${N}"

curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

# Setup
EMAIL="att-c3-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"C3\"}" > /dev/null
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
ok "Login"

TICKET=$(curl -s -X POST "$BASE/support-tickets" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"C3 att link","description":"Testing attachment link to message"}' \
  | jq -r '.data._id')
ok "Ticket: $TICKET"

# Upload 2 files
echo "File 1 content" > /tmp/f1.txt
echo "File 2 content" > /tmp/f2.txt

A1=$(curl -s -X POST "$BASE/attachments" -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/f1.txt;type=text/plain" -F "refType=document" | jq -r '.data._id')
A2=$(curl -s -X POST "$BASE/attachments" -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/f2.txt;type=text/plain" -F "refType=document" | jq -r '.data._id')
ok "Uploaded: $A1, $A2"

# Send message with attachmentIds
R=$(curl -s -X POST "$BASE/support-tickets/$TICKET/replies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"body\":\"Message with 2 attachments\",\"attachmentIds\":[\"$A1\",\"$A2\"]}")
MSG_ID=$(echo "$R" | jq -r '.data._id // empty')
ATT_URLS=$(echo "$R" | jq -r '.data.attachments | length')
[ -n "$MSG_ID" ] && ok "Message sent: $MSG_ID" || (no "Send failed: $R"; exit 1)
[ "$ATT_URLS" = "2" ] && ok "Message.attachments URLs: $ATT_URLS" || no "Expected 2, got: $ATT_URLS"

# Check attachment.attachmentIds has 2
ATT_IDS_LEN=$(echo "$R" | jq -r '.data.attachmentIds | length')
[ "$ATT_IDS_LEN" = "2" ] && ok "Message.attachmentIds: $ATT_IDS_LEN" || no "Expected 2, got: $ATT_IDS_LEN"

# Verify DB refId linked
LINKED=$(docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval \
  "db.attachments.countDocuments({ refType: 'support_message', refId: ObjectId('$MSG_ID') })" 2>/dev/null | tr -d '\r')
[ "$LINKED" = "2" ] && ok "DB link: $LINKED attachments → message" || no "Link failed: $LINKED"

# History populate
H=$(curl -s "$BASE/support-tickets/$TICKET/messages" -H "Authorization: Bearer $TOKEN")
POP=$(echo "$H" | jq -r '.data[0].attachmentIds[0].url // empty')
[ -n "$POP" ] && ok "History populate works" || no "Populate missing"

# Invalid attachment ID
BAD=$(curl -s -X POST "$BASE/support-tickets/$TICKET/replies" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"Bad att","attachmentIds":["000000000000000000000000"]}')
[ "$(echo "$BAD" | jq -r '.error.code')" = "ATTACHMENT_NOT_FOUND" ] && ok "Invalid att rejected" || no "Expected NOT_FOUND"

# Other user's attachment → denied
EMAIL2="att-c3b-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\",\"fullName\":\"Other\"}" > /dev/null
TOKEN2=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

TICKET2=$(curl -s -X POST "$BASE/support-tickets" -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Other","description":"Testing deny other attach"}' | jq -r '.data._id')

DENY=$(curl -s -X POST "$BASE/support-tickets/$TICKET2/replies" \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d "{\"body\":\"Steal\",\"attachmentIds\":[\"$A1\"]}")
[ "$(echo "$DENY" | jq -r '.error.code')" = "ATTACHMENT_ACCESS_DENIED" ] && ok "Other user denied" || no "Expected ACCESS_DENIED"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
