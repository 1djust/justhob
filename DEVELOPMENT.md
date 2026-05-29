# Development Guide

This document explains how to start and run the local development environment for the Justhub project.

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

### Running the App Locally
The app is configured to run as a **Linux desktop application** for fast local development and testing in WSL.

```bash
cd justhub/tenant_app
./run.sh
```
**What the script does:**
- Unlocks the system keyring (required for Flutter secure storage on Linux).
- Runs `flutter run -d linux`.

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

## Troubleshooting
- **Port Conflicts**: If a port is already in use, you can find the process with `lsof -i :PORT_NUMBER`.
- **Flutter Keyring**: If `run.sh` fails, ensure `dbus-run-session` and `gnome-keyring` are installed in your WSL environment.
- **Database**: If the backend fails to start, verify your `.env` file in the `property-management-saas` folder.
- **Known Bugs & Fixes**: For a detailed log of past issues (e.g., Prisma IPv6 database connection timeouts) and their resolutions, please check the [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) file.
