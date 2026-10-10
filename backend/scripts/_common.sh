#!/bin/bash
BASE="${BASE:-http://localhost:3000}"
MAILHOG="${MAILHOG:-http://localhost:8025}"
ADMIN_EMAIL="${ADMIN_EMAIL:-su-test@example.com}"
ADMIN_PASS="${ADMIN_PASS:-Passw0rd123}"

G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"
B="\033[0;34m"; C="\033[0;36m"; N="\033[0m"

PASS_COUNT=0
FAIL_COUNT=0

hr() {
  echo ""
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "${B}  $1${N}"
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
}
section() { echo ""; echo -e "${C}▶ $1${N}"; }
pass() { PASS_COUNT=$((PASS_COUNT+1)); echo -e "${G}  ✅ PASS — $1${N}"; }
fail() { FAIL_COUNT=$((FAIL_COUNT+1)); echo -e "${R}  ❌ FAIL — $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }
show() { echo "     $1"; }

assert_eq() {
  if [ "$1" = "$2" ]; then pass "$3"; else fail "$3 (got: $1, want: $2)"; fi
}
assert_not_empty() {
  if [ -n "$1" ] && [ "$1" != "null" ]; then pass "$2"; else fail "$2 (empty)"; fi
}
assert_contains() {
  if echo "$1" | grep -q "$2"; then pass "$3"; else fail "$3 (missing: $2)"; fi
}

print_summary() {
  echo ""
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "${G}  ✅ PASS: $PASS_COUNT${N}"
  if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${R}  ❌ FAIL: $FAIL_COUNT${N}"
  else
    echo -e "${G}  ❌ FAIL: 0${N}"
  fi
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  if [ $FAIL_COUNT -gt 0 ]; then exit 1; fi
}

login_admin() {
  ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
    | jq -r '.data.accessToken // empty')
}

login_customer() {
  local email="$1" pass="$2"
  CUST_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" \
    | jq -r '.data.accessToken // empty')
}

register_customer() {
  local email="$1" pass="$2"
  curl -s -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\",\"fullName\":\"Test User\"}" > /dev/null
}

health_check() {
  local code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health" --max-time 5)
  if [ "$code" != "200" ]; then
    echo -e "${R}❌ Server not reachable at $BASE${N}"
    exit 1
  fi
  echo -e "${G}✅ Server alive${N}"
}
