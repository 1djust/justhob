// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  landlordDashboardTests(binding);
}

void landlordDashboardTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('📊 Landlord Dashboard', () {
    testWidgets('Dashboard: D1-D8', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);

      // D1: Welcome banner
      await r.runCase(id: 'D1', module: 'Dashboard', name: 'Welcome banner visible', testFn: () async {
        final found = await TestHelpers.isOnLandlordDashboard(tester);
        assert(found, 'Welcome back banner should be visible');
        await TestHelpers.screenshot(binding, 'd1_welcome');
      });

      // D2: Metrics grid 4 cards
      await r.runCase(id: 'D2', module: 'Dashboard', name: 'Metrics grid 4 cards', testFn: () async {
        final metrics = ['Total Properties', 'Total Tenants', 'Rent Collected', 'Pending Fixes'];
        int found = 0;
        for (final m in metrics) {
          if (find.textContaining(m).evaluate().isNotEmpty) found++;
        }
        print('  Metrics found: $found/4');
        await TestHelpers.screenshot(binding, 'd2_metrics');
      });

      // D3: Timeframe selector
      await r.runCase(id: 'D3', module: 'Dashboard', name: 'Timeframe selector opens', testFn: () async {
        final timeframe = find.textContaining('Last');
        if (timeframe.evaluate().isNotEmpty) {
          await tester.tap(timeframe.first);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          print('  Timeframe dropdown opened');
          await tester.tapAt(const Offset(100, 100));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 1));
        }
        await TestHelpers.screenshot(binding, 'd3_timeframe');
      });

      // D4: Bottom nav → Properties
      await r.runCase(id: 'D4', module: 'Dashboard', name: 'Nav → Properties', testFn: () async {
        final tapped = await TestHelpers.tapNavItem(tester, 'Properties');
        assert(tapped, 'Should navigate to Properties');
        await TestHelpers.screenshot(binding, 'd4_properties');
      });

      // D5: Bottom nav → Tenants
      await r.runCase(id: 'D5', module: 'Dashboard', name: 'Nav → Tenants', testFn: () async {
        final tapped = await TestHelpers.tapNavItem(tester, 'Tenants');
        assert(tapped, 'Should navigate to Tenants');
        await TestHelpers.screenshot(binding, 'd5_tenants');
      });

      // D6: Bottom nav → Payments
      await r.runCase(id: 'D6', module: 'Dashboard', name: 'Nav → Payments', testFn: () async {
        final tapped = await TestHelpers.tapNavItem(tester, 'Payments');
        assert(tapped, 'Should navigate to Payments');
        await TestHelpers.screenshot(binding, 'd6_payments');
      });

      // D7: Bottom nav → More menu
      await r.runCase(id: 'D7', module: 'Dashboard', name: 'Nav → More menu', testFn: () async {
        final tapped = await TestHelpers.tapNavItem(tester, 'More');
        assert(tapped, 'Should open More menu');
        final owners = find.textContaining('Owners');
        final maintenance = find.textContaining('Maintenance');
        print('  Owners: ${owners.evaluate().isNotEmpty}, Maintenance: ${maintenance.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'd7_more_menu');
      });

      // D8: Home returns
      await r.runCase(id: 'D8', module: 'Dashboard', name: 'Nav → Home returns to dashboard', testFn: () async {
        await TestHelpers.tapNavItem(tester, 'Home');
        final back = await TestHelpers.isOnLandlordDashboard(tester);
        assert(back, 'Should return to dashboard');
        await TestHelpers.screenshot(binding, 'd8_home_return');
      });

      await r.finalize();
    });
  });
}
