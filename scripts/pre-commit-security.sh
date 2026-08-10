#!/usr/bin/env bash
# PropertyStack Pre-Commit Security Hook
# Prevents accidental commits of secrets, .env files, and private keys.

set -e

echo "🛡️  [PropertyStack Shield] Running local pre-commit security checks..."

# 1. Block staged .env files
STAGED_ENV_FILES=$(git diff --cached --name-only | grep -E "(^\.env|\.env\.local|\.env\.production)$" || true)
if [ -n "$STAGED_ENV_FILES" ]; then
  echo "❌ [SECURITY ERROR] Staged .env file detected:"
  echo "$STAGED_ENV_FILES"
  echo "Never commit real environment files with credentials. Remove from staging: git reset HEAD <file>"
  exit 1
fi

# 2. Inspect staged diffs for private keys and live secrets
FORBIDDEN_PATTERNS=(
  "-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----"
  "sk_live_[0-9a-zA-Z]{24,}"
  "supabase.*service_role.*key.*=.*[a-zA-Z0-9_\-]{80,}"
)

FAILED=0
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  MATCHES=$(git diff --cached -- ':!scripts/pre-commit-security.sh' ':!.gitleaks.toml' -S "$pattern" --name-only 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "❌ [SECURITY ERROR] Potential high-entropy secret or private key matching '$pattern' found in:"
    echo "$MATCHES"
    FAILED=1
  fi
done

if [ $FAILED -ne 0 ]; then
  echo "Commit blocked by PropertyStack Security Shield. Please unstage/sanitize sensitive credentials."
  exit 1
fi

echo "✅ [PropertyStack Shield] Pre-commit security verification passed."
exit 0
