#!/usr/bin/env bash
# ==============================================================================
# PropertyStack Environment & Secrets Security Validator
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛡️  [PropertyStack Shield] Validating Environment & Secrets Security..."

ERRORS=0

# 1. Verify that no live .env file is tracked in git
TRACKED_ENVS=$(git -C "$ROOT_DIR" ls-files "*.env" "*/**/.env" 2>/dev/null || true)
if [ -n "$TRACKED_ENVS" ]; then
  echo "❌ [SECURITY ERROR] Tracked .env files found in git index:"
  echo "$TRACKED_ENVS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No active .env files tracked in version control."
fi

# 2. Check for presence of required environment templates
if [ ! -f "$ROOT_DIR/property-management-saas/apps/api/.env" ] && [ ! -f "$ROOT_DIR/property-management-saas/apps/api/.env.example" ]; then
  echo "⚠️  [WARNING] Missing .env or .env.example template for API backend."
else
  echo "✅ API environment template verified."
fi

# 3. Check for security guide existence
if [ -f "$ROOT_DIR/docs/SECURITY_OPERATIONS_AND_SECRETS_GUIDE.md" ]; then
  echo "✅ Master Security Operations & Key Rotation Guide present."
else
  echo "❌ [ERROR] Missing docs/SECURITY_OPERATIONS_AND_SECRETS_GUIDE.md"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "❌ Environment security verification failed with $ERRORS error(s)."
  exit 1
fi

echo "✅ All Environment & Secrets Security checks passed successfully."
exit 0
