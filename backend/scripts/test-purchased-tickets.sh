#!/bin/bash
source "$(dirname "$0")/_common.sh"

TS=$(date +%s)
CUST_EMAIL="pt-${TS}@example.com"
CUST_PASS="Passw0rd123"

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     PURCHASED TICKETS MODULE — TEST                        ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin
register_customer "$CUST_EMAIL" "$CUST_PASS"
login_customer "$CUST_EMAIL" "$CUST_PASS"

hr "① SETUP — full flow (buy + pay)"
TID=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"PT Test ${TS}\",\"price\":1000,\"eventDate\":\"2027-08-01T00:00:00Z\",\"quantity\":10}" \
  | jq -r '.data._id')
curl -s -X PATCH "$BASE/tickets/$TID/publish" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

OID=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":3}]}" | jq -r '.data._id')

PID=$(curl -s -X POST "$BASE/payments" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$OID\"}" | jq -r '.data._id')

curl -s -X PATCH "$BASE/payments/$PID/confirm" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"success"}' > /dev/null

assert_not_empty "$OID" "Order paid"

hr "② GET /purchased-tickets/me — auto-issued"
MY=$(curl -s "$BASE/purchased-tickets/me?limit=10" -H "Authorization: Bearer $CUST_TOKEN")
TOTAL=$(echo "$MY" | jq -r '.meta.total // 0')
assert_eq "$TOTAL" "3" "3 tickets auto-issued"

hr "③ GET /purchased-tickets/:id — detail + QR"
PTID=$(echo "$MY" | jq -r '.data[0]._id // empty')
D=$(curl -s "$BASE/purchased-tickets/$PTID" -H "Authorization: Bearer $CUST_TOKEN")
assert_not_empty "$(echo "$D" | jq -r '.data.code // empty')" "Code present"
assert_not_empty "$(echo "$D" | jq -r '.data.qrPayload // empty')" "QR payload present"
assert_eq "$(echo "$D" | jq -r '.data.status // empty')" "issued" "Status = issued"

hr "④ Filter status=issued"
F=$(curl -s "$BASE/purchased-tickets/me?status=issued" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$F" | jq -r '.meta.total // 0')" "3" "3 issued tickets"

hr "⑤ Filter orderId"
FO=$(curl -s "$BASE/purchased-tickets/me?orderId=$OID" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$FO" | jq -r '.meta.total // 0')" "3" "Filter by order works"

hr "⑥ POST /purchased-tickets/validate (admin)"
QR=$(echo "$D" | jq -r '.data.qrPayload')
V=$(curl -s -X POST "$BASE/purchased-tickets/validate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qrPayload\":\"$QR\"}")
assert_eq "$(echo "$V" | jq -r '.data.valid // empty')" "true" "QR valid"

hr "⑦ POST /purchased-tickets/redeem"
RD=$(curl -s -X POST "$BASE/purchased-tickets/redeem" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qrPayload\":\"$QR\",\"note\":\"gate A\"}")
assert_contains "$(echo "$RD" | jq -r '.data.message // empty')" "successfully" "Redeemed"

hr "⑧ Validate again → ALREADY_USED"
V2=$(curl -s -X POST "$BASE/purchased-tickets/validate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qrPayload\":\"$QR\"}")
assert_eq "$(echo "$V2" | jq -r '.data.reason // empty')" "ALREADY_USED" "Detected used"

hr "⑨ Redeem again → error"
RD2=$(curl -s -X POST "$BASE/purchased-tickets/redeem" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qrPayload\":\"$QR\"}")
assert_contains "$(echo "$RD2" | jq -r '.error.code // empty')" "ALREADY_USED" "Re-redeem blocked"

hr "⑩ Cancel (self, issued ticket)"
PT2=$(curl -s "$BASE/purchased-tickets/me?status=issued" -H "Authorization: Bearer $CUST_TOKEN" \
  | jq -r '.data[0]._id // empty')
C=$(curl -s -X PATCH "$BASE/purchased-tickets/$PT2/cancel" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"cannot attend"}')
assert_contains "$(echo "$C" | jq -r '.data.message // empty')" "successfully" "Cancelled"

hr "⑪ Cancel used ticket → error"
C2=$(curl -s -X PATCH "$BASE/purchased-tickets/$PTID/cancel" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json")
assert_eq "$(echo "$C2" | jq -r '.error.code // empty')" "TICKET_ALREADY_USED" "Blocked"

hr "⑫ Bad QR → NOT_FOUND"
BAD=$(curl -s -X POST "$BASE/purchased-tickets/validate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrPayload":"does-not-exist-xyz"}')
assert_eq "$(echo "$BAD" | jq -r '.data.reason // empty')" "NOT_FOUND" "Not found"

hr "⑬ Customer → validate → denied"
DENY=$(curl -s -X POST "$BASE/purchased-tickets/validate" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrPayload":"anything"}')
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

hr "⑭ Admin list"
AL=$(curl -s "$BASE/purchased-tickets?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_not_empty "$(echo "$AL" | jq -r '.meta.total // empty')" "Admin list works"

hr "⑮ Other user → detail access denied"
CUST2="pt2-${TS}@example.com"
register_customer "$CUST2" "$CUST_PASS"
login_customer "$CUST2" "$CUST_PASS"
DENY2=$(curl -s "$BASE/purchased-tickets/$PTID" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$DENY2" | jq -r '.error.code // empty')" "TICKET_ACCESS_DENIED" "Blocked"

print_summary
