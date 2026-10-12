#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-10 Commit 2 — Verify (Rooms)${N}"
echo -e "${B}════════════════════════════════════════${N}"

# ⓪ Server
echo ""
echo "▶ ⓪ Server"
curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200" \
  && ok "Server running" || (no "Server down"; exit 1)

# ① Gateway has room events
echo ""
echo "▶ ① Gateway content"
grep -q "support:join" src/support/support.gateway.ts \
  && ok "support:join" || no "support:join missing"
grep -q "support:leave" src/support/support.gateway.ts \
  && ok "support:leave" || no "support:leave missing"
grep -q "client.join" src/support/support.gateway.ts \
  && ok "client.join()" || no "join() missing"

# ② Build
echo ""
echo "▶ ② Build"
npm run build > /tmp/pj10-c2-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj10-c2-build.log; exit 1)

# ③ Room test
echo ""
echo "▶ ③ Room join + isolation test"

# Setup: admin + customer + ticket
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123"}' | jq -r '.data.accessToken')

EMAIL="ws-c2-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"WS C2\"}" > /dev/null
CUST_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

TICKET_ID=$(curl -s -X POST $BASE/support-tickets \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Room test","description":"Testing rooms in socket io now"}' \
  | jq -r '.data._id')

# Second ticket (for isolation)
TICKET_ID_2=$(curl -s -X POST $BASE/support-tickets \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Room test 2","description":"Second ticket for isolation test"}' \
  | jq -r '.data._id')

# Third user (no access)
EMAIL2="ws-c2b-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\",\"fullName\":\"WS C2B\"}" > /dev/null
OTHER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

info "Ticket 1: $TICKET_ID"
info "Ticket 2: $TICKET_ID_2"

# Node test: 2 sockets join same room
cat > scripts/ws-room-test.js << 'JSEOF'
const { io } = require('socket.io-client');
const [, , custToken, adminToken, otherToken, ticketId, ticket2Id] = process.argv;
const URL = 'http://localhost:3000';

function mkSocket(token) {
  return io(URL, { auth: { token }, reconnection: false, timeout: 8000 });
}

async function waitConnect(sock, name) {
  return new Promise((res, rej) => {
    sock.on('connect', () => res());
    sock.on('connect_error', (e) => rej(new Error(name + ': ' + e.message)));
    setTimeout(() => rej(new Error(name + ': timeout')), 9000);
  });
}

(async () => {
  const cust = mkSocket(custToken);
  const admin = mkSocket(adminToken);
  const other = mkSocket(otherToken);

  try {
    await Promise.all([
      waitConnect(cust, 'cust'),
      waitConnect(admin, 'admin'),
      waitConnect(other, 'other'),
    ]);
    console.log('ALL_CONNECTED');

    // ① customer joins ticket room
    const joinRes = await new Promise((res) => {
      cust.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('CUST_JOIN=' + JSON.stringify(joinRes));

    // ② admin joins same room
    const joinRes2 = await new Promise((res) => {
      admin.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('ADMIN_JOIN=' + JSON.stringify(joinRes2));

    // ③ other user (no access) tries to join ticket 2 (own ticket)
    const otherJoin = await new Promise((res) => {
      other.emit('support:join', { ticketId: ticket2Id }, (r) => res(r));
    });
    console.log('OTHER_JOIN_OWN=' + JSON.stringify(otherJoin));

    // ④ other user tries to join customer's ticket 1 → should deny
    const denyJoin = await new Promise((res) => {
      other.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('OTHER_JOIN_OTHER=' + JSON.stringify(denyJoin));

    // ⑤ leave
    const leaveRes = await new Promise((res) => {
      cust.emit('support:leave', { ticketId }, (r) => res(r));
    });
    console.log('CUST_LEAVE=' + JSON.stringify(leaveRes));

    cust.disconnect();
    admin.disconnect();
    other.disconnect();
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.log('ERROR=' + err.message);
    cust.disconnect();
    admin.disconnect();
    other.disconnect();
    process.exit(1);
  }
})();
JSEOF

RESULT=$(node scripts/ws-room-test.js "$CUST_TOKEN" "$ADMIN_TOKEN" "$OTHER_TOKEN" "$TICKET_ID" "$TICKET_ID_2" 2>&1)
echo "$RESULT" | sed 's/^/  /'

echo "$RESULT" | grep -q "ALL_CONNECTED" && ok "3 clients connected" || no "Connect failed"
echo "$RESULT" | grep -q '"ok":true' && ok "Join works" || no "Join failed"
echo "$RESULT" | grep -q 'OTHER_JOIN_OTHER=.*"ok":false' && ok "Other user denied on customer's ticket" || no "Access control failed"
echo "$RESULT" | grep -q 'OTHER_JOIN_OWN=.*"ok":false' && ok "Other user denied on customer's ticket 2 (isolation)" || no "Isolation failed"
echo "$RESULT" | grep -q 'CUST_LEAVE=.*"ok":true' && ok "Leave works" || no "Leave failed"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
