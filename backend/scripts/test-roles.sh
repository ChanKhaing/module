#!/bin/bash
source "$(dirname "$0")/_common.sh"

TS=$(date +%s)

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     ROLES MODULE — TEST                                    ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin

hr "① GET /roles — list"
L=$(curl -s "$BASE/roles?limit=10" -H "Authorization: Bearer $ADMIN_TOKEN")
TOTAL=$(echo "$L" | jq -r '.meta.total // 0')
assert_not_empty "$TOTAL" "Total returned"
info "Total roles: $TOTAL"

hr "② GET /roles/:id — customer role"
CID=$(echo "$L" | jq -r '.data[] | select(.name=="customer") | ._id // empty')
D=$(curl -s "$BASE/roles/$CID" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$D" | jq -r '.data.name // empty')" "customer" "Detail matches"
PERM_COUNT=$(echo "$D" | jq -r '.data.permissions | length')
assert_not_empty "$PERM_COUNT" "Permissions populated ($PERM_COUNT)"

hr "③ POST /roles — duplicate"
DUP=$(curl -s -X POST "$BASE/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"customer","description":"Duplicate"}')
assert_contains "$(echo "$DUP" | jq -r '.error.code // empty')" "CONFLICT" "Duplicate blocked"

hr "④ POST /roles — invalid name"
BAD=$(curl -s -X POST "$BASE/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"superuser","description":"Invalid"}')
assert_eq "$(echo "$BAD" | jq -r '.error.code // empty')" "BAD_REQUEST" "Invalid name rejected"

hr "⑤ PATCH /roles/:id — update"
U=$(curl -s -X PATCH "$BASE/roles/$CID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated customer description"}')
assert_eq "$(echo "$U" | jq -r '.data.description // empty')" "Updated customer description" "Updated"

hr "⑥ DELETE /roles/:id — system protected"
DEL=$(curl -s -X DELETE "$BASE/roles/$CID" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$DEL" | jq -r '.error.code // empty')" "ROLE_SYSTEM_PROTECTED" "Protected"

hr "⑦ POST /roles/:id/permissions — assign"
PID1=$(curl -s "$BASE/permissions?limit=100" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -r '.data[] | select(.code=="ticket:read") | ._id // empty')
PID2=$(curl -s "$BASE/permissions?limit=100" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -r '.data[] | select(.code=="order:read") | ._id // empty')

A=$(curl -s -X POST "$BASE/roles/$CID/permissions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"permissionIds\":[\"$PID1\",\"$PID2\"]}")
NEW_PERM=$(echo "$A" | jq -r '.data.permissions | length')
assert_eq "$NEW_PERM" "2" "Permissions updated to 2"

info "⚠️  Run 'npm run seed' to restore customer permissions"

hr "⑧ Customer access → denied"
login_customer "su-test@example.com" "$ADMIN_PASS"
DENY=$(curl -s "$BASE/roles" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

print_summary
