# 🚀 Deployment Log & Rollback Registry

This log tracks production deployment history, build integrity checklist runs, and provides a quick reference for reverting to previous builds for both the Web application, the API backend, and the Flutter mobile app.

---

## 📌 Current Active Deployment Status

| Component | Target URL / Platform | Active Build / Version | Status |
| :--- | :--- | :--- | :--- |
| **API Backend** | `https://justhob.onrender.com` | Rotate Secrets & CI/CD scan commit | Active & Validated |
| **Frontend Web** | `https://propertystack.onrender.com` | Main branch deployment | Active & Validated |
| **Mobile Tenant App** | Android Release APK | Build v1.0.0-release | Active & Validated |

---

## ↩️ Rollback (Revamp) Procedures

In case of a critical bug or regression in a new release, follow these steps to instantly revert to the previous working build:

### 1. Web & API Backend (Render)
Render stores a complete history of all deployed builds. To revert without writing code:
1. Open the **Render Dashboard**.
2. Click on the target service (`justhob` for API, or `propertystack` for Web).
3. Navigate to the **Events** or **Deploys** tab in the sidebar.
4. Locate the last successful deploy entry prior to the current one.
5. Click the `...` menu next to it and select **"Rollback to this deploy"** (or click **"Redeploy"** on that specific build history card).
6. Render will instantly spin down the broken container and route traffic back to the chosen previous container image.

### 2. Mobile Tenant App (Flutter APK)
Because mobile updates require users to download or install the APK, rollback is handled by redistributing the previous release package:
1. Locate the backup or previous APK stored under the assets server path (`/downloads/estateos-tenant-vXXXX.apk`).
2. Update the version pointer in `property-management-saas/apps/web/public/downloads/version_temp.json` to reference the previous version's filename and download URL.
3. This forces the mobile app client to offer the working rollback version to tenants when they open the app.

---

## 📝 Deployment History Log

*Always document and append new deploys here.*

| Build # | Deployment Date | Branch / Commit Hash | Checklist Status | Operator | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#1** | June 29, 2026 | `main` (Initial) | ✅ All 8 Passed | Antigravity AI | Base application deployment setup. |
| **#2** | June 29, 2026 | Rotated secrets & CI/CD | ✅ All 8 Passed | Antigravity AI | Integrated secrets rotation script, added GitHub Actions workflow, and rotated live Render api keys. |
| **#3** | June 30, 2026 | Landlord Login Integration | ✅ All 6 Passed | Antigravity AI | Landlord role redirection, dashboard widgets, and 53 integration tests. |

---

### 🛡️ Pre-flight Checklist Reminder
Before incrementing the build number and deploying to live:
```bash
python3 .agent/scripts/checklist.py . --url https://propertystack.vercel.app
```
Confirm all 8 core and performance checks pass before updating the active deployment configuration.
