#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

BASE=http://localhost:3000
WS=http://localhost:3000
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-10 Commit 1 — Verify${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ⓪ Server health"
if curl -s -o /dev/null -w "%{http_code}" $BASE/health --max-time 3 | grep -q "200"; then
  ok "Server running at $BASE"
else
  no "Server not running — please run 'npm run start:dev' in another terminal"
  exit 1
fi

echo ""
echo "▶ ① Files"
[ -f src/support/support.gateway.ts ] \
  && ok "support.gateway.ts" || no "support.gateway.ts missing"

echo ""
echo "▶ ② Gateway in module"
grep -q "SupportGateway" src/support/support.module.ts \
  && ok "Registered" || no "Not registered"

echo ""
echo "▶ ③ Gateway content"
grep -q "@WebSocketGateway" src/support/support.gateway.ts \
  && ok "@WebSocketGateway decorator" || no "Decorator missing"
grep -q "handleConnection" src/support/support.gateway.ts \
  && ok "handleConnection" || no "handleConnection missing"
grep -q "handleDisconnect" src/support/support.gateway.ts \
  && ok "handleDisconnect" || no "handleDisconnect missing"
grep -q "presence:" src/support/support.gateway.ts \
  && ok "presence key" || no "presence key missing"

echo ""
echo "▶ ④ Build"
if npm run build > /tmp/pj10-c1-build.log 2>&1; then
  ok "Build passes"
else
  no "Build failed"
  tail -15 /tmp/pj10-c1-build.log
  exit 1
fi

echo ""
echo "▶ ⑤ Server log — gateway init"
# Not reading server log — just check server is alive
curl -s -o /dev/null -w "%{http_code}" $BASE/health | grep -q "200" \
  && ok "Server responding" || no "Server not responding"

echo ""
echo "▶ ⑥ WebSocket connect test"

# Create test user
EMAIL="ws-c1-$(date +%s)@example.com"
curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\",\"fullName\":\"WS Test\"}" > /dev/null

TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rd123\"}" | jq -r '.data.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  no "Cannot get JWT token"
  exit 1
fi
ok "JWT token obtained"

# Node test client
cat > scripts/ws-test.js << 'JSEOF'
const { io } = require('socket.io-client');
const token = process.argv[2];

const socket = io('http://localhost:3000', {
  auth: { token },
  transports: ['websocket'],
  timeout: 5000,
  reconnection: false,
});

let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log('CONNECTED:' + socket.id);
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (err) => {
  console.log('CONNECT_ERROR:' + err.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  if (!connected) {
    console.log('DISCONNECT_BEFORE_CONNECT:' + reason);
    process.exit(1);
  }
});

socket.on('auth:error', (data) => {
  console.log('AUTH_ERROR:' + data.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('TIMEOUT');
  process.exit(1);
}, 8000);
JSEOF

RESULT=$(node scripts/ws-test.js "$TOKEN" 2>&1)

if echo "$RESULT" | grep -q "^CONNECTED:"; then
  SOCKET_ID=$(echo "$RESULT" | grep "^CONNECTED:" | cut -d: -f2)
  ok "WebSocket connected (id=$SOCKET_ID)"
else
  no "WebSocket connect failed: $RESULT"
fi

echo ""
echo "▶ ⑦ Presence in Redis (after disconnect — should be gone)"
sleep 1
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub')
PRESENCE=$(docker exec ticket-redis redis-cli GET "presence:$USER_ID" 2>/dev/null || \
           docker exec dev-redis redis-cli GET "presence:$USER_ID" 2>/dev/null)
info "presence:$USER_ID = '$PRESENCE' (empty = ✅ correct cleanup)"

echo ""
echo "▶ ⑧ Test invalid token"
BAD_RESULT=$(node scripts/ws-test.js "invalid-token" 2>&1)
if echo "$BAD_RESULT" | grep -qE "AUTH_ERROR|CONNECT_ERROR|DISCONNECT_BEFORE_CONNECT"; then
  ok "Invalid token rejected"
else
  no "Invalid token accepted (security issue): $BAD_RESULT"
fi

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"

[ $FAIL -gt 0 ] && exit 1 || exit 0
