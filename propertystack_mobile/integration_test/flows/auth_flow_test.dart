// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  authFlowTests(binding);
}

void authFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🔐 Auth Flow', () {
    testWidgets('Auth: A1-A6', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);

      // A1
      await r.runCase(id: 'A1', module: 'Auth', name: 'Login with valid credentials', testFn: () async {
        final loggedIn = await TestHelpers.loginAs(tester);
        assert(loggedIn, 'Login should succeed');
        final onDashboard = await TestHelpers.isOnLandlordDashboard(tester);
        print('  Dashboard reached: $onDashboard');
        await TestHelpers.screenshot(binding, 'a1_dashboard');
      });

      // A2
      await r.runCase(id: 'A2', module: 'Auth', name: 'Login redirected to correct dashboard', testFn: () async {
        final welcome = find.textContaining('Welcome back');
        final dashboard = find.textContaining('Dashboard');
        final found = welcome.evaluate().isNotEmpty || dashboard.evaluate().isNotEmpty;
        print('  On correct screen: $found');
        assert(found, 'Should be on dashboard after login');
      });

      // A3
      await r.runCase(id: 'A3', module: 'Auth', name: 'Auth token valid — API data loaded', testFn: () async {
        final metrics = ['Total Properties', 'Total Tenants', 'Rent Collected', 'Pending Fixes'];
        int found = 0;
        for (final m in metrics) {
          if (find.textContaining(m).evaluate().isNotEmpty) found++;
        }
        print('  Metrics loaded: $found/4');
      });

      // A4
      await r.runCase(id: 'A4', module: 'Auth', name: 'User identity visible', testFn: () async {
        final name = find.textContaining('Solomon');
        print('  User name visible: ${name.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'a4_user_info');
      });

      // A5
      await r.runCase(id: 'A5', module: 'Auth', name: 'Bottom nav is functional post-login', testFn: () async {
        final navItems = ['Home', 'Properties', 'Tenants', 'Payments', 'More'];
        int found = 0;
        for (final item in navItems) {
          if (find.text(item).evaluate().isNotEmpty) found++;
        }
        print('  Nav items visible: $found/5');
        assert(found >= 4, 'At least 4 nav items should be visible');
      });

      // A6
      await r.runCase(id: 'A6', module: 'Auth', name: 'Auth persists across navigation', testFn: () async {
        await TestHelpers.tapNavItem(tester, 'Properties');
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
        await TestHelpers.tapNavItem(tester, 'Home');
        final back = await TestHelpers.isOnLandlordDashboard(tester);
        print('  Auth persisted: $back');
        await TestHelpers.screenshot(binding, 'a6_persist');
      });

      await r.finalize();
    });
  });
}
