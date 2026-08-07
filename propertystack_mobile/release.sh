#!/bin/bash
# ============================================================
# PropertyStack Mobile — Production Release Builder
# ============================================================
# This script ensures every release APK is:
#   1. Built with split-per-ABI (arm64-only, ~25MB instead of ~67MB)
#   2. Automatically copied to the web app's public downloads folder
#   3. Version bumped in version.json
#   4. Ready to commit & push
#
# Usage:
#   ./release.sh              # Build & deploy to landing page
#   ./release.sh --skip-copy  # Build only, don't copy to web app
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DOWNLOADS="$SCRIPT_DIR/../property-management-saas/apps/web/public/downloads"
APK_OUTPUT="$SCRIPT_DIR/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
AAB_OUTPUT="$SCRIPT_DIR/build/app/outputs/bundle/release/app-release.aab"
MAX_APK_SIZE_MB=35

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  PropertyStack Mobile — Production Release Build ${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

# ----------------------------------------------------------
# Step 1: Extract version from pubspec.yaml
# ----------------------------------------------------------
VERSION=$(grep '^version:' "$SCRIPT_DIR/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f1)
BUILD_NUMBER=$(grep '^version:' "$SCRIPT_DIR/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f2)
echo -e "${GREEN}📦 Version: $VERSION (Build $BUILD_NUMBER)${NC}"

# ----------------------------------------------------------
# Step 2: Run flutter analyze
# ----------------------------------------------------------
echo -e "\n${YELLOW}🔍 Running flutter analyze...${NC}"
cd "$SCRIPT_DIR"
flutter analyze --no-fatal-infos
echo -e "${GREEN}✅ Analysis passed${NC}"

# ----------------------------------------------------------
# Step 3: Build split-per-ABI APK (arm64 only)
# ----------------------------------------------------------
echo -e "\n${YELLOW}🔨 Building arm64-only release APK...${NC}"
flutter build apk --release --split-per-abi --target-platform android-arm64
echo -e "${GREEN}✅ APK built successfully${NC}"

# ----------------------------------------------------------
# Step 4: Build App Bundle for Google Play Store
# ----------------------------------------------------------
echo -e "\n${YELLOW}🔨 Building App Bundle (.aab) for Google Play...${NC}"
flutter build appbundle --release
echo -e "${GREEN}✅ AAB built successfully${NC}"

# ----------------------------------------------------------
# Step 5: Size guard — reject if APK exceeds threshold
# ----------------------------------------------------------
if [ -f "$APK_OUTPUT" ]; then
    APK_SIZE_BYTES=$(stat -c%s "$APK_OUTPUT" 2>/dev/null || stat -f%z "$APK_OUTPUT" 2>/dev/null)
    APK_SIZE_MB=$((APK_SIZE_BYTES / 1048576))
    echo -e "\n${CYAN}📏 APK Size: ${APK_SIZE_MB}MB (max allowed: ${MAX_APK_SIZE_MB}MB)${NC}"

    if [ "$APK_SIZE_MB" -gt "$MAX_APK_SIZE_MB" ]; then
        echo -e "${RED}❌ BLOCKED: APK size ${APK_SIZE_MB}MB exceeds ${MAX_APK_SIZE_MB}MB limit!${NC}"
        echo -e "${RED}   Check for large unused assets or missing --split-per-abi flag.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Size check passed${NC}"
else
    echo -e "${RED}❌ APK not found at $APK_OUTPUT${NC}"
    exit 1
fi

# ----------------------------------------------------------
# Step 6: Copy to web app public downloads (unless --skip-copy)
# ----------------------------------------------------------
if [[ "${1:-}" != "--skip-copy" ]]; then
    if [ -d "$WEB_DOWNLOADS" ]; then
        echo -e "\n${YELLOW}📲 Deploying APK to landing page downloads...${NC}"
        cp "$APK_OUTPUT" "$WEB_DOWNLOADS/propertystack-tenant.apk"

        # Update version.json
        cat > "$WEB_DOWNLOADS/version.json" <<EOF
{
  "latestVersion": "$VERSION",
  "latestBuildNumber": $BUILD_NUMBER,
  "isMandatory": true,
  "downloadUrl": "/downloads/propertystack-tenant.apk",
  "releaseNotes": "Production release v$VERSION"
}
EOF
        echo -e "${GREEN}✅ APK and version.json deployed to landing page${NC}"
    else
        echo -e "${YELLOW}⚠️  Web downloads directory not found. Skipping copy.${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping copy to web app (--skip-copy flag)${NC}"
fi

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo -e "\n${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Release build complete!${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "  APK:  $APK_OUTPUT (${APK_SIZE_MB}MB)"
[ -f "$AAB_OUTPUT" ] && echo -e "  AAB:  $AAB_OUTPUT"
echo -e "  Ver:  $VERSION (Build $BUILD_NUMBER)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. git add -f property-management-saas/apps/web/public/downloads/propertystack-tenant.apk"
echo -e "  2. git add property-management-saas/apps/web/public/downloads/version.json"
echo -e "  3. git commit -m \"release: v$VERSION mobile APK\""
echo -e "  4. git push origin main"
echo ""
