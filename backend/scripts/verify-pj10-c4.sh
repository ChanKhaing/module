#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-10 Commit 4 — Verify (Typing + Presence)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

echo ""
echo "▶ ① Gateway content"
for ev in typing:start typing:stop message:read presence:check; do
  grep -q "$ev" src/support/support.gateway.ts \
    && ok "$ev" || no "$ev missing"
done

echo ""
echo "▶ ② Service"
grep -q "async markMessagesRead" src/support/support.service.ts \
  && ok "markMessagesRead" || no "markMessagesRead missing"

echo ""
echo "▶ ③ Build"
npm run build > /tmp/pj10-c4-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj10-c4-build.log; exit 1)

echo ""
echo "▶ ④ Test data"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')

EMAIL="ws-c4-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"WS C4\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

CUST_ID=$(echo "$CUST_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')
ADMIN_ID=$(echo "$ADMIN_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')

TICKET_ID=$(curl -s -X POST $BASE/support-tickets \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"WS c4 test","description":"Testing typing and read events now"}' \
  | jq -r '.data._id')

info "Ticket: $TICKET_ID"
info "Cust ID: $CUST_ID"
info "Admin ID: $ADMIN_ID"

echo ""
echo "▶ ⑤ Typing + Read + Presence flow"

cat > scripts/ws-typing-test.js << 'JSEOF'
const { io } = require('socket.io-client');
const [, , custToken, adminToken, ticketId, custId, adminId] = process.argv;
const URL = 'http://localhost:3000';

function mk(t) { return io(URL, { auth: { token: t }, reconnection: false, timeout: 8000 }); }
async function wait(s, n) {
  return new Promise((res, rej) => {
    s.on('connect', res);
    s.on('connect_error', (e) => rej(new Error(n + ': ' + e.message)));
    setTimeout(() => rej(new Error(n + ': timeout')), 9000);
  });
}

(async () => {
  const cust = mk(custToken);
  const admin = mk(adminToken);

  try {
    await Promise.all([wait(cust, 'cust'), wait(admin, 'admin')]);
    console.log('CONNECTED');

    await new Promise((r) => cust.emit('support:join', { ticketId }, r));
    await new Promise((r) => admin.emit('support:join', { ticketId }, r));
    console.log('JOINED');

    // ① typing:start (cust) → admin receives
    const typingPromise = new Promise((res) => {
      admin.on('typing', (d) => res(d));
      setTimeout(() => res(null), 4000);
    });
    await new Promise((r) => cust.emit('typing:start', { ticketId }, r));
    const typing = await typingPromise;
    if (typing && typing.isTyping === true && typing.userId === custId) {
      console.log('TYPING_OK=' + JSON.stringify({ isTyping: typing.isTyping, role: typing.role }));
    } else {
      console.log('TYPING_FAIL=' + JSON.stringify(typing));
    }

    // ② typing:stop
    const typingStopPromise = new Promise((res) => {
      admin.once('typing', (d) => res(d));
      setTimeout(() => res(null), 4000);
    });
    await new Promise((r) => cust.emit('typing:stop', { ticketId }, r));
    const typingStop = await typingStopPromise;
    console.log('TYPING_STOP=' + JSON.stringify(typingStop));

    // ③ message send (admin) — so customer has unread
    await new Promise((r) => admin.emit('message:send', { ticketId, body: 'Reply from admin' }, r));

    // ④ customer marks read
    const readAck = await new Promise((r) => cust.emit('message:read', { ticketId }, r));
    console.log('READ_ACK=' + JSON.stringify(readAck));

    // ⑤ presence:check
    const presence = await new Promise((r) => {
      cust.emit('presence:check', { userIds: [adminId, custId, '000000000000000000000000'] }, r);
    });
    console.log('PRESENCE=' + JSON.stringify(presence));

    cust.disconnect();
    admin.disconnect();
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.log('ERROR=' + err.message);
    cust.disconnect();
    admin.disconnect();
    process.exit(1);
  }
})();
JSEOF

RESULT=$(node scripts/ws-typing-test.js "$CUST_TOKEN" "$ADMIN_TOKEN" "$TICKET_ID" "$CUST_ID" "$ADMIN_ID" 2>&1)
echo "$RESULT" | sed 's/^/  /'

echo ""
echo "$RESULT" | grep -q "TYPING_OK" && ok "typing:start → admin received" || no "typing:start failed"
echo "$RESULT" | grep -q 'TYPING_STOP=.*"isTyping":false' && ok "typing:stop → isTyping:false" || no "typing:stop failed"
echo "$RESULT" | grep -q 'READ_ACK=.*"ok":true' && ok "message:read ack" || no "read failed"
echo "$RESULT" | grep -q 'PRESENCE=.*"data":' && ok "presence:check returns data" || no "presence check failed"

echo ""
echo "▶ ⑥ REST verify (readAt persisted)"
REST_MSG=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" -H "Authorization: Bearer $ADMIN_TOKEN")
READ_COUNT=$(echo "$REST_MSG" | jq '[.data[] | select(.readAt != null)] | length')
[ "$READ_COUNT" -ge 1 ] && ok "readAt persisted: $READ_COUNT" || no "readAt not persisted"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
