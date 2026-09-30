# Development Guide

This document explains how to start and run the local development environment for the PropertyStack project. For tracking live deployments and rollback instructions, refer to the [RELEASE_LOG.md](./RELEASE_LOG.md) guide.

## Prerequisites
- **Windows (Native)**: All commands run natively on Windows in PowerShell, Command Prompt, or VS Code terminal.
- **Node.js / pnpm**: For the web and backend services.
- **Flutter SDK**: Located at `C:\src\flutter` (on PATH) for the mobile tenant application.

---

## 1. Web Application & Backend (Monorepo)
The core platform (API and Web) is located in `property-management-saas/`.

### Starting the Dev Servers
From the root workspace directory:
```powershell
pnpm --prefix property-management-saas dev
```
Or directly within the subfolder:
```powershell
cd property-management-saas
pnpm dev
```
This starts the **Turbo dev server**, which handles:
- **API Backend**: Running on `http://localhost:3002`.
- **Web Frontend**: Running on `http://localhost:3000`.
- **Database Connection**: Configured via Supabase pooler in `.env`.

---

## 2. Tenant Mobile App (Flutter)
The mobile application is located in the `propertystack_mobile/` directory.

### Running the App on Emulator

1. **Ensure the Android Emulator is Running**:
   Confirm your emulator (e.g. `emulator-5554`) is visible:
   ```powershell
   flutter devices
   ```

2. **Start Flutter Run (Interactive Dev Session with Hot Reload)**:
   ```powershell
   cd propertystack_mobile
   flutter run -d emulator-5554
   ```
   **Dev Controls while running**:
   - `r` : **Hot Reload** (instant sub-second UI updates without losing app state)
   - `R` : **Hot Restart** (re-initializes app state from scratch)
   - `h` : Repeat this help message
   - `d` : Open Flutter DevTools in browser
   - `q` : Quit dev session

3. **Instant App Launch (Without Rebuilding)**:
   If the app is already installed on the emulator and you just want to open it:
   ```powershell
   adb -s emulator-5554 shell am start -n com.propertystack.mobile/.MainActivity
   ```
   *(Or click the **PropertyStack** icon directly from the emulator app drawer).*

4. **Attach Hot-Reload to an Already-Running App**:
   To attach an interactive debugging session without waiting for a full build:
   ```powershell
   cd propertystack_mobile
   flutter attach -d emulator-5554
   ```

5. **Waking / Unlocking Emulator Screen**:
   If the emulator goes to sleep or stays on the ambient lock screen:
   ```powershell
   adb -s emulator-5554 shell wm dismiss-keyguard
   adb -s emulator-5554 shell input keyevent 82
   ```

#### Simulating Fingerprint Authentication
When testing biometric login on the Android Emulator, the emulator acts as a fresh device with no fingerprints enrolled.
1. **Enroll a Fingerprint**: Inside the Emulator's Android Settings app, go to Security -> Screen Lock (set a PIN) -> Fingerprint.
2. **Simulate Touch**: When prompted to touch the sensor by the OS or the Flutter app, use the emulator's Extended Controls (`...` menu) -> Fingerprint -> "Touch Sensor".
3. **Command Line Bypass**: Alternatively, you can instantly simulate a successful fingerprint touch from your terminal by running:
   ```bash
   adb -e emu finger touch 1
   ```

### Running on a Physical Android Device (USB)

1. Plug in your phone via USB and tap **Allow** on the USB Debugging prompt.
2. In your terminal, run:
   ```powershell
   cd propertystack_mobile
   flutter devices
   flutter run
   ```

### Running on Chrome / Web (Fast Local Testing)
For quick UI iteration without an emulator:
```powershell
cd propertystack_mobile
flutter run -d chrome
```

---

## Summary of Commands

| Component | Directory | Command |
| :--- | :--- | :--- |
| **Web & API** | Root or `property-management-saas/` | `pnpm --prefix property-management-saas dev` |
| **Mobile App** | `propertystack_mobile/` | `flutter run` |

---

## 3. Test Data Generation
We have provided helper scripts to generate fresh database scenarios or to quickly reset messy testing data. Run these from the `property-management-saas/` directory:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **Mega Test Scenario** | `npx tsx setup-mega-test.ts 30` | Generates a complex test scenario (change `30` to `90`, `60`, or `7` to simulate different lease expiration timelines). |
| **Reset Tenant Payments** | `npx tsx scripts/test-seeds/reset-tenant-payments.ts <email>` | Wipes all previous payments for the given tenant and creates exactly one clean **OVERDUE** invoice for UI and payment testing. Example: `npx tsx scripts/test-seeds/reset-tenant-payments.ts djokn@gmail.com` |
| **Reset Tenant Lease** | `npx tsx scratch/reset_tenant_lease.ts` | Deletes all leases for tenant Olawole John and sets the associated unit 'A1' status back to VACANT. |

---

## 4. Super Admin Management
We have provided helper scripts to manage Super Admin accounts (God Mode privileges) on the platform. These scripts should be run from the `property-management-saas/apps/api/` directory:

| Action | Command | Description |
| :--- | :--- | :--- |
| **Create / Promote Super Admin** | `npx tsx src/promote-admin.ts <email_or_id> [password]` | Promotes an existing user, or creates a new Super Admin from scratch in both Supabase Auth and Prisma database. Password defaults to `Test1234!`. |
| **Confirm User Email (Bypass Link)** | `npx tsx src/confirm-user.ts <email_or_uuid>` | Instantly marks a user's email as verified in Supabase Auth so they can log in without waiting for an email link. |
| **Reset User / Admin Password** | `npx tsx src/reset-password.ts <email_or_id> <new_password>` | Directly updates the password for any user or admin in Supabase Auth via Admin API. |
| **Permanently Delete User** | `npx tsx src/remove-user.ts <email_or_uuid>` | Permanently purges a user profile and credentials from both Supabase Auth and the Prisma database, automatically cleaning up foreign key relations (workspace memberships, notifications, property ownership links). |

### Examples:
* **Create a new Super Admin account**:
  ```bash
  cd property-management-saas/apps/api
  npx tsx src/promote-admin.ts admin@example.com MyPass123!
  ```
* **Manually verify / confirm a signed-up user**:
  ```bash
  cd property-management-saas/apps/api
  npx tsx src/confirm-user.ts manager@example.com
  ```
* **Reset password for an admin or user account**:
  ```bash
  cd property-management-saas/apps/api
  npx tsx src/reset-password.ts admin@example.com NewSecurePassword123!
  ```
* **Permanently delete an admin or user account via CLI**:
  ```bash
  cd property-management-saas/apps/api
  
  # Delete by Email:
  npx tsx src/remove-user.ts admin@example.com
  
  # Delete by User UUID:
  npx tsx src/remove-user.ts ef491076-790f-43ea-8616-182f34993f82
  ```
  *Note: The CLI command cleans up Supabase Auth credentials and runs an atomic transaction to prune referencing foreign keys (e.g. `WorkspaceMember`, `Notification`, `UpgradeRequest`) before removing the user from the database.*

### Email Verification Troubleshooting (Supabase Auth)
If newly registered managers or tenants do not receive verification emails:
1. **Supabase Built-in Mailer Rate Limits**: Supabase free projects have a default rate limit of 3-4 emails per hour and emails from `noreply@mail.app.supabase.io` may be caught in Spam folders.
2. **Instant CLI Verification for Testing**: Run `npx tsx src/confirm-user.ts <email>` to immediately verify the account.
3. **Auto-Confirm for Development**: In your Supabase Dashboard, go to **Authentication -> Providers -> Email** and turn **Confirm email** OFF if you want users to be instantly active upon registration during development.
4. **Custom SMTP for Production**: In your Supabase Dashboard, go to **Project Settings -> Authentication -> SMTP Settings** and configure your custom SMTP provider (e.g. Resend, SendGrid, Amazon SES, or Postmark).

---

## 4. Automated Testing (Playwright E2E & Vitest API)

### A. Web E2E Testing (Playwright)
Located in `property-management-saas/apps/web/`:

```bash
cd property-management-saas/apps/web

# Run all E2E tests across Desktop & Mobile
pnpm test

# Run Chromium only (fastest feedback loop)
pnpm test:chromium

# Run Android emulator profile (matches running emulator-5554)
pnpm test:android

# Interactive visual UI mode
pnpm test:ui

# View latest HTML test report
pnpm test:report

# Run live production smoke tests
pnpm test:live
```
For in-depth details on test fixtures, authentication caching, and writing tests, see **[apps/web/TESTING.md](file:///home/djust/projects/justhub/property-management-saas/apps/web/TESTING.md)**.

### B. API Unit & Integration Tests (Vitest)
Located in `property-management-saas/apps/api/`:
```bash
cd property-management-saas/apps/api
pnpm test
```

### C. Mobile Integration Testing (Flutter on Android Emulator)
Located in `propertystack_mobile/integration_test/`. These tests launch the **real app** on the Android emulator so you can **watch every tap, scroll, and navigation** live on screen.

#### Quick Start
```bash
cd ~/projects/justhub/propertystack_mobile

# Run ALL 64 test cases
./integration_test.sh

# Or run a specific flow
./integration_test.sh auth
```

#### Available Flows

| Flow | Command | Tests | What It Covers |
|:-----|:--------|:------|:---------------|
| **Auth** | `./integration_test.sh auth` | A1-A6 (6) | Login, invalid login, validation, password toggle, register nav |
| **Dashboard** | `./integration_test.sh dashboard` | D1-D8 (8) | Welcome banner, metrics grid, timeframe selector, bottom nav |
| **Properties** | `./integration_test.sh properties` | P1-P6 (6) | List, search, filters, detail, back nav, pull-to-refresh |
| **Tenants** | `./integration_test.sh tenants` | T1-T5 (5) | List, search, tap card, pull-to-refresh, create new tenant |
| **Owners** | `./integration_test.sh owners` | O1-O6 (6) | List via More, detail, back nav, add button, refresh, create new landlord |
| **Payments** | `./integration_test.sh payments` | LP1-LP7 (7) | List, status badges, review screen, tabs, back nav, refresh |
| **Maintenance** | `./integration_test.sh maintenance` | M1-M5 (5) | List via More, status badges, detail/chat, back nav, refresh |
| **Occupancy** | `./integration_test.sh occupancy` | OC1-OC3 (3) | Screen load, data display, back nav |
| **Profile** | `./integration_test.sh profile` | PR1-PR10 (10) | All settings (notifications, privacy, help, password, appearance, language, currency, version, logout) |
| **Notifications** | `./integration_test.sh notifications` | N1-N3 (3) | Screen load, cards, back nav |
| **Navigation** | `./integration_test.sh navigation` | NV1-NV5 (5) | Deep links, tab preservation, all bottom nav, More sub-items, profile accessibility |

#### Test Reports
After each run, a **JSON report** is saved to `propertystack_mobile/integration_test/reports/` with timestamps, pass/fail counts, and per-module breakdowns. A summary is also printed to the terminal:

```
╔══════════════════════════════════════════════════╗
║  PropertyStack — Test Report                      ║
║  ✅ PASSED: 58 / 62                               ║
║  ❌ FAILED: 3                                      ║
║  ⚠️  SKIPPED: 1                                    ║
╚══════════════════════════════════════════════════╝
```

#### Email Reports to Admin (Automatic by Default)
Every test execution automatically sends the diagnostic HTML report to `ADMIN_EMAIL` (`propertystackapp@gmail.com`) upon completion:
```bash
# Runs tests and automatically emails the full diagnostic report
./integration_test.sh auth
./integration_test.sh tenants
./integration_test.sh                  # all 62 tests + auto-email

# To skip sending email:
./integration_test.sh auth --no-email

# Or send the latest report manually without re-running tests:
cd property-management-saas/apps/api
npx tsx src/scripts/send-test-report.ts
```
The email is sent through the official mailer chain (Brevo → Resend → SMTP) with pass rates, module breakdowns, failure diagnostics, location traces, and actionable remediation steps.

#### Prerequisites
- **Android Emulator running** (API 34+, typically `emulator-5554`)
- **Backend API server running** (`pnpm --prefix property-management-saas dev`)
- **Flutter SDK** installed and on PATH (`C:\src\flutter`)

#### Troubleshooting
- **`pumpAndSettle` hangs**: All tests use `pump()` loops instead of `pumpAndSettle()` because the app has always-running services (SocketService, UpdateService). This is handled automatically.
- **`FlutterError.onError` crash**: The test helpers save and restore the error handler around `app.main()` to prevent conflicts with the app's global error boundary.

For full architecture details, see **[propertystack_mobile/integration_test/README.md](./propertystack_mobile/integration_test/README.md)**.

---

## 5. Production Readiness & Pre-deployment Checklist
Before deploying the application to production, you should run the master checklist script to verify security, linting, database schema integrity, tests, SEO, and performance:

* **Core Checks** (Security, Lint, Schema, Tests, UX, SEO):
  ```powershell
  python .agent/scripts/checklist.py .
  ```
* **Full Production Checks** (Including Performance Lighthouse & Playwright E2E audits):
  ```powershell
  python .agent/scripts/checklist.py . --url https://propertystack.vercel.app
  ```

---

## 6. Troubleshooting
- **Port Conflicts & "Failed to Fetch" Errors**: If port 3000 or 3002 is occupied by a dangling process:
  ```powershell
  # Check ports in PowerShell
  Get-NetTCPConnection -LocalPort 3000,3002 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
  # Kill dangling node/tsx processes
  Get-NetTCPConnection -LocalPort 3000,3002 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  # Restart dev environment
  pnpm --prefix property-management-saas dev
  ```
- **Database**: If the backend fails to start, verify your `.env` file in the `property-management-saas` folder.
- **Scratch Scripts / Prisma Resolution**: If executing Node.js scratch scripts throws `Cannot find module '@prisma/client'`, ensure you are executing them from the `property-management-saas` directory using `npx tsx scratch/<script>.ts`. Running raw `.js` scripts from directories outside the workspace blocks Node's resolution path.
- **Android / Flutter Build & Emulator Issues**:
  - **Gradle Transform Cache Corruption** (`Could not read workspace metadata from ...\transforms\...\metadata.bin`):
    Stop running daemons and purge the cached transform:
    ```powershell
    Stop-Process -Name java -Force -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches\8.14\transforms"
    ```
  - **Java 21 SSL Handshake with `download.flutter.io`** (`No subject alternative DNS name matching download.flutter.io found` or hanging GCS transfers):
    Gradle repositories in `android/settings.gradle.kts` and `android/build.gradle.kts` are pre-configured to use the official mirror:
    `maven("https://storage.flutter-io.cn/download.flutter.io")`
  - **Emulator Shows Offline or `adb install` Hangs**:
    Windows ADB daemon occasionally deadlocks when stale logcat background clients remain open. Cycle the ADB server:
    ```powershell
    Stop-Process -Name adb -Force -ErrorAction SilentlyContinue
    adb start-server
    adb devices
    ```
  - **Fast APK Push Bypass**:
    If `adb install` takes too long to stream the debug APK directly, push and install via the local emulator shell:
    ```powershell
    adb -s emulator-5554 push build\app\outputs\flutter-apk\app-debug.apk /data/local/tmp/app.apk
    adb -s emulator-5554 shell pm install -r -d /data/local/tmp/app.apk
    ```
- **Known Bugs & Fixes**: For a detailed log of past issues (e.g., Prisma IPv6 database connection timeouts, Android engine mirrors) and their resolutions, please check the [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) file.

---

## 7. Super Admin Security Incident Response & Log Operations
The Super Admin dashboard provides real-time oversight over system crashes, unauthorized access attempts, and property manager audit trails.

### A. How to Act on System & Security Telemetry
1. **System Errors (`Errors` Tab)**:
   - Contains unhandled API exceptions and performance warnings (`>3000ms`).
   - All sensitive data (passwords, JWTs, connection strings) is automatically scrubbed (`[REDACTED]`).
   - Click **Show Details** and **Copy Log** to send exact stack traces to developers for hotfixes.
2. **Security Telemetry (`Security & MFA` Tab)**:
   - Tracks `UNAUTHORIZED_API_ACCESS`, `FAILED_LOGIN`, and `RATE_LIMIT_EXCEEDED` events.
   - **Automated Alerts**: Triggers an alert email to `ADMIN_EMAIL` if an IP address generates 10 failures in 5 minutes.
3. **Manager Audit Trail (`Manager Audit Trail` Tab)**:
   - Full legal traceability for property manager operations (creations, lease approvals, bank payout edits). Use the search bar to resolve landlord/tenant disputes.

### B. Blocking Malicious IP Addresses
- **Cloudflare / Hosting WAF (Production)**: Copy the malicious IP address from the security feed $\rightarrow$ Cloudflare / Hosting Security Dashboard $\rightarrow$ WAF $\rightarrow$ Create Custom Rule $\rightarrow$ Set Action to **Block**.
- **Linux / VPS Firewall**: Block directly via terminal:
  ```bash
  sudo ufw deny from <MALICIOUS_IP> to any
  ```

### C. Securing Compromised Manager Accounts
1. Search for the manager's email under **Users Management**.
2. Verify if Multi-Factor Authentication (2FA) is enabled on their profile.
3. Temporarily click **Deactivate** or trigger a password reset if credentials are compromised.

