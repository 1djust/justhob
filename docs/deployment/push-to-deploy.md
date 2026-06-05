# Push to Deploy: Tenant App APK

This guide documents the complete process for deploying a new version of the Tenant App (EstateOS) APK to production via Vercel.

---

## Prerequisites

- Access to the [GitHub repository](https://github.com/1djust/justhob)
- WSL terminal with git configured
- The GitHub Actions build must have passed (green checkmark ✅)

---

## Step-by-Step Deployment

### Step 1: Verify the Build Passed

Go to **GitHub Actions**: https://github.com/1djust/justhob/actions

Confirm the latest build shows a **green checkmark** (✅). If it shows a red ❌, the build failed and must be fixed before deploying.

### Step 2: Download the APK Artifact

1. Click on the **successful build run** (e.g., `feat: show bank name instead of code v0.1.9+12`)
2. Scroll down to the **Artifacts** section at the bottom of the page
3. Click on **`tenant-app-release`** to download the `.zip` file
4. Extract the zip file — inside you'll find `app-release.apk`

### Step 3: Copy the APK to the Web Server Folder

Rename and copy the extracted APK to overwrite the existing one:

```bash
cp /mnt/c/Users/USER/Downloads/tenant-app-release/app-release.apk \
   ~/projects/justhub/property-management-saas/apps/web/public/downloads/propertystack-tenant.apk
```

> **Note:** Adjust the source path if the download location differs. The file **must** be named `propertystack-tenant.apk` to match the OTA download URL.

### Step 4: Commit and Push

```bash
cd ~/projects/justhub
git add property-management-saas/apps/web/public/downloads/propertystack-tenant.apk
git commit -m "feat: upload vX.Y.Z+N APK"
git push origin main
```

Replace `vX.Y.Z+N` with the actual version (e.g., `v0.1.9+12`).

### Step 5: Wait for Vercel Deployment

Vercel will automatically detect the push and deploy the new files. This typically takes **1–2 minutes**. You can monitor the deployment at https://vercel.com.

### Step 6: Verify on Device

1. Open the Tenant App on your phone
2. The app checks for updates on launch via the OTA mechanism
3. If the version in `version.json` is higher than the installed version, a mandatory update dialog will appear
4. The user taps "Update" and is directed to download the new APK

---

## How the OTA Update Mechanism Works

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  Tenant App     │     │  Vercel (Web Server)                 │
│  (on phone)     │     │                                      │
│                 │     │  /downloads/version.json             │
│  On app launch: │────▶│  /downloads/propertystack-tenant.apk       │
│  Fetch version  │     │                                      │
│  .json          │     └──────────────────────────────────────┘
│                 │
│  Compare:       │
│  Local build #  │
│  vs Remote      │
│  build #        │
│                 │
│  If remote >    │
│  local:         │
│  Show update    │
│  dialog         │
└─────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `tenant_app/pubspec.yaml` | App version (`version: X.Y.Z+N`) |
| `property-management-saas/apps/web/public/downloads/version.json` | OTA metadata (version, build number, download URL, release notes) |
| `property-management-saas/apps/web/public/downloads/propertystack-tenant.apk` | The actual APK binary served to users |
| `.github/workflows/build-apk.yml` | GitHub Actions workflow that builds the APK |

### version.json Format

```json
{
  "latestVersion": "0.1.9",
  "latestBuildNumber": 12,
  "isMandatory": true,
  "downloadUrl": "https://propertystack.vercel.app/downloads/propertystack-tenant.apk",
  "releaseNotes": "• Bank name displayed instead of code\n• Payment account details on Dashboard"
}
```

---

## Checklist for Each Release

- [ ] Code changes committed and pushed to `main`
- [ ] `pubspec.yaml` version bumped (e.g., `0.1.9+12`)
- [ ] `version.json` updated with matching version and build number
- [ ] GitHub Actions build passed ✅
- [ ] APK artifact downloaded and extracted
- [ ] APK copied to `public/downloads/propertystack-tenant.apk`
- [ ] Changes committed and pushed to deploy via Vercel
- [ ] Verified update prompt on device

---

## Common Issues

### "App not installed as package conflicts with an existing package"
**Cause:** The APK is signed with a different key than the version currently installed on the device (e.g., debug vs release build).
**Fix:** Uninstall the existing app from the phone first, then install the new APK. Future updates from the same signing key will work without uninstalling.

### Build fails with `Colors.emerald` or similar
**Cause:** Using CSS/Tailwind color names that don't exist in Flutter's Material palette.
**Fix:** Use standard Flutter colors like `Colors.teal`, `Colors.green`, `Colors.amber`, etc.

### Build fails with `withValues` or `WidgetStateProperty`
**Cause:** These are very new Flutter APIs (3.22+). The CI may use an older stable version.
**Fix:** Use `withOpacity()` instead of `withValues(alpha:)`, and `MaterialStateProperty` instead of `WidgetStateProperty`.

### GitHub Actions build not triggered
**Cause:** The workflow only triggers on pushes that modify files inside the `tenant_app/` directory.
**Fix:** Ensure at least one file inside `tenant_app/` was modified in the commit. If only `version.json` or non-tenant files changed, make a small change to `pubspec.yaml` (e.g., add a blank line).
