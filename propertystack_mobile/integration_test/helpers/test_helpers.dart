// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

/// Shared test utilities for PropertyStack integration tests.
///
/// CRITICAL ARCHITECTURE NOTES:
/// - Each test FILE must have exactly ONE testWidgets() because app.main()
///   initializes singletons (ApiClient, SocketService) with `late` fields
///   that throw on re-initialization.
/// - All test cases within a flow run as sequential steps inside that single test.
/// - Use TestReporter.runCase() to track individual pass/fail for each step.
class TestHelpers {
  static const testEmail = 'solomon4drama@gmail.com';
  static const testPassword = 'Test1234!';

  // Saved originals for cleanup
  static void Function(FlutterErrorDetails)? _savedOnError;
  static ErrorWidgetBuilder? _savedErrorWidgetBuilder;

  /// Pump frames for a fixed duration — safe for apps with live timers/sockets.
  /// NEVER use pumpAndSettle() — the app has always-running services.
  static Future<void> pumpFor(
    WidgetTester tester, {
    Duration duration = const Duration(seconds: 3),
  }) async {
    final endTime = DateTime.now().add(duration);
    while (DateTime.now().isBefore(endTime)) {
      await tester.pump(const Duration(milliseconds: 200));
    }
  }

  /// Wait for a specific widget to appear with timeout.
  static Future<bool> waitFor(
    WidgetTester tester,
    Finder finder, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    final stopwatch = Stopwatch()..start();
    while (stopwatch.elapsed < timeout) {
      await tester.pump(const Duration(milliseconds: 300));
      if (finder.evaluate().isNotEmpty) return true;
    }
    return false;
  }

  /// Find text input fields.
  static Finder findTextFields() => find.byType(TextField);

  /// Launch the app safely — saves/restores FlutterError.onError AND
  /// ErrorWidget.builder to prevent the app's global error boundary from
  /// hijacking the test framework.
  ///
  /// Call this ONCE per test file. Do NOT call app.main() again.
  static Future<void> launchApp(
    WidgetTester tester,
    void Function() mainFn,
  ) async {
    _savedOnError = FlutterError.onError;
    _savedErrorWidgetBuilder = ErrorWidget.builder;

    mainFn();

    // Restore test framework's handlers
    FlutterError.onError = _savedOnError;
    ErrorWidget.builder = _savedErrorWidgetBuilder ?? ErrorWidget.builder;

    await pumpFor(tester, duration: const Duration(seconds: 5));
  }

  /// Login to the app with credentials.
  static Future<bool> loginAs(
    WidgetTester tester, {
    String email = testEmail,
    String password = testPassword,
  }) async {
    print('🔐 [Login] Looking for login fields...');

    final textFieldsFinder = findTextFields();
    final found = await waitFor(tester, textFieldsFinder, timeout: const Duration(seconds: 10));

    if (!found || textFieldsFinder.evaluate().length < 2) {
      if (find.textContaining('Welcome').evaluate().isNotEmpty ||
          find.textContaining('Dashboard').evaluate().isNotEmpty) {
        print('🔐 [Login] Already authenticated');
        return true;
      }
      print('🔐 [Login] Login fields not found');
      return false;
    }

    print('🔐 [Login] Entering email: $email');
    await tester.enterText(textFieldsFinder.at(0), email);
    await pumpFor(tester, duration: const Duration(milliseconds: 500));

    print('🔐 [Login] Entering password...');
    await tester.enterText(textFieldsFinder.at(1), password);
    await pumpFor(tester, duration: const Duration(milliseconds: 500));

    print('🔐 [Login] Tapping Sign In...');
    final elevatedSignIn = find.widgetWithText(ElevatedButton, 'Sign In');
    final textSignIn = find.text('Sign In');

    if (elevatedSignIn.evaluate().isNotEmpty) {
      await tester.tap(elevatedSignIn);
    } else if (textSignIn.evaluate().isNotEmpty) {
      await tester.tap(textSignIn.first);
    }

    print('🔐 [Login] Waiting for auth...');
    await pumpFor(tester, duration: const Duration(seconds: 8));
    return true;
  }

  /// Check if we're on the landlord dashboard.
  static Future<bool> isOnLandlordDashboard(WidgetTester tester) async {
    return await waitFor(tester, find.textContaining('Welcome back'), timeout: const Duration(seconds: 10));
  }

  /// Tap a bottom nav item by label.
  static Future<bool> tapNavItem(WidgetTester tester, String label) async {
    final navItem = find.text(label);
    if (navItem.evaluate().isNotEmpty) {
      await tester.tap(navItem.first);
      await pumpFor(tester, duration: const Duration(seconds: 3));
      return true;
    }
    print('⚠️ Nav item "$label" not found');
    return false;
  }

  /// Go back via back button icon.
  static Future<bool> goBack(WidgetTester tester) async {
    final backBtn = find.byIcon(Icons.arrow_back);
    final backIos = find.byIcon(Icons.arrow_back_ios);
    if (backBtn.evaluate().isNotEmpty) {
      await tester.tap(backBtn.first);
      await pumpFor(tester, duration: const Duration(seconds: 2));
      return true;
    } else if (backIos.evaluate().isNotEmpty) {
      await tester.tap(backIos.first);
      await pumpFor(tester, duration: const Duration(seconds: 2));
      return true;
    }
    return false;
  }

  /// Scroll down in the current scrollable.
  static Future<void> scrollDown(WidgetTester tester, {double distance = -300}) async {
    final scrollable = find.byType(Scrollable);
    if (scrollable.evaluate().isNotEmpty) {
      await tester.drag(scrollable.first, Offset(0, distance));
      await tester.pump(const Duration(milliseconds: 500));
    }
  }

  /// Pull-to-refresh gesture.
  static Future<bool> pullToRefresh(WidgetTester tester) async {
    final scrollable = find.byType(Scrollable);
    if (scrollable.evaluate().isNotEmpty) {
      await tester.drag(scrollable.first, const Offset(0, 300));
      await pumpFor(tester, duration: const Duration(seconds: 2));
      return true;
    }
    return false;
  }

  /// Take a screenshot safely.
  static Future<void> screenshot(IntegrationTestWidgetsFlutterBinding binding, String name) async {
    try {
      await binding.takeScreenshot(name);
    } catch (_) {}
  }

  /// Print what text widgets are visible on screen (debugging helper).
  static void printVisibleText(WidgetTester tester, {int max = 8}) {
    final allText = find.byType(Text).evaluate().take(max);
    for (final e in allText) {
      final w = e.widget as Text;
      final t = w.data ?? w.textSpan?.toPlainText() ?? '';
      if (t.trim().isNotEmpty) print('  📝 "$t"');
    }
  }
}
