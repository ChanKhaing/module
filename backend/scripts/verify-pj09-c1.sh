#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-09 Commit 1 — Verify${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ① Files"
for f in \
  src/support/schemas/support-ticket.schema.ts \
  src/support/schemas/support-message.schema.ts \
  src/support/schemas/index.ts \
  src/support/dto/create-support-ticket.dto.ts \
  src/support/dto/reply-support.dto.ts \
  src/support/dto/update-status.dto.ts \
  src/support/dto/update-priority.dto.ts \
  src/support/dto/assign-agent.dto.ts \
  src/support/dto/query-support.dto.ts \
  src/support/dto/index.ts
do
  [ -f "$f" ] && ok "$f" || no "Missing: $f"
done

echo ""
echo "▶ ② Schema — enum exports"
grep -q "export enum SupportStatus" src/support/schemas/support-ticket.schema.ts \
  && ok "SupportStatus enum" || no "SupportStatus enum missing"
grep -q "export enum SupportPriority" src/support/schemas/support-ticket.schema.ts \
  && ok "SupportPriority enum" || no "SupportPriority enum missing"
grep -q "export enum SupportCategory" src/support/schemas/support-ticket.schema.ts \
  && ok "SupportCategory enum" || no "SupportCategory enum missing"
grep -q "export enum SenderRole" src/support/schemas/support-message.schema.ts \
  && ok "SenderRole enum" || no "SenderRole enum missing"

echo ""
echo "▶ ③ Indexes registered"
grep -q "support_tickets" src/support/schemas/support-ticket.schema.ts \
  && ok "collection: support_tickets" || no "collection name missing"
grep -q "support_messages" src/support/schemas/support-message.schema.ts \
  && ok "collection: support_messages" || no "collection name missing"

echo ""
echo "▶ ④ Build"
if npm run build > /tmp/pj09-c1-build.log 2>&1; then
  ok "Build passes"
else
  no "Build failed"
  tail -20 /tmp/pj09-c1-build.log
fi

echo ""
echo "▶ ⑤ Server starts"
pkill -f "nest start" 2>/dev/null; sleep 2
timeout 20 npm run start:dev > /tmp/pj09-c1-server.log 2>&1 &
sleep 12

if grep -q "Nest application successfully started" /tmp/pj09-c1-server.log; then
  ok "Server starts"
else
  no "Server failed"
  tail -20 /tmp/pj09-c1-server.log
fi

if grep -qE "Nest can't resolve|Cannot find module" /tmp/pj09-c1-server.log; then
  no "Dependency error"
  grep -E "Nest can't resolve|Cannot find module" /tmp/pj09-c1-server.log | head -3
else
  ok "No dependency errors"
fi

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"

[ $FAIL -gt 0 ] && exit 1 || exit 0
