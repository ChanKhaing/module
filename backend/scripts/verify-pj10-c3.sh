#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-10 Commit 3 — Verify (Messages)${N}"
echo -e "${B}════════════════════════════════════════${N}"

# ⓪ Server
echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

# ① Gateway content
echo ""
echo "▶ ① Gateway content"
grep -q "message:send" src/support/support.gateway.ts \
  && ok "message:send" || no "message:send missing"
grep -q "message:new" src/support/support.gateway.ts \
  && ok "message:new" || no "message:new missing"
grep -q "message:history" src/support/support.gateway.ts \
  && ok "message:history" || no "message:history missing"

# ② Build
echo ""
echo "▶ ② Build"
npm run build > /tmp/pj10-c3-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj10-c3-build.log; exit 1)

# ③ Setup test data
echo ""
echo "▶ ③ Setup"
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')

EMAIL="ws-c3-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"WS C3\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

TICKET_ID=$(curl -s -X POST $BASE/support-tickets \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"WS msg test","description":"Testing socket message flow now"}' \
  | jq -r '.data._id')

info "Ticket: $TICKET_ID"

# ④ Message flow test
echo ""
echo "▶ ④ Message flow (customer sends → admin receives)"

cat > scripts/ws-msg-test.js << 'JSEOF'
const { io } = require('socket.io-client');
const [, , custToken, adminToken, ticketId] = process.argv;
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

    // Admin joins room first (to receive)
    const adminJoin = await new Promise((r) => {
      admin.emit('support:join', { ticketId }, r);
    });
    console.log('ADMIN_JOIN=' + JSON.stringify(adminJoin));

    // Customer joins room
    const custJoin = await new Promise((r) => {
      cust.emit('support:join', { ticketId }, r);
    });
    console.log('CUST_JOIN=' + JSON.stringify(custJoin));

    // Admin listens for message:new
    const received = new Promise((res) => {
      admin.on('message:new', (d) => res(d));
      setTimeout(() => res(null), 5000);
    });

    // Customer sends message
    const sendAck = await new Promise((r) => {
      cust.emit('message:send', { ticketId, body: 'Hello from customer!' }, r);
    });
    console.log('SEND_ACK=' + JSON.stringify(sendAck));

    // Admin receives?
    const msg = await received;
    if (msg && msg.message && msg.message.body === 'Hello from customer!') {
      console.log('ADMIN_RECEIVED=' + JSON.stringify({ body: msg.message.body, role: msg.message.senderRole }));
    } else {
      console.log('ADMIN_RECEIVED=null');
    }

    // History
    const history = await new Promise((r) => {
      cust.emit('message:history', { ticketId, page: 1, limit: 10 }, r);
    });
    console.log('HISTORY=' + JSON.stringify(history));

    // Unauthorized send (unjoin + use wrong user? just check admin sends with internal flag)
    // Admin sends internal note (should work, staff-only)
    const internalAck = await new Promise((r) => {
      admin.emit('message:send', { ticketId, body: 'Internal only', isInternal: true }, r);
    });
    console.log('INTERNAL_SEND=' + JSON.stringify(internalAck));

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

RESULT=$(node scripts/ws-msg-test.js "$CUST_TOKEN" "$ADMIN_TOKEN" "$TICKET_ID" 2>&1)
echo "$RESULT" | sed 's/^/  /'

echo ""
echo "$RESULT" | grep -q "CONNECTED" && ok "Both connected" || no "Connect failed"
echo "$RESULT" | grep -q 'SEND_ACK=.*"ok":true' && ok "Customer send → ok" || no "Send failed"
echo "$RESULT" | grep -q 'ADMIN_RECEIVED=.*"body":"Hello from customer!"' && ok "Admin received via message:new" || no "Receive failed"
echo "$RESULT" | grep -q 'HISTORY=.*"ok":true.*"data":\[' && ok "History works" || no "History failed"
echo "$RESULT" | grep -q 'INTERNAL_SEND=.*"ok":true' && ok "Admin internal note ok" || no "Internal failed"

# ⑤ REST verify (message persisted)
echo ""
echo "▶ ⑤ REST verify (persistence)"
REST_MSG=$(curl -s "$BASE/support-tickets/$TICKET_ID/messages" -H "Authorization: Bearer $ADMIN_TOKEN")
TOTAL=$(echo "$REST_MSG" | jq -r '.data | length')
[ "$TOTAL" -ge 2 ] && ok "Persisted: $TOTAL messages" || no "Persist failed: $TOTAL"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
