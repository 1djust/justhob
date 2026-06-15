# Development Guide

This document explains how to start and run the local development environment for the PropertyStack project.

## Prerequisites
- **WSL 2 (Ubuntu)**: All commands should be run within the WSL environment.
- **Node.js / npm**: For the web and backend services.
- **Flutter**: For the mobile tenant application.

---

## 1. Web Application & Backend (Monorepo)
The core platform (API and Web) is located in `property-management-saas/`.

### Starting the Dev Servers
You can use the shortcut script in the root directory:
```bash
bash wsl_start_dev.sh
```
Or manually:
```bash
cd ~/projects/justhub/property-management-saas
npm run dev
```
This starts the **Turbo dev server**, which handles:
- **API Backend**: Running on port 3001 (typically).
- **Web Frontend**: Running on port 3000 (typically).
- **Database Connection**: Ensure your database is accessible.

---

## 2. Tenant Mobile App (Flutter)
The mobile application is located in the `tenant_app/` directory.

### Running the App on Emulator

```bash
cd ~/projects/justhub/tenant_app
./run.sh
```
**What the script does:**
- Runs `flutter run` which will automatically detect and attach to your running Android emulator.

#### Simulating Fingerprint Authentication
When testing biometric login on the Android Emulator, the emulator acts as a fresh device with no fingerprints enrolled.
1. **Enroll a Fingerprint**: Inside the Emulator's Androi
d Settings app, go to Security -> Screen Lock (set a PIN) -> Fingerprint.
2. **Simulate Touch**: When prompted to touch the sensor by the OS or the Flutter app, use the emulator's Extended Controls (`...` menu) -> Fingerprint -> "Touch Sensor".
3. **Command Line Bypass**: Alternatively, you can instantly simulate a successful fingerprint touch from your terminal by running:
   ```bash
   adb -e emu finger touch 1
   ```

### Running on a Physical Android Device (USB)

> ⚠️ This requires a one-time WSL 2 setup. See the full guide:
> **[docs/ANDROID_PHYSICAL_DEVICE_TESTING.md](./docs/ANDROID_PHYSICAL_DEVICE_TESTING.md)**

**Quick Start (after one-time setup is complete):**

1. Start the Windows ADB server in **Windows PowerShell**:
   ```powershell
   $adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adbPath kill-server
   & $adbPath -a nodaemon server start
   ```
2. Plug in your phone via USB and tap **Allow** on the USB Debugging prompt.
3. In your **WSL 2 terminal**, run the app:
   ```bash
   cd tenant_app
   unset ADB_SERVER_SOCKET
   flutter run -d NBQGSKPJVC6DOZEI
   ```
4. **Watch your phone screen** and tap **Install** when the popup appears.

### Running on Linux Desktop (Fast Local Testing)
For quick UI iteration without a physical device:
```bash
cd tenant_app
flutter run -d linux
```
*Note: This runs as a desktop app inside WSL 2. Requires `dbus-run-session` and `gnome-keyring`.*

---

## Summary of Commands

| Component | Directory | Shortcut | Manual Command |
| :--- | :--- | :--- | :--- |
| **Web & API** | `property-management-saas/` | `bash wsl_start_dev.sh` | `npm run dev` |
| **Mobile App** | `tenant_app/` | `./run.sh` | `flutter run -d linux` |

---

## 3. Test Data Generation
We have provided helper scripts to generate fresh database scenarios or to quickly reset messy testing data. Run these from the `property-management-saas/` directory:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **Mega Test Scenario** | `npx tsx setup-mega-test.ts 30` | Generates a complex test scenario (change `30` to `90`, `60`, or `7` to simulate different lease expiration timelines). |
| **Reset Tenant Payments** | `npx tsx scripts/test-seeds/reset-tenant-payments.ts <email>` | Wipes all previous payments for the given tenant and creates exactly one clean **OVERDUE** invoice for UI and payment testing. Example: `npx tsx scripts/test-seeds/reset-tenant-payments.ts djokn@gmail.com` |

---

## 4. Super Admin Management
We have provided helper scripts to manage Super Admin accounts (God Mode privileges) on the platform. These scripts should be run from the `property-management-saas/apps/api/` directory:

| Action | Command | Description |
| :--- | :--- | :--- |
| **Create / Promote Super Admin** | `npx tsx src/promote-admin.ts <email_or_id> [password]` | Promotes an existing user, or creates a new Super Admin from scratch in both Supabase Auth and Prisma database. Password defaults to `Test1234!`. |
| **Permanently Delete User** | `npx tsx src/remove-user.ts <email_or_id>` | Permanently purges a user profile and credentials from both Supabase Auth and the Prisma database. |

### Examples:
* **Create a new Super Admin account**:
  ```bash
  cd property-management-saas/apps/api
  npx tsx src/promote-admin.ts admin@example.com MyPass123!
  ```
* **Permanently delete an admin or user account**:
  ```bash
  cd property-management-saas/apps/api
  npx tsx src/remove-user.ts admin@example.com
  ```

---

## 5. Troubleshooting
- **Port Conflicts**: If a port is already in use, you can find the process with `lsof -i :PORT_NUMBER`.
- **Flutter Keyring**: If `run.sh` fails, ensure `dbus-run-session` and `gnome-keyring` are installed in your WSL environment.
- **Database**: If the backend fails to start, verify your `.env` file in the `property-management-saas` folder.
- **Known Bugs & Fixes**: For a detailed log of past issues (e.g., Prisma IPv6 database connection timeouts) and their resolutions, please check the [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) file.
