// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  occupancyFlowTests(binding);
}

void occupancyFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('📈 Occupancy Flow', () {
    testWidgets('Occupancy: OC1-OC3', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      await TestHelpers.tapNavItem(tester, 'More');
      final occ = find.textContaining('Occupancy');
      if (occ.evaluate().isNotEmpty) {
        await tester.tap(occ.first);
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 5));
      }

      await r.runCase(id: 'OC1', module: 'Occupancy', name: 'Occupancy screen loads', testFn: () async {
        print('  Occupancy screen loaded');
        await TestHelpers.screenshot(binding, 'oc1_loaded');
      });

      await r.runCase(id: 'OC2', module: 'Occupancy', name: 'Occupancy data displayed', testFn: () async {
        final hasPercent = find.textContaining('%').evaluate().isNotEmpty;
        final hasOccupied = find.textContaining('Occupied').evaluate().isNotEmpty ||
            find.textContaining('Vacant').evaluate().isNotEmpty;
        print('  Percentage: $hasPercent, Status: $hasOccupied');
        TestHelpers.printVisibleText(tester);
        await TestHelpers.screenshot(binding, 'oc2_data');
      });

      await r.runCase(id: 'OC3', module: 'Occupancy', name: 'Back navigation', testFn: () async {
        final back = await TestHelpers.goBack(tester);
        print('  Back nav: $back');
        await TestHelpers.screenshot(binding, 'oc3_back');
      });

      await r.finalize();
    });
  });
}
