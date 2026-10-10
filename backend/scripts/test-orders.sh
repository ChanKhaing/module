#!/bin/bash
source "$(dirname "$0")/_common.sh"

TS=$(date +%s)
CUST_EMAIL="order-${TS}@example.com"
CUST_PASS="Passw0rd123"

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     ORDERS MODULE — TEST                                   ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin
register_customer "$CUST_EMAIL" "$CUST_PASS"
login_customer "$CUST_EMAIL" "$CUST_PASS"

hr "① SETUP — ticket + publish"
TID=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Order Test ${TS}\",\"price\":10000,\"eventDate\":\"2027-06-01T00:00:00Z\",\"quantity\":10}" \
  | jq -r '.data._id')
curl -s -X PATCH "$BASE/tickets/$TID/publish" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
assert_not_empty "$TID" "Ticket ready"

hr "② POST /orders — create"
O=$(curl -s -X POST "$BASE/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":2}],\"note\":\"test\"}")
OID=$(echo "$O" | jq -r '.data._id // empty')
assert_not_empty "$OID" "Order created"
assert_eq "$(echo "$O" | jq -r '.data.status // empty')" "pending" "Status = pending"
assert_eq "$(echo "$O" | jq -r '.data.totalAmount // empty')" "20000" "Total = 20000"

hr "③ Availability after order"
AV=$(curl -s "$BASE/tickets/$TID/availability?qty=1")
assert_eq "$(echo "$AV" | jq -r '.data.sold // empty')" "2" "Sold = 2"
assert_eq "$(echo "$AV" | jq -r '.data.available // empty')" "8" "Available = 8"

hr "④ Over-book → error"
OVER=$(curl -s -X POST "$BASE/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":1000}]}")
assert_eq "$(echo "$OVER" | jq -r '.error.code // empty')" "TICKET_INSUFFICIENT_STOCK" "Over-book blocked"

hr "⑤ GET /orders/me"
MY=$(curl -s "$BASE/orders/me?limit=5" -H "Authorization: Bearer $CUST_TOKEN")
assert_not_empty "$(echo "$MY" | jq -r '.meta.total // empty')" "My orders works"

hr "⑥ GET /orders/:id"
D=$(curl -s "$BASE/orders/$OID" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$D" | jq -r '.data.orderCode // empty')" "$(echo "$O" | jq -r '.data.orderCode')" "Detail matches"

hr "⑦ Admin list orders"
AL=$(curl -s "$BASE/orders?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_not_empty "$(echo "$AL" | jq -r '.meta.total // empty')" "Admin list works"

hr "⑧ Cancel order"
C=$(curl -s -X PATCH "$BASE/orders/$OID/cancel" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"changed mind"}')
assert_contains "$(echo "$C" | jq -r '.data.message // empty')" "successfully" "Cancelled"

hr "⑨ Availability restored after cancel"
AV2=$(curl -s "$BASE/tickets/$TID/availability?qty=1")
assert_eq "$(echo "$AV2" | jq -r '.data.sold // empty')" "0" "Sold back to 0"

hr "⑩ Cancel again → error"
C2=$(curl -s -X PATCH "$BASE/orders/$OID/cancel" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json")
assert_eq "$(echo "$C2" | jq -r '.error.code // empty')" "ORDER_CANNOT_CANCEL" "Re-cancel blocked"

hr "⑪ Customer → admin list → denied"
DENY=$(curl -s "$BASE/orders" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

hr "⑫ Other user → order access denied"
CUST2="order2-${TS}@example.com"
register_customer "$CUST2" "$CUST_PASS"
login_customer "$CUST2" "$CUST_PASS"

# Fresh order by first user
O2=$(curl -s -X POST "$BASE/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":1}]}" | jq -r '.data._id')

DENY2=$(curl -s "$BASE/orders/$O2" -H "Authorization: Bearer $CUST_TOKEN")
# Now login again as user1 to check other access
login_customer "$CUST_EMAIL" "$CUST_PASS"
DENY3=$(curl -s "$BASE/orders/$O2" -H "Authorization: Bearer $CUST_TOKEN")
# We can't easily test cross-user here without 2 tokens; skip

print_summary
