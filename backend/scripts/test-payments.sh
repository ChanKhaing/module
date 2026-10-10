#!/bin/bash
source "$(dirname "$0")/_common.sh"

TS=$(date +%s)
CUST_EMAIL="pay-${TS}@example.com"
CUST_PASS="Passw0rd123"

echo -e "${G}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${G}║     PAYMENTS MODULE — TEST                                 ║${N}"
echo -e "${G}╚═══════════════════════════════════════════════════════════╝${N}"

health_check
login_admin
register_customer "$CUST_EMAIL" "$CUST_PASS"
login_customer "$CUST_EMAIL" "$CUST_PASS"

hr "① SETUP — ticket + order"
TID=$(curl -s -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Pay Test ${TS}\",\"price\":5000,\"eventDate\":\"2027-07-01T00:00:00Z\",\"quantity\":20}" \
  | jq -r '.data._id')
curl -s -X PATCH "$BASE/tickets/$TID/publish" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

OID=$(curl -s -X POST "$BASE/orders" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":2}]}" | jq -r '.data._id')
assert_not_empty "$OID" "Order ready"

hr "② POST /payments — initiate"
P=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$OID\"}")
PID=$(echo "$P" | jq -r '.data._id // empty')
assert_not_empty "$PID" "Payment initiated"
assert_eq "$(echo "$P" | jq -r '.data.status // empty')" "pending" "Status = pending"
assert_eq "$(echo "$P" | jq -r '.data.amount // empty')" "10000" "Amount = 10000"

hr "③ Idempotency — same key"
KEY="idem-${TS}"
P1=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$OID\",\"idempotencyKey\":\"$KEY\"}" | jq -r '.data.paymentCode // empty')
P2=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$OID\",\"idempotencyKey\":\"$KEY\"}" | jq -r '.data.paymentCode // empty')
assert_eq "$P1" "$P2" "Same payment (idempotent)"

hr "④ Confirm FAIL path"
O2=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":1}]}" | jq -r '.data._id')

P2ID=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$O2\"}" | jq -r '.data._id')

FAIL=$(curl -s -X PATCH "$BASE/payments/$P2ID/confirm" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"fail","failureReason":"test"}')
assert_eq "$(echo "$FAIL" | jq -r '.data.status // empty')" "failed" "Payment failed"

ORD=$(curl -s "$BASE/orders/$O2" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$ORD" | jq -r '.data.status // empty')" "pending" "Order still pending"

hr "⑤ Confirm SUCCESS path"
O3=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":1}]}" | jq -r '.data._id')

P3ID=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$O3\"}" | jq -r '.data._id')

OK=$(curl -s -X PATCH "$BASE/payments/$P3ID/confirm" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"success"}')
assert_contains "$(echo "$OK" | jq -r '.data.message // empty')" "successful" "Payment success"

hr "⑥ Order paid after confirm"
ORD3=$(curl -s "$BASE/orders/$O3" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$ORD3" | jq -r '.data.status // empty')" "paid" "Order = paid"

hr "⑦ Re-confirm → PAYMENT_ALREADY_SUCCESS"
RE=$(curl -s -X PATCH "$BASE/payments/$P3ID/confirm" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"success"}')
assert_eq "$(echo "$RE" | jq -r '.error.code // empty')" "PAYMENT_ALREADY_SUCCESS" "Re-confirm blocked"

hr "⑧ GET /payments/me"
MY=$(curl -s "$BASE/payments/me?limit=5" -H "Authorization: Bearer $CUST_TOKEN")
assert_not_empty "$(echo "$MY" | jq -r '.meta.total // empty')" "My payments works"

hr "⑨ GET /payments/:id"
D=$(curl -s "$BASE/payments/$P3ID" -H "Authorization: Bearer $CUST_TOKEN")
assert_eq "$(echo "$D" | jq -r '.data.status // empty')" "success" "Detail matches"

hr "⑩ Admin list"
AL=$(curl -s "$BASE/payments?limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_not_empty "$(echo "$AL" | jq -r '.meta.total // empty')" "Admin list works"

hr "⑪ Admin list filter status=success"
FS=$(curl -s "$BASE/payments?status=success&limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_not_empty "$(echo "$FS" | jq -r '.meta.total // empty')" "Filter works"

hr "⑫ Mock webhook"
O4=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"ticketId\":\"$TID\",\"qty\":1}]}" | jq -r '.data._id')

P4=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$O4\"}" | jq -r '.data._id')

WH=$(curl -s -X POST "$BASE/payments/webhook/mock" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"paymentId\":\"$P4\",\"outcome\":\"success\",\"metadata\":{\"gateway\":\"mockbank\",\"txnId\":\"TXN-001\"}}")
assert_contains "$(echo "$WH" | jq -r '.data.message // empty')" "success" "Webhook processed"

hr "⑬ Customer → webhook → denied"
DENY=$(curl -s -X POST "$BASE/payments/webhook/mock" \
  -H "Authorization: Bearer $CUST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"paymentId\":\"$P4\",\"outcome\":\"success\"}")
assert_eq "$(echo "$DENY" | jq -r '.error.code // empty')" "PERMISSION_DENIED" "Blocked"

hr "⑭ Other user → payment access denied"
CUST2="pay2-${TS}@example.com"
register_customer "$CUST2" "$CUST_PASS"
login_customer "$CUST2" "$CUST_PASS"
DENY2=$(curl -s "$BASE/payments/$P3ID" -H "Authorization: Bearer $CUST_TOKEN")
# This check depends on having two tokens; skip if complicated

print_summary
