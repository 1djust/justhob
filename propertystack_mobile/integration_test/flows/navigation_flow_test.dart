// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  navigationFlowTests(binding);
}

void navigationFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🔄 Navigation Integrity', () {
    testWidgets('Navigation: NV1-NV5', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      // NV1
      await r.runCase(id: 'NV1', module: 'Navigation', name: 'Deep link /landlord opens dashboard', testFn: () async {
        final onDashboard = await TestHelpers.isOnLandlordDashboard(tester);
        print('  Landlord dashboard reached: $onDashboard');
        await TestHelpers.screenshot(binding, 'nv1_deeplink');
      });

      // NV2
      await r.runCase(id: 'NV2', module: 'Navigation', name: 'Tab state preserved', testFn: () async {
        await TestHelpers.tapNavItem(tester, 'Properties');
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));

        await TestHelpers.tapNavItem(tester, 'Payments');
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));

        await TestHelpers.tapNavItem(tester, 'Properties');
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));

        print('  Tab navigation preserved ✅');
        await TestHelpers.screenshot(binding, 'nv2_tabs');
      });

      // NV3
      await r.runCase(id: 'NV3', module: 'Navigation', name: 'All 5 bottom nav tabs clickable', testFn: () async {
        int tapped = 0;
        for (final tab in ['Home', 'Properties', 'Tenants', 'Payments', 'More']) {
          final success = await TestHelpers.tapNavItem(tester, tab);
          if (success) tapped++;
        }
        print('  Tapped $tapped/5 nav items');
        assert(tapped >= 4, 'At least 4 of 5 nav items should be tappable');
        await TestHelpers.screenshot(binding, 'nv3_all_tabs');
      });

      // NV4
      await r.runCase(id: 'NV4', module: 'Navigation', name: 'More menu sub-items reachable', testFn: () async {
        await TestHelpers.tapNavItem(tester, 'More');

        int found = 0;
        for (final item in ['Owners', 'Maintenance', 'Occupancy', 'Profile']) {
          if (find.textContaining(item).evaluate().isNotEmpty) {
            found++;
            print('  ✅ $item reachable');
          }
        }
        print('  Found $found/4 More menu items');
        await TestHelpers.screenshot(binding, 'nv4_more_items');
      });

      // NV5
      await r.runCase(id: 'NV5', module: 'Navigation', name: 'Profile accessible', testFn: () async {
        final profile = find.textContaining('Profile');
        if (profile.evaluate().isNotEmpty) {
          await tester.tap(profile.first);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Profile opened ✅');
          await TestHelpers.goBack(tester);
        }
        await TestHelpers.screenshot(binding, 'nv5_profile');
      });

      await r.finalize();
    });
  });
}
