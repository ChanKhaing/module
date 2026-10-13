#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-12 Commit 1 — Verify (REST)${N}"
echo -e "${B}════════════════════════════════════════${N}"

curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Files"
for f in \
  src/notifications/schemas/notification.schema.ts \
  src/notifications/dto/query-notification.dto.ts \
  src/notifications/notifications.service.ts \
  src/notifications/notifications.controller.ts \
  src/notifications/notifications.module.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② Routes"
for r in "/notifications/me, GET" "/notifications/me/unread-count, GET" "/notifications/me/:id/read, PATCH" "/notifications/me/read-all, PATCH" "/notifications/me/:id, DELETE"; do
  grep -q "Mapped {$r" /tmp/server.log && ok "$r" || no "$r missing"
done

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj12-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj12-c1-build.log; exit 1)

echo ""
echo "▶ ④ Setup: customer"
EMAIL="notif-c1-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"Notif C1\"}" > /dev/null
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')
[ -n "$USER_ID" ] && ok "User: $USER_ID"

echo ""
echo "▶ ⑤ Seed notifications directly in DB"
docker exec ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval "
    db.notifications.insertMany([
      { userId: ObjectId('$USER_ID'), type: 'system', title: 'Test A', body: 'First', isRead: false, createdAt: new Date(), updatedAt: new Date() },
      { userId: ObjectId('$USER_ID'), type: 'support_reply', title: 'Test B', body: 'Second', isRead: false, createdAt: new Date(), updatedAt: new Date() },
      { userId: ObjectId('$USER_ID'), type: 'system', title: 'Test C', body: 'Third', isRead: true, readAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ]);
    print('Inserted 3');
  " > /dev/null 2>&1
ok "DB seeded (3 notifications)"

echo ""
echo "▶ ⑥ List notifications"
L=$(curl -s "$BASE/notifications/me?limit=10" -H "Authorization: Bearer $TOKEN")
TOTAL=$(echo "$L" | jq -r '.meta.total // 0')
[ "$TOTAL" = "3" ] && ok "List total: $TOTAL" || no "List failed: $TOTAL"

echo ""
echo "▶ ⑦ Filter type=system"
L2=$(curl -s "$BASE/notifications/me?type=system" -H "Authorization: Bearer $TOKEN")
T2=$(echo "$L2" | jq -r '.meta.total // 0')
[ "$T2" = "2" ] && ok "Filter by type: $T2" || no "Filter failed: $T2"

echo ""
echo "▶ ⑧ Filter isRead=false"
L3=$(curl -s "$BASE/notifications/me?isRead=false" -H "Authorization: Bearer $TOKEN")
T3=$(echo "$L3" | jq -r '.meta.total // 0')
[ "$T3" = "2" ] && ok "Filter unread: $T3" || no "Filter failed: $T3"

echo ""
echo "▶ ⑨ Unread count"
UC=$(curl -s "$BASE/notifications/me/unread-count" -H "Authorization: Bearer $TOKEN")
CNT=$(echo "$UC" | jq -r '.data.unread // 0')
[ "$CNT" = "2" ] && ok "Unread count: $CNT" || no "Expected 2, got: $CNT"

echo ""
echo "▶ ⑩ Mark one read"
FIRST=$(echo "$L" | jq -r '.data[0]._id')
curl -s -X PATCH "$BASE/notifications/me/$FIRST/read" -H "Authorization: Bearer $TOKEN" > /dev/null
UC2=$(curl -s "$BASE/notifications/me/unread-count" -H "Authorization: Bearer $TOKEN")
CNT2=$(echo "$UC2" | jq -r '.data.unread // 0')
[ "$CNT2" = "1" ] && ok "Unread after mark: $CNT2" || no "Expected 1, got: $CNT2"

echo ""
echo "▶ ⑪ Mark all read"
curl -s -X PATCH "$BASE/notifications/me/read-all" -H "Authorization: Bearer $TOKEN" > /dev/null
UC3=$(curl -s "$BASE/notifications/me/unread-count" -H "Authorization: Bearer $TOKEN")
CNT3=$(echo "$UC3" | jq -r '.data.unread // 0')
[ "$CNT3" = "0" ] && ok "All read" || no "Expected 0, got: $CNT3"

echo ""
echo "▶ ⑫ Delete"
DEL=$(curl -s -X DELETE "$BASE/notifications/me/$FIRST" -H "Authorization: Bearer $TOKEN")
MSG=$(echo "$DEL" | jq -r '.data.message // empty')
echo "$MSG" | grep -q "deleted" && ok "Delete works" || no "Delete failed"

echo ""
echo "▶ ⑬ Other user → deny"
EMAIL2="notif-c1b-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\",\"fullName\":\"Other\"}" > /dev/null
TOKEN2=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

SECOND=$(echo "$L" | jq -r '.data[1]._id')
DENY=$(curl -s -X PATCH "$BASE/notifications/me/$SECOND/read" -H "Authorization: Bearer $TOKEN2")
D_CODE=$(echo "$DENY" | jq -r '.error.code // empty')
[ "$D_CODE" = "NOTIFICATION_ACCESS_DENIED" ] && ok "Other user denied" || no "Expected deny, got: $D_CODE"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
