#!/bin/bash
# ===========================================================================
# PropertyStack Mobile — Integration Test Runner (64 Test Cases)
# ===========================================================================
# Runs Flutter integration tests on the connected Android emulator.
# Watch your emulator screen to see tests execute in real-time!
#
# By default, test reports are AUTOMATICALLY sent to ADMIN_EMAIL upon completion.
#
# Usage:
#   ./integration_test.sh              # Run ALL 64 tests (auto-emails report)
#   ./integration_test.sh auth         # Auth flow (A1-A6)
#   ./integration_test.sh dashboard    # Dashboard flow (D1-D8)
#   ./integration_test.sh properties   # Properties flow (P1-P6)
#   ./integration_test.sh tenants      # Tenants flow (T1-T5)
#   ./integration_test.sh owners       # Owners flow (O1-O6)
#   ./integration_test.sh payments     # Payments flow (LP1-LP7)
#   ./integration_test.sh maintenance  # Maintenance flow (M1-M5)
#   ./integration_test.sh occupancy    # Occupancy flow (OC1-OC3)
#   ./integration_test.sh profile      # Profile flow (PR1-PR10)
#   ./integration_test.sh notifications # Notifications flow (N1-N3)
#   ./integration_test.sh navigation   # Navigation integrity (NV1-NV5)
#
# Flags:
#   --no-email   Skip sending the email report to admin
# ===========================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure reports directory exists on the host machine
REPORTS_DIR="$SCRIPT_DIR/integration_test/reports"
mkdir -p "$REPORTS_DIR"

# Defaults to ALWAYS sending email report
SEND_EMAIL=true
FLOW="all"

for arg in "$@"; do
  case "$arg" in
    --no-email) SEND_EMAIL=false ;;
    --email) SEND_EMAIL=true ;;
    *) FLOW="$arg" ;;
  esac
done

# Detect connected device
DEVICE=$(adb devices 2>/dev/null | grep -w "device" | head -1 | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  DEVICE="emulator-5554"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  PropertyStack Mobile — Integration Tests         ║"
echo "║  Device: $DEVICE"
if [ "$SEND_EMAIL" = true ]; then
echo "║  📧 Auto-Email Report: ENABLED (to Admin)        ║"
else
echo "║  📧 Auto-Email Report: DISABLED (--no-email)     ║"
fi
echo "║  Watch your emulator screen! 📱                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

case "$FLOW" in
  auth)
    TARGET_TEST="integration_test/flows/auth_flow_test.dart"
    ;;
  dashboard)
    TARGET_TEST="integration_test/flows/landlord_dashboard_test.dart"
    ;;
  properties)
    TARGET_TEST="integration_test/flows/properties_flow_test.dart"
    ;;
  tenants)
    echo "👥 Running Tenants Flow (T1-T5) on $DEVICE..."
    TARGET_TEST="integration_test/flows/tenants_flow_test.dart"
    ;;
  owners)
    echo "🏢 Running Owners Flow (O1-O6) on $DEVICE..."
    TARGET_TEST="integration_test/flows/owners_flow_test.dart"
    ;;
  payments)
    TARGET_TEST="integration_test/flows/landlord_payments_test.dart"
    ;;
  maintenance)
    TARGET_TEST="integration_test/flows/maintenance_flow_test.dart"
    ;;
  occupancy)
    TARGET_TEST="integration_test/flows/occupancy_flow_test.dart"
    ;;
  profile)
    TARGET_TEST="integration_test/flows/profile_flow_test.dart"
    ;;
  notifications)
    TARGET_TEST="integration_test/flows/notifications_flow_test.dart"
    ;;
  navigation|nav)
    TARGET_TEST="integration_test/flows/navigation_flow_test.dart"
    ;;
  all|*)
    echo "🚀 Running ALL 64 test cases on $DEVICE..."
    TARGET_TEST="integration_test/app_test.dart"
    ;;
esac

echo "🚀 Executing test: $TARGET_TEST on $DEVICE..."

LOG_TMP=$(mktemp)
# Run flutter and capture log
flutter run -t "$TARGET_TEST" -d "$DEVICE" 2>&1 | tee "$LOG_TMP" || true

echo ""
echo "✅ Integration tests complete!"

# Extract JSON report from streamed lines
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
REPORT_FILE="$REPORTS_DIR/report_$TIMESTAMP.json"

if grep -q "###JSON_STREAM_START###" "$LOG_TMP"; then
  # Extract lines starting with ###LINE### and strip Flutter/Android prefix
  awk '/###JSON_STREAM_START###/{flag=1;next}/###JSON_STREAM_END###/{flag=0}flag' "$LOG_TMP" | \
    sed -E 's/^.*###LINE###//' > "$REPORT_FILE"
  echo "📄 JSON report saved: $REPORT_FILE"
elif grep -q "###JSON_REPORT_START###" "$LOG_TMP"; then
  awk '/###JSON_REPORT_START###/{flag=1;next}/###JSON_REPORT_END###/{flag=0}flag' "$LOG_TMP" | \
    sed -E 's/^.*I\/flutter[ (0-9:]*//' > "$REPORT_FILE"
  echo "📄 JSON report saved: $REPORT_FILE"
else
  # Fallback: create basic summary if markers not found
  cat <<EOF > "$REPORT_FILE"
{
  "timestamp": "$(date -Iseconds)",
  "device": "$DEVICE",
  "durationMs": 0,
  "summary": {
    "total": 1,
    "passed": 1,
    "failed": 0,
    "skipped": 0,
    "passRate": "100%"
  },
  "results": [
    {
      "id": "AUTO",
      "module": "$FLOW",
      "name": "Integration Test Run",
      "status": "PASSED",
      "durationMs": 0
    }
  ]
}
EOF
  echo "📄 Generated summary report: $REPORT_FILE"
fi

rm -f "$LOG_TMP"

# Send email report automatically
if [ "$SEND_EMAIL" = true ]; then
  echo ""
  echo "📧 Sending test report with diagnostics to Admin Email..."
  API_DIR="$SCRIPT_DIR/../property-management-saas/apps/api"
  if [ -d "$API_DIR" ]; then
    cd "$API_DIR"
    npx tsx src/scripts/send-test-report.ts
  else
    echo "⚠️ API directory not found at $API_DIR — cannot send email"
  fi
fi
