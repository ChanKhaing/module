#!/bin/bash
source "$(dirname "$0")/_common.sh"

TS=$(date +%s)

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     TICKETS MODULE — TEST                                  ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin

hr "① POST /tickets — create (admin)"
CR=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Test Concert ${TS}\",
    \"description\":\"Live event\",
    \"price\":25000,
    \"eventDate\":\"2027-12-31T18:00:00Z\",
    \"quantity\":50,
    \"category\":\"music\",
    \"tags\":[\"live\",\"concert\"]
  }")
TID=$(echo "$CR" | jq -r '.data._id // empty')
assert_not_empty "$TID" "Ticket created"
assert_eq "$(echo "$CR" | jq -r '.data.status // empty')" "draft" "Default status = draft"

hr "② GET /tickets/:id — draft hidden"
DRAFT=$(curl -s "$BASE/tickets/$TID")
assert_eq "$(echo "$DRAFT" | jq -r '.error.code // empty')" "TICKET_NOT_FOUND" "Draft hidden from public"

hr "③ PATCH /tickets/:id/publish"
PUB=$(curl -s -X PATCH "$BASE/tickets/$TID/publish" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$PUB" | jq -r '.data.status // empty')" "published" "→ published"

hr "④ GET /tickets — public list"
L=$(curl -s "$BASE/tickets?limit=5")
assert_not_empty "$(echo "$L" | jq -r '.meta.total // empty')" "List works"

hr "⑤ GET /tickets/:id — public detail"
D=$(curl -s "$BASE/tickets/$TID")
assert_eq "$(echo "$D" | jq -r '.data.name // empty')" "Test Concert ${TS}" "Detail works"

hr "⑥ Search / filter"
Q=$(curl -s "$BASE/tickets?q=Test" | jq -r '.meta.total // 0')
assert_not_empty "$Q" "Search works (total: $Q)"

CAT=$(curl -s "$BASE/tickets?category=music" | jq -r '.meta.total // 0')
assert_not_empty "$CAT" "Category filter works (total: $CAT)"

PR=$(curl -s "$BASE/tickets?minPrice=10000&maxPrice=50000" | jq -r '.meta.total // 0')
assert_not_empty "$PR" "Price filter works (total: $PR)"

hr "⑦ GET /tickets/:id/availability"
AV=$(curl -s "$BASE/tickets/$TID/availability?qty=2")
assert_eq "$(echo "$AV" | jq -r '.data.canBook // empty')" "true" "Can book"
assert_eq "$(echo "$AV" | jq -r '.data.available // empty')" "50" "Available = 50"

hr "⑧ PATCH /tickets/:id — update"
U=$(curl -s -X PATCH "$BASE/tickets/$TID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Concert","tags":["updated"]}')
assert_eq "$(echo "$U" | jq -r '.data.name // empty')" "Updated Concert" "Updated"

hr "⑨ PATCH /tickets/:id/price"
P=$(curl -s -X PATCH "$BASE/tickets/$TID/price" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":30000}')
assert_eq "$(echo "$P" | jq -r '.data.price // empty')" "30000" "Price updated"

hr "⑩ PATCH /tickets/:id/unpublish"
UP=$(curl -s -X PATCH "$BASE/tickets/$TID/unpublish" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$UP" | jq -r '.data.status // empty')" "draft" "→ draft"

hr "⑪ PATCH /tickets/:id/cancel"
C=$(curl -s -X PATCH "$BASE/tickets/$TID/cancel" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_eq "$(echo "$C" | jq -r '.data.status // empty')" "cancelled" "→ cancelled"

hr "⑫ Customer creates ticket → denied"
CUST_EMAIL="ticket-test-${TS}@example.com"
register_customer "$CUST_EMAIL" "Passw0rd123"
login_customer "$CUST_EMAIL" "Passw0rd123"

DENY=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","price":100,"eventDate":"2027-01-01T00:00:00Z","quantity":1}')
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

hr "⑬ DELETE /tickets/:id"
DEL=$(curl -s -X DELETE "$BASE/tickets/$TID" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_contains "$(echo "$DEL" | jq -r '.data.message // empty')" "successfully" "Deleted"

print_summary
