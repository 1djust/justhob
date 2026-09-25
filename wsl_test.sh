#!/bin/bash
# E2E Test runner script for PropertyStack
# Usage:
#   ./wsl_test.sh          # Run all tests
#   ./wsl_test.sh android  # Run Android emulator tests
#   ./wsl_test.sh ui       # Run interactive UI mode
#   ./wsl_test.sh report   # Show HTML report

export PATH="/home/djust/.local/share/fnm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
eval "$(fnm env --shell bash)" 2>/dev/null || true

cd ~/projects/justhub/property-management-saas/apps/web

case "$1" in
  headed|watch)
    echo "🌐 Launching live visual browser on screen (Android mobile profile)..."
    pnpm test:headed "${@:2}"
    ;;
  debug)
    echo "🔍 Launching Playwright Inspector with step-by-step debugger..."
    pnpm test:debug "${@:2}"
    ;;
  android|mobile-android)
    echo "Running Playwright Android Emulator profile..."
    pnpm test:android "${@:2}"
    ;;
  mobile)
    echo "Running Playwright Mobile profiles (Android + iPhone)..."
    pnpm test:mobile "${@:2}"
    ;;
  ui)
    echo "Opening Playwright interactive UI..."
    pnpm test:ui "${@:2}"
    ;;
  report)
    echo "Opening Playwright HTML report..."
    pnpm test:report
    ;;
  live)
    echo "Running live production tests..."
    pnpm test:live "${@:2}"
    ;;
  flutter|flutter-app|app)
    echo "📱 Running Flutter Mobile Integration Tests on Android Emulator..."
    cd /home/djust/projects/justhub/propertystack_mobile && ./integration_test.sh "${@:2}"
    ;;
  *)
    echo "Running Playwright E2E tests..."
    pnpm test "$@"
    ;;
esac
