#!/bin/bash
# Master test runner

DIR="$(dirname "$0")"
LOG_DIR="$DIR/logs"
mkdir -p "$LOG_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)

G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"
B="\033[0;34m"; N="\033[0m"

SCRIPTS=(
  "test-auth.sh"
  "test-users.sh"
  "test-roles.sh"
  "test-permissions.sh"
  "test-tickets.sh"
  "test-orders.sh"
  "test-payments.sh"
  "test-purchased-tickets.sh"
)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${B}║     ALL FEATURES — TEST RUNNER                             ║${N}"
echo -e "${B}║     Log: $LOG_DIR/run-$STAMP/             ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════════╝${N}"

LOG_DIR_RUN="$LOG_DIR/run-$STAMP"
mkdir -p "$LOG_DIR_RUN"

PASS_MODULES=0
FAIL_MODULES=0
FAILED_NAMES=()

for script in "${SCRIPTS[@]}"; do
  echo ""
  echo -e "${B}▶▶▶ $script${N}"

  LOG_FILE="$LOG_DIR_RUN/${script%.sh}.log"
  if bash "$DIR/$script" 2>&1 | tee "$LOG_FILE"; then
    PASS_MODULES=$((PASS_MODULES+1))
    echo -e "${G}✅ $script — PASS${N}"
  else
    FAIL_MODULES=$((FAIL_MODULES+1))
    FAILED_NAMES+=("$script")
    echo -e "${R}❌ $script — FAIL${N}"
  fi
done

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════════╗${N}"
echo -e "${B}║     SUMMARY                                                ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════════╝${N}"
echo -e "${G}  ✅ Modules passed: $PASS_MODULES${N}"
if [ $FAIL_MODULES -gt 0 ]; then
  echo -e "${R}  ❌ Modules failed: $FAIL_MODULES${N}"
  for m in "${FAILED_NAMES[@]}"; do
    echo -e "${R}     - $m${N}"
  done
fi
echo -e "${Y}  📁 Logs: $LOG_DIR_RUN${N}"
echo ""

if [ $FAIL_MODULES -gt 0 ]; then exit 1; fi
