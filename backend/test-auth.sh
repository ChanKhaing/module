#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AUTH Module — Full Endpoint Test
# ═══════════════════════════════════════════════════════════════

set -o pipefail

# ─── Config ───
BASE="${BASE:-http://localhost:3000}"
MAILHOG="${MAILHOG:-http://localhost:8025}"
ADMIN_EMAIL="${ADMIN_EMAIL:-su-test@example.com}"
ADMIN_PASS="${ADMIN_PASS:-Passw0rd123}"
TS=$(date +%s)
NEW_EMAIL="authtest-${TS}@example.com"
NEW_PASS="Passw0rd123"
NEW_PASS_2="NewPass456"

# ─── Colors ───
G="\033[0;32m"
R="\033[0;31m"
Y="\033[0;33m"
B="\033[0;34m"
C="\033[0;36m"
N="\033[0m"

# ─── Helpers ───
hr() {
  echo ""
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "${B}  $1${N}"
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
}
section() {
  echo ""
  echo -e "${C}▶ $1${N}"
}
pass() { echo -e "${G}  ✅ PASS — $1${N}"; }
fail() { echo -e "${R}  ❌ FAIL — $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }
show() { echo "     $1"; }

# ─── Assert helpers ───
assert_eq() {
  if [ "$1" = "$2" ]; then pass "$3"; else fail "$3 (got: $1, want: $2)"; fi
}
assert_not_empty() {
  if [ -n "$1" ] && [ "$1" != "null" ]; then pass "$2"; else fail "$2 (empty)"; fi
}
assert_contains() {
  if echo "$1" | grep -q "$2"; then pass "$3"; else fail "$3 (missing: $2)"; fi
}

# ─── MailHog helper (decode quoted-printable) ───
mail_extract() {
  local pattern="$1"
  curl -s "$MAILHOG/api/v2/messages" | python3 -c "
import sys, json, quopri, re
try:
    d = json.load(sys.stdin)
    if not d.get('items'): sys.exit(0)
    body = quopri.decodestring(d['items'][0]['Content']['Body'].encode()).decode('utf-8', errors='ignore')
    m = re.search(r'''$pattern''', body)
    print(m.group(1) if m else '')
except Exception:
    pass
"
}

mail_clear() { curl -s -X DELETE "$MAILHOG/api/v1/messages" > /dev/null 2>&1; }

# ═══════════════════════════════════════════════════════════════
# START
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     AUTH MODULE — FULL ENDPOINT TEST                      ║${N}"
echo -e "${G}║     Target: $BASE                          ${N}"
echo -e "${G}║     Time:   $(date '+%Y-%m-%d %H:%M:%S')                       ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

# ═══════════════════════════════════════════════════════════════
hr "① SERVER HEALTH CHECK"
# ═══════════════════════════════════════════════════════════════
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health" --max-time 5)
if [ "$HEALTH" = "200" ]; then
  pass "Server alive (HTTP $HEALTH)"
else
  fail "Server not responding (HTTP $HEALTH)"
  echo -e "${R}Aborting — server not reachable${N}"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════
hr "② REGISTER — POST /auth/register"
# ═══════════════════════════════════════════════════════════════
section "2.1 Happy path — new user"
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\",\"fullName\":\"Auth Test\"}")

REG_EMAIL=$(echo "$REG" | jq -r '.data.user.email // empty')
REG_ROLE=$(echo "$REG" | jq -r '.data.user.role // empty')
REG_VERIFIED=$(echo "$REG" | jq -r '.data.user.emailVerified')
REG_ACCESS=$(echo "$REG" | jq -r '.data.accessToken // empty')
REG_REFRESH=$(echo "$REG" | jq -r '.data.refreshToken // empty')

assert_eq "$REG_EMAIL" "$NEW_EMAIL" "Email matches"
assert_eq "$REG_ROLE" "customer" "Auto role = customer"
assert_eq "$REG_VERIFIED" "false" "emailVerified = false"
assert_not_empty "$REG_ACCESS" "accessToken returned"
assert_not_empty "$REG_REFRESH" "refreshToken returned"

section "2.2 Duplicate email → conflict"
DUP=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\",\"fullName\":\"Duplicate\"}")
DUP_CODE=$(echo "$DUP" | jq -r '.error.code // empty')
assert_contains "$DUP_CODE" "CONFLICT" "Duplicate blocked"

section "2.3 Bad email format → 400"
BAD=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"Passw0rd123","fullName":"Bad"}')
BAD_CODE=$(echo "$BAD" | jq -r '.error.code // empty')
assert_eq "$BAD_CODE" "BAD_REQUEST" "Bad email rejected"

section "2.4 Short password → 400"
SHORT=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"short-'$TS'@example.com","password":"123","fullName":"Short"}')
assert_eq "$(echo "$SHORT" | jq -r '.error.code // empty')" "BAD_REQUEST" "Short password rejected"

# ═══════════════════════════════════════════════════════════════
hr "③ LOGIN — POST /auth/login"
# ═══════════════════════════════════════════════════════════════
section "3.1 Correct credentials"
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\"}")

CUST_TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken // empty')
CUST_REFRESH=$(echo "$LOGIN" | jq -r '.data.refreshToken // empty')
assert_not_empty "$CUST_TOKEN" "accessToken returned"
assert_not_empty "$CUST_REFRESH" "refreshToken returned"

section "3.2 Wrong password → 401"
WRONG=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"WrongPass123\"}")
assert_eq "$(echo "$WRONG" | jq -r '.error.code // empty')" "AUTH_INVALID_CREDENTIALS" "Wrong password blocked"

section "3.3 Unknown email → 401"
UNKNOWN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.com","password":"Passw0rd123"}')
assert_eq "$(echo "$UNKNOWN" | jq -r '.error.code // empty')" "AUTH_INVALID_CREDENTIALS" "Unknown email blocked"

section "3.4 Admin login"
ADMIN_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.accessToken // empty')
assert_not_empty "$ADMIN_TOKEN" "Admin token obtained"

# ═══════════════════════════════════════════════════════════════
hr "④ JWT PAYLOAD INSPECT"
# ═══════════════════════════════════════════════════════════════
section "4.1 Access token payload"
ACCESS_PAYLOAD=$(echo "$CUST_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null)
A_SUB=$(echo "$ACCESS_PAYLOAD" | jq -r '.sub // empty')
A_TYPE=$(echo "$ACCESS_PAYLOAD" | jq -r '.type // empty')
A_PERMS=$(echo "$ACCESS_PAYLOAD" | jq -r '.permissions | length')
A_EXP=$(echo "$ACCESS_PAYLOAD" | jq -r '.exp')
A_IAT=$(echo "$ACCESS_PAYLOAD" | jq -r '.iat')
A_TTL=$((A_EXP - A_IAT))

assert_not_empty "$A_SUB" "sub (userId) present"
assert_eq "$A_TYPE" "access" "type = access"
assert_eq "$A_TTL" "900" "TTL = 900s (15min)"
info "Permissions: $A_PERMS codes"

section "4.2 Refresh token payload"
REFRESH_PAYLOAD=$(echo "$CUST_REFRESH" | cut -d'.' -f2 | base64 -d 2>/dev/null)
R_TYPE=$(echo "$REFRESH_PAYLOAD" | jq -r '.type // empty')
R_EXP=$(echo "$REFRESH_PAYLOAD" | jq -r '.exp')
R_IAT=$(echo "$REFRESH_PAYLOAD" | jq -r '.iat')
R_TTL=$((R_EXP - R_IAT))

assert_eq "$R_TYPE" "refresh" "type = refresh"
assert_eq "$R_TTL" "604800" "TTL = 604800s (7d)"

# ═══════════════════════════════════════════════════════════════
hr "⑤ /users/me — GET PROFILE (protected)"
# ═══════════════════════════════════════════════════════════════
section "5.1 With valid token"
ME=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$ME" | jq -r '.data.email // empty')" "$NEW_EMAIL" "Profile returned"
assert_eq "$(echo "$ME" | jq -r '.data.passwordHash // "none"')" "none" "No password in response"

section "5.2 Without token → 401"
NO_AUTH=$(curl -s "$BASE/users/me")
assert_eq "$(echo "$NO_AUTH" | jq -r '.error.code // empty')" "AUTH_TOKEN_MISSING" "Missing token blocked"

section "5.3 With bad token → 401"
BAD_TOKEN=$(curl -s "$BASE/users/me" -H "Authorization: Bearer invalid.jwt.token")
assert_eq "$(echo "$BAD_TOKEN" | jq -r '.error.code // empty')" "AUTH_TOKEN_INVALID" "Invalid token blocked"

# ═══════════════════════════════════════════════════════════════
hr "⑥ REFRESH ROTATION — POST /auth/refresh"
# ═══════════════════════════════════════════════════════════════
section "6.1 Old JTI capture"
OLD_JTI=$(echo "$CUST_REFRESH" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.jti')
show "Old JTI: $OLD_JTI"

section "6.2 Refresh → new tokens"
REFRESHED=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$CUST_REFRESH\"}")

NEW_ACCESS=$(echo "$REFRESHED" | jq -r '.data.accessToken // empty')
NEW_REFRESH=$(echo "$REFRESHED" | jq -r '.data.refreshToken // empty')
assert_not_empty "$NEW_ACCESS" "New access token"
assert_not_empty "$NEW_REFRESH" "New refresh token"

NEW_JTI=$(echo "$NEW_REFRESH" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.jti')
show "New JTI: $NEW_JTI"
if [ "$OLD_JTI" != "$NEW_JTI" ]; then
  pass "JTI rotated (old ≠ new)"
else
  fail "JTI not rotated"
fi

section "6.3 New access works"
ME2=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $NEW_ACCESS")
assert_eq "$(echo "$ME2" | jq -r '.data.email // empty')" "$NEW_EMAIL" "New access valid"

section "6.4 Old refresh reuse → REUSED error"
REUSE=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$CUST_REFRESH\"}")
assert_eq "$(echo "$REUSE" | jq -r '.error.code // empty')" "AUTH_REFRESH_TOKEN_REUSED" "Reuse detected"

section "6.5 After reuse — all sessions revoked"
CHECK=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}")
assert_eq "$(echo "$CHECK" | jq -r '.error.code // empty')" "AUTH_REFRESH_TOKEN_REUSED" "All sessions revoked"

# ═══════════════════════════════════════════════════════════════
hr "⑦ OTP — EMAIL VERIFICATION"
# ═══════════════════════════════════════════════════════════════
mail_clear
info "MailHog cleared"

section "7.1 Request OTP"
OTP_REQ=$(curl -s -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\"}")
assert_eq "$(echo "$OTP_REQ" | jq -r '.success')" "true" "OTP request accepted"
show "Message: $(echo "$OTP_REQ" | jq -r '.data.message')"
show "Expires: $(echo "$OTP_REQ" | jq -r '.data.expiresIn')s"

sleep 2
section "7.2 Extract OTP from MailHog"
OTP=$(mail_extract '(\d{6})')
if [ -n "$OTP" ]; then
  pass "OTP extracted: $OTP"
else
  fail "OTP not found in MailHog"
fi

section "7.3 Verify OTP"
OTP_VER=$(curl -s -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"code\":\"$OTP\"}")
assert_eq "$(echo "$OTP_VER" | jq -r '.data.verified')" "true" "Email verified"

section "7.4 Wrong OTP → error"
mail_clear
curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\"}" > /dev/null
sleep 1
WRONG_OTP=$(curl -s -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"code\":\"000000\"}")
WRONG_CODE=$(echo "$WRONG_OTP" | jq -r '.error.code // empty')
if [[ "$WRONG_CODE" == "OTP_INVALID" || "$WRONG_CODE" == "OTP_NOT_FOUND" ]]; then
  pass "Wrong OTP rejected ($WRONG_CODE)"
else
  fail "Wrong OTP should be rejected (got: $WRONG_CODE)"
fi

section "7.5 OTP reuse → NOT_FOUND"
REUSE_OTP=$(curl -s -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"code\":\"$OTP\"}")
assert_eq "$(echo "$REUSE_OTP" | jq -r '.error.code // empty')" "OTP_NOT_FOUND" "OTP consumed"

# ═══════════════════════════════════════════════════════════════
hr "⑧ PASSWORD RESET"
# ═══════════════════════════════════════════════════════════════
mail_clear

section "8.1 Forgot password request"
FORGOT=$(curl -s -X POST "$BASE/auth/forgot" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\"}")
assert_eq "$(echo "$FORGOT" | jq -r '.success')" "true" "Forgot accepted"
show "Message: $(echo "$FORGOT" | jq -r '.data.message')"

section "8.2 Unknown email — same message (no enumeration)"
UNK=$(curl -s -X POST "$BASE/auth/forgot" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.com"}')
assert_eq "$(echo "$UNK" | jq -r '.data.message // empty')" "$(echo "$FORGOT" | jq -r '.data.message')" "Same message"

sleep 2
section "8.3 Extract reset token"
RESET_TOKEN=$(mail_extract 'token=([a-f0-9]{64})')
if [ -n "$RESET_TOKEN" ]; then
  pass "Token: ${RESET_TOKEN:0:20}... (len=${#RESET_TOKEN})"
else
  fail "Reset token not found"
fi

section "8.4 Reset password"
RESET=$(curl -s -X POST "$BASE/auth/reset" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"$NEW_PASS_2\"}")
assert_contains "$(echo "$RESET" | jq -r '.data.message // empty')" "successful" "Reset successful"

section "8.5 Old password fails"
OLD_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS\"}")
assert_eq "$(echo "$OLD_LOGIN" | jq -r '.error.code // empty')" "AUTH_INVALID_CREDENTIALS" "Old password rejected"

section "8.6 New password works"
NEW_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}")
assert_eq "$(echo "$NEW_LOGIN" | jq -r '.data.user.email // empty')" "$NEW_EMAIL" "New password works"

section "8.7 Reset token reuse → INVALID"
REUSE_RESET=$(curl -s -X POST "$BASE/auth/reset" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"AnotherPass789\"}")
assert_eq "$(echo "$REUSE_RESET" | jq -r '.error.code // empty')" "RESET_TOKEN_INVALID" "Token one-time use"

# ═══════════════════════════════════════════════════════════════
hr "⑨ LOGOUT + LOGOUT-ALL"
# ═══════════════════════════════════════════════════════════════
section "9.1 Setup 2 sessions"
S1=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}")
S1_R=$(echo "$S1" | jq -r '.data.refreshToken')

S2=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}")
S2_R=$(echo "$S2" | jq -r '.data.refreshToken')
S2_A=$(echo "$S2" | jq -r '.data.accessToken')

assert_not_empty "$S1_R" "Session 1 created"
assert_not_empty "$S2_R" "Session 2 created"

section "9.2 Logout session 1"
LO1=$(curl -s -X POST "$BASE/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$S1_R\"}")
assert_eq "$(echo "$LO1" | jq -r '.data.message // empty')" "Logged out successfully" "Session 1 logged out"

section "9.3 Session 1 refresh fails"
S1_CHECK=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$S1_R\"}")
assert_eq "$(echo "$S1_CHECK" | jq -r '.error.code // empty')" "AUTH_REFRESH_TOKEN_REUSED" "Session 1 invalid"

section "9.4 Session 2 still works"
S2_CHECK=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$S2_R\"}")
assert_not_empty "$(echo "$S2_CHECK" | jq -r '.data.accessToken // empty')" "Session 2 still valid"

section "9.5 Logout all — fresh sessions"
# Fresh login
F1=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}" | jq -r '.data.refreshToken')
F2=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}" | jq -r '.data.refreshToken')
F3=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}")
F3_A=$(echo "$F3" | jq -r '.data.accessToken')
F3_R=$(echo "$F3" | jq -r '.data.refreshToken')

LO_ALL=$(curl -s -X POST "$BASE/auth/logout-all" \
  -H "Authorization: Bearer $F3_A")
REVOKED=$(echo "$LO_ALL" | jq -r '.data.revoked')
assert_eq "$(echo "$LO_ALL" | jq -r '.data.message // empty')" "Logged out from all devices" "Logout-all success"
show "Revoked sessions: $REVOKED"

section "9.6 All sessions invalid"
for token in "$F1" "$F2" "$F3_R"; do
  R=$(curl -s -X POST "$BASE/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$token\"}" | jq -r '.error.code // empty')
  if [ "$R" = "AUTH_REFRESH_TOKEN_REUSED" ]; then
    pass "Session revoked"
  else
    fail "Session still valid (got: $R)"
  fi
done

# ═══════════════════════════════════════════════════════════════
hr "⑩ CHANGE PASSWORD — POST /users/me/change-password"
# ═══════════════════════════════════════════════════════════════
section "10.1 Fresh login"
C_LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASS_2\"}")
C_TOKEN=$(echo "$C_LOGIN" | jq -r '.data.accessToken')
assert_not_empty "$C_TOKEN" "Token obtained"

section "10.2 Wrong current → PASSWORD_INCORRECT"
WRONG_CP=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"WrongPass999\",\"newPassword\":\"AnotherPass\"}")
assert_eq "$(echo "$WRONG_CP" | jq -r '.error.code // empty')" "PASSWORD_INCORRECT" "Wrong current rejected"

section "10.3 Same as old → PASSWORD_SAME_AS_OLD"
SAME_CP=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$NEW_PASS_2\",\"newPassword\":\"$NEW_PASS_2\"}")
assert_eq "$(echo "$SAME_CP" | jq -r '.error.code // empty')" "PASSWORD_SAME_AS_OLD" "Same password rejected"

section "10.4 Valid change"
OK_CP=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$NEW_PASS_2\",\"newPassword\":\"FinalPass789\"}")
assert_eq "$(echo "$OK_CP" | jq -r '.data.message // empty')" "Password changed successfully" "Password changed"

section "10.5 New password works"
FINAL_LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"FinalPass789\"}")
assert_eq "$(echo "$FINAL_LOGIN" | jq -r '.data.user.email // empty')" "$NEW_EMAIL" "New password works"

# ═══════════════════════════════════════════════════════════════
hr "🎬 SUMMARY"
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${G}  Endpoints tested:${N}"
echo "  → POST /auth/register"
echo "  → POST /auth/login"
echo "  → POST /auth/refresh"
echo "  → POST /auth/logout"
echo "  → POST /auth/logout-all"
echo "  → POST /auth/otp/request"
echo "  → POST /auth/otp/verify"
echo "  → POST /auth/forgot"
echo "  → POST /auth/reset"
echo "  → GET  /users/me"
echo "  → POST /users/me/change-password"
echo ""
echo -e "${Y}  Test user: $NEW_EMAIL${N}"
echo -e "${Y}  Final password: FinalPass789${N}"
echo ""
echo -e "${G}  ✅ Done — $(date '+%H:%M:%S')${N}"
echo ""
