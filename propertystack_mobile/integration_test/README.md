# PropertyStack Mobile — Integration Test Suite

## Overview

This directory contains **62 integration test cases** across **11 feature modules** that run on a real Android emulator. Unlike unit tests, these tests launch the actual app, interact with the UI (typing, tapping, scrolling), and verify that screens load, navigate correctly, and display the right data.

**You can watch every test execute live on the emulator screen.**

---

## Architecture

```
integration_test/
├── app_test.dart                    # Master runner — imports all 11 flows
├── helpers/
│   ├── test_helpers.dart            # Shared utilities (login, navigation, pump loops)
│   └── test_reporter.dart           # JSON + terminal report generator
├── flows/
│   ├── auth_flow_test.dart          # A1-A6   (6 tests)
│   ├── landlord_dashboard_test.dart # D1-D8   (8 tests)
│   ├── properties_flow_test.dart    # P1-P6   (6 tests)
│   ├── tenants_flow_test.dart       # T1-T4   (4 tests)
│   ├── owners_flow_test.dart        # O1-O5   (5 tests)
│   ├── landlord_payments_test.dart  # LP1-LP7 (7 tests)
│   ├── maintenance_flow_test.dart   # M1-M5   (5 tests)
│   ├── occupancy_flow_test.dart     # OC1-OC3 (3 tests)
│   ├── profile_flow_test.dart       # PR1-PR10 (10 tests)
│   ├── notifications_flow_test.dart # N1-N3   (3 tests)
│   └── navigation_flow_test.dart    # NV1-NV5 (5 tests)
├── reports/                         # Auto-generated JSON reports (gitignored)
└── README.md                        # This file
```

---

## Quick Start

### Prerequisites
1. **Android Emulator running** — API 34+ recommended (typically `emulator-5554`)
2. **Backend API running** — `pnpm --prefix property-management-saas dev` from the project root
3. **Flutter SDK** — installed and available on PATH (`C:\src\flutter`)

### Run All Tests
```bash
cd propertystack_mobile
flutter test integration_test/app_test.dart
```

### Run a Single Flow
```bash
./integration_test.sh auth           # 🔐 Auth (6 tests)
./integration_test.sh dashboard      # 📊 Dashboard (8 tests)
./integration_test.sh properties     # 🏠 Properties (6 tests)
./integration_test.sh tenants        # 👥 Tenants (4 tests)
./integration_test.sh owners         # 🏢 Owners (5 tests)
./integration_test.sh payments       # 💰 Payments (7 tests)
./integration_test.sh maintenance    # 🔧 Maintenance (5 tests)
./integration_test.sh occupancy      # 📈 Occupancy (3 tests)
./integration_test.sh profile        # 👤 Profile (10 tests)
./integration_test.sh notifications  # 🔔 Notifications (3 tests)
./integration_test.sh navigation     # 🔄 Navigation (5 tests)
```

---

## Test Case Reference

### 🔐 Auth (A1-A6)

| ID | Test Case | Verifies |
|----|-----------|----------|
| A1 | Login with valid credentials | Email/password → landlord dashboard redirect |
| A2 | Login with invalid credentials | Error message displayed |
| A3 | Empty field validation | Tap Sign In with empty fields → validation errors |
| A4 | Bad email format validation | Type "notanemail" → email format error |
| A5 | Password visibility toggle | Tap eye icon → password revealed/hidden |
| A6 | Navigate to Register screen | Tap "Sign Up" → register screen appears |

### 📊 Dashboard (D1-D8)

| ID | Test Case | Verifies |
|----|-----------|----------|
| D1 | Welcome banner visible | "Welcome back, {name}" on screen |
| D2 | Metrics grid 4 cards | Total Properties, Total Tenants, Rent Collected, Pending Fixes |
| D3 | Timeframe selector opens | Tap calendar dropdown → options appear |
| D4 | Nav → Properties | Bottom nav tap → properties screen |
| D5 | Nav → Tenants | Bottom nav tap → tenants screen |
| D6 | Nav → Payments | Bottom nav tap → payments screen |
| D7 | Nav → More menu | Bottom nav tap → overlay with sub-items |
| D8 | Nav → Home returns | Navigate away then Home → dashboard returns |

### 🏠 Properties (P1-P6)

| ID | Test Case | Verifies |
|----|-----------|----------|
| P1 | List loads | Property cards or empty state rendered |
| P2 | Search field interactive | Tap → keyboard → type → filters |
| P3 | Category filter chips | Residential/Commercial/All toggle |
| P4 | Property card → detail | Tap card → PropertyDetailScreen |
| P5 | Detail back nav | Back arrow → returns to list |
| P6 | Pull-to-refresh | Drag down → refresh indicator |

### 👥 Tenants (T1-T5)

| ID | Test Case | Verifies |
|----|-----------|----------|
| T1 | List loads | Tenant cards or empty state |
| T2 | Search tenants | Type name → filtered results |
| T3 | Tap tenant card | Card tap → detail/action sheet |
| T4 | Pull-to-refresh | Drag down → refresh indicator |
| T5 | Create new tenant | Add button → modal sheet → enter name/email/phone → submit |

### 🏢 Owners (O1-O6)

| ID | Test Case | Verifies |
|----|-----------|----------|
| O1 | List loads via More | More → Owners → list rendered |
| O2 | Owner card → detail | Card tap → OwnerDetailScreen |
| O3 | Detail back nav | Back arrow → returns to list |
| O4 | Add Landlord button visible | FAB or Add button exists |
| O5 | Pull-to-refresh | Drag down → refresh indicator |
| O6 | Create new landlord | FAB → AddLandlordScreen → enter name/email → submit |

### 💰 Payments (LP1-LP7)

| ID | Test Case | Verifies |
|----|-----------|----------|
| LP1 | Payments screen loads | Stats banner + payment list |
| LP2 | Payment status badges | Paid, Pending, Overdue, etc. |
| LP3 | Payment card → review | Card tap → review screen |
| LP4 | Review shows details | Amount, tenant, date visible |
| LP5 | Review back nav | Back arrow → returns to list |
| LP6 | Filter/tab switching | All, Pending, Paid tabs work |
| LP7 | Pull-to-refresh | Drag down → refresh indicator |

### 🔧 Maintenance (M1-M5)

| ID | Test Case | Verifies |
|----|-----------|----------|
| M1 | List loads via More | More → Maintenance → list |
| M2 | Status badges | Open, In Progress, Resolved |
| M3 | Detail/chat opens | Card tap → detail screen |
| M4 | Back navigation | Back arrow → returns |
| M5 | Pull-to-refresh | Drag down → refresh |

### 📈 Occupancy (OC1-OC3)

| ID | Test Case | Verifies |
|----|-----------|----------|
| OC1 | Screen loads | More → Occupancy → rendered |
| OC2 | Data displayed | Charts/percentages visible |
| OC3 | Back navigation | Back arrow → returns |

### 👤 Profile (PR1-PR10)

| ID | Test Case | Verifies |
|----|-----------|----------|
| PR1 | Profile screen loads | User info visible |
| PR2 | Notification Settings | Opens NotificationSettingsScreen |
| PR3 | Privacy & Security | Opens PrivacySecurityScreen |
| PR4 | Help & Support | Opens HelpSupportScreen |
| PR5 | Change Password | Opens ChangePasswordScreen |
| PR6 | Appearance picker | Dark/Light/System options |
| PR7 | Language picker | Language selection present |
| PR8 | Currency picker | Currency selection present |
| PR9 | Version info | "PropertyStack v{x.y.z}" at bottom |
| PR10 | Logout button | Sign Out button visible |

### 🔔 Notifications (N1-N3)

| ID | Test Case | Verifies |
|----|-----------|----------|
| N1 | Screen loads | Bell icon → notifications screen |
| N2 | Cards displayed | Items or empty state |
| N3 | Back navigation | Back arrow → returns |

### 🔄 Navigation Integrity (NV1-NV5)

| ID | Test Case | Verifies |
|----|-----------|----------|
| NV1 | Deep link /landlord | Opens landlord dashboard |
| NV2 | Tab state preserved | Navigate away + back → state intact |
| NV3 | All 5 bottom nav tabs | Home, Properties, Tenants, Payments, More |
| NV4 | More menu sub-items | Owners, Maintenance, Occupancy, Profile |
| NV5 | Profile accessible | Profile reachable from any screen |

---

## Reports & Failure Diagnostics

After each test run, a **JSON report** is generated in `integration_test/reports/`:

```json
{
  "timestamp": "2026-08-31T13:20:00.000",
  "device": "emulator-5554",
  "durationMs": 180000,
  "summary": {
    "total": 62,
    "passed": 58,
    "failed": 3,
    "skipped": 1,
    "passRate": "93.5%"
  },
  "results": [
    { 
      "id": "A1", 
      "module": "Auth", 
      "name": "Login with valid credentials", 
      "status": "PASSED", 
      "durationMs": 12000 
    },
    {
      "id": "LP4",
      "module": "Payments",
      "name": "Payment review shows details",
      "status": "FAILED",
      "reason": "AssertionError: Expected element containing ₦ was not found",
      "remediation": "Check if API returned empty payments list. Seed invoice data with `npx tsx scripts/test-seeds/reset-tenant-payments.ts`.",
      "stackTrace": "#0 PaymentReviewTest...\n#1 TestHelpers.waitFor...",
      "durationMs": 5200
    }
  ]
}
```

A terminal summary with failure diagnostics is also printed:

```
╔══════════════════════════════════════════════════════════════════════════╗
║  PropertyStack — Test Diagnostic Report                                  ║
║  ✅ PASSED: 58 / 62                                                        ║
║  ❌ FAILED: 3                                                                ║
║  ⚠️  SKIPPED: 1                                                               ║
╚══════════════════════════════════════════════════════════════════════════╝

❌ DETAILED FAILURE DIAGNOSTICS & FIX GUIDE:
🔴 [LP4] Payments > Payment review shows details
   Error: AssertionError: Expected element containing ₦ was not found
   💡 How to Fix: Check if API returned empty payments list. Seed invoice data.
   Location/Trace: file:///.../landlord_payments_test.dart:82
```

---

## Key Technical Decisions

### Why `pump()` instead of `pumpAndSettle()`?
The app runs always-on background services (SocketService, UpdateService, NotificationsProvider). `pumpAndSettle()` waits until **all timers stop** — which never happens with live WebSocket connections. All tests use `pump()` loops with fixed durations instead.

### Why save/restore `FlutterError.onError`?
The app's `main.dart` overrides `FlutterError.onError` with a global error boundary. The Flutter test framework also uses `FlutterError.onError` for test assertions. Without saving/restoring, any test failure cascades into a `_pendingExceptionDetails != null` crash. The `TestHelpers.launchApp()` method handles this automatically.

### Why `flutter run -t` instead of `flutter test`?
`flutter run -t` launches the app directly on the connected Android device/emulator, making test execution visible in real-time and properly supporting Flutter integration test drivers.

### Why `TextField` finder instead of `TextFormField`?
Flutter renders `TextFormField` as a `TextField` internally. The `find.byType(TextFormField)` finder doesn't match rendered widgets — `find.byType(TextField)` does.

---

## Writing New Tests

### Template
```dart
testWidgets('XX: Your test name', (tester) async {
  await r.runCase(
    id: 'XX',
    module: 'ModuleName',
    name: 'Your test name',
    testFn: () async {
      // 1. Launch app
      await TestHelpers.launchApp(tester, app.main);
      
      // 2. Login
      await TestHelpers.loginAs(tester);
      
      // 3. Navigate to the screen
      await TestHelpers.isOnLandlordDashboard(tester);
      await TestHelpers.tapNavItem(tester, 'Properties');
      
      // 4. Interact & verify
      await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
      final found = find.text('Expected Text');
      print('  Found: ${found.evaluate().isNotEmpty}');
      
      // 5. Screenshot
      await TestHelpers.screenshot(binding, 'xx_screenshot');
    },
  );
});
```

### Available Helpers

| Method | Description |
|--------|-------------|
| `TestHelpers.launchApp(tester, app.main)` | Safely launches app with FlutterError.onError protection |
| `TestHelpers.loginAs(tester)` | Logs in with default credentials |
| `TestHelpers.pumpFor(tester, duration: ...)` | Pumps frames for a fixed duration (safe for live services) |
| `TestHelpers.waitFor(tester, finder)` | Waits for a widget to appear with timeout |
| `TestHelpers.tapNavItem(tester, 'label')` | Taps a bottom nav item by label |
| `TestHelpers.goBack(tester)` | Taps the back arrow |
| `TestHelpers.scrollDown(tester)` | Scrolls the current scrollable view |
| `TestHelpers.pullToRefresh(tester)` | Pull-to-refresh gesture |
| `TestHelpers.screenshot(binding, 'name')` | Takes a screenshot |
| `TestHelpers.printVisibleText(tester)` | Prints visible text widgets (debugging) |

### Adding a New Flow
1. Create `flows/your_flow_test.dart` following the template above
2. Add a public function `yourFlowTests(binding)` (don't use `main()`)
3. Import and call it from `app_test.dart`
4. Add a `case` to `integration_test.sh`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Test hangs indefinitely | Probably using `pumpAndSettle()`. Replace with `pumpFor()`. |
| `FlutterError.onError` crash | Use `TestHelpers.launchApp()` instead of calling `app.main()` directly. |
| "No connected devices" | Start Android Emulator first. Check `adb devices`. |
| Widget not found | Use `TestHelpers.printVisibleText()` to debug what's on screen. |
| Slow builds | First run compiles the APK (~3-4 min). Subsequent runs are fast (~10s). |
