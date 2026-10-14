#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1
G="\033[0;32m"; R="\033[0;31m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no() { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-17 Commit 1 — Verify (Unit Tests)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ① Setup files"
[ -f vitest.config.ts ] && ok "vitest.config.ts" || no "missing"
[ -f test/unit/password.service.test.ts ] && ok "password test" || no "missing"
[ -f test/unit/pagination.service.test.ts ] && ok "pagination test" || no "missing"

echo ""
echo "▶ ② Run unit tests"
if npx vitest run > /tmp/pj17-c1.log 2>&1; then
  ok "Unit tests pass"
  grep -E "Test Files|Tests " /tmp/pj17-c1.log | head -2 | sed 's/^/     /'
else
  no "Unit tests failed"
  tail -25 /tmp/pj17-c1.log
fi

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
