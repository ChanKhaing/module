#!/bin/bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

TS=$(date +%s)
NEW_EMAIL="user-${TS}@example.com"
NEW_PASS="Passw0rd123"
UPD_PASS="UpdatedPass456"

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     USERS MODULE — TEST                                    ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin
register_customer "$NEW_EMAIL" "$NEW_PASS"
login_customer "$NEW_EMAIL" "$NEW_PASS"

hr "① GET /users/me — profile"
ME=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$ME" | jq -r '.data.email // empty')" "$NEW_EMAIL" "Email matches"
assert_eq "$(echo "$ME" | jq -r '.data.passwordHash // "none"')" "none" "No password leaked"
assert_eq "$(echo "$ME" | jq -r '.data.role.name // empty')" "customer" "Role populated"

hr "② PATCH /users/me — update profile"
UP=$(curl -s -X PATCH "$BASE/users/me" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Updated Name"}')
assert_eq "$(echo "$UP" | jq -r '.data.fullName // empty')" "Updated Name" "fullName updated"

hr "③ POST /users/me/change-password"
section "3.1 Wrong current → error"
W=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Wrong999","newPassword":"Whatever123"}')
assert_eq "$(echo "$W" | jq -r '.error.code // empty')" "PASSWORD_INCORRECT" "Wrong current rejected"

section "3.2 Same as old → error"
S=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$NEW_PASS\",\"newPassword\":\"$NEW_PASS\"}")
assert_eq "$(echo "$S" | jq -r '.error.code // empty')" "PASSWORD_SAME_AS_OLD" "Same rejected"

section "3.3 Valid change"
OK=$(curl -s -X POST "$BASE/users/me/change-password" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$NEW_PASS\",\"newPassword\":\"$UPD_PASS\"}")
assert_eq "$(echo "$OK" | jq -r '.data.message // empty')" "Password changed successfully" "Changed"

section "3.4 New password login"
NL=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$UPD_PASS\"}")
assert_eq "$(echo "$NL" | jq -r '.data.user.email // empty')" "$NEW_EMAIL" "New password works"

hr "④ ADMIN — GET /users (list)"
L=$(curl -s "$BASE/users?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_not_empty "$(echo "$L" | jq -r '.meta.total // empty')" "Total returned"

hr "⑤ ADMIN — GET /users/:id"
USER_ID=$(echo "$L" | jq -r '.data[0]._id // empty')
D=$(curl -s "$BASE/users/$USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$D" | jq -r '.data._id // empty')" "$USER_ID" "Detail matches"

hr "⑥ ADMIN — PATCH /users/:id/status"
S1=$(curl -s -X PATCH "$BASE/users/$USER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive"}')
assert_eq "$(echo "$S1" | jq -r '.data.status // empty')" "inactive" "→ inactive"

S2=$(curl -s -X PATCH "$BASE/users/$USER_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}')
assert_eq "$(echo "$S2" | jq -r '.data.status // empty')" "active" "→ active"

hr "⑦ ADMIN — PATCH /users/:id/role"
RID=$(curl -s "$BASE/roles" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -r '.data[] | select(.name=="agent") | ._id // empty')
R=$(curl -s -X PATCH "$BASE/users/$USER_ID/role" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"roleId\":\"$RID\"}")
assert_eq "$(echo "$R" | jq -r '.data.role.name // empty')" "agent" "→ agent"

hr "⑧ ADMIN — DELETE /users/:id (soft)"
DEL_EMAIL="delete-${TS}@example.com"
register_customer "$DEL_EMAIL" "Passw0rd123"
DEL_ID=$(curl -s "$BASE/users?limit=100" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -r ".data[] | select(.email==\"$DEL_EMAIL\") | ._id // empty")
DEL=$(curl -s -X DELETE "$BASE/users/$DEL_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_contains "$(echo "$DEL" | jq -r '.data.message // empty')" "successfully" "Deleted"

hr "⑨ Customer access admin route → denied"
DENY=$(curl -s "$BASE/users" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

print_summary
