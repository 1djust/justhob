# Troubleshooting Log: Tenant App Build v0.1.8

## Issue 1: `LateInitializationError` in `UpdateService`
**Date**: April 27, 2026
**Problem**: The application crashed on startup because `UpdateService` had a circular dependency with `ApiClient`. `UpdateService` tried to use `ApiClient`, while `ApiClient` was being initialized, causing a `LateInitializationError`.
**Solution**: Refactored `UpdateService` to use a standalone `Dio` instance for checking updates. This decoupled it from the main `ApiClient` and fixed the startup crash.

## Issue 2: Build Failure in CI (Flutter Version Incompatibility)
**Date**: April 27, 2026
**Problem**: The GitHub Actions build failed because of the use of `withValues(alpha: ...)` and `WidgetStateProperty`. These are features from very recent Flutter versions (3.22+), and the CI environment was likely on a slightly older stable version.
**Solution**: 
- Replaced `withValues(alpha: ...)` with the legacy but stable `withOpacity(...)`.
- Replaced `WidgetStateProperty` with `MaterialStateProperty` in the theme.

## Issue 3: Build Failure (Non-existent Color Symbol)
**Date**: April 27, 2026
**Problem**: The build failed with a compile error because `Colors.emerald` was used in the UI code. While "emerald" exists in web CSS (Tailwind), it is not a part of the standard Flutter Material color palette.
**Solution**: Replaced `Colors.emerald` with `Colors.teal`, which is the correct Flutter equivalent for that hue.

## UI Improvements implemented in v0.1.8
- Added a **Rent Payment Account Card** directly to the Dashboard.
- Added a **Rent Expiry Countdown** (Days Left) badge.
- Added a clear indicator showing if rent should be paid to the **Landlord** or the **Manager**.
- Automated the **Landing Page** to fetch the latest version and download link dynamically from `version.json`.

---

# Troubleshooting Log: Tenant App v0.1.9

## Feature: Bank Name Display (Build 12)
**Date**: April 28, 2026
**Problem**: The dashboard showed the raw bank code (e.g., `033`) instead of the human-readable bank name.
**Solution**: Created `nigerian_banks.dart` utility that maps Nigerian CBN bank codes to bank names (e.g., `033` → `United Bank for Africa`). Updated both the Dashboard and Payments screens.

## Feature: Real-time Auto-Refresh (Build 13)
**Date**: April 28, 2026
**Problem**: Users had to manually refresh/pull-to-refresh to see updates on both the web app and mobile app.
**Solution**: 
- **Mobile App**: Added `StreamSubscription` listeners to `HomeNotifier`, `PaymentsNotifier`, and `MaintenanceNotifier` that listen to the `SocketService` event stream and auto-refresh data when `PAYMENT_UPDATED` or `MAINTENANCE_UPDATED` events arrive.
- **Web App**: Updated `RealtimeProvider.tsx` to listen for socket events and call `router.refresh()` with toast notifications.

## Feature: Fingerprint Login (Build 14)
**Date**: April 28, 2026
**Problem**: Users had to enter email/password every time they opened the app.
**Solution**: 
- Added `local_auth` package for biometric authentication.
- Created `BiometricService` to manage enable/disable and authentication prompts.
- Updated `MainActivity.kt` to use `FlutterFragmentActivity` (required by `local_auth`).
- Added `USE_BIOMETRIC` permission to `AndroidManifest.xml`.
- After first successful password login, the app prompts "Enable Fingerprint?". If enabled, subsequent app opens show a fingerprint icon and auto-prompt biometric authentication.

