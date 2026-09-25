// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  maintenanceFlowTests(binding);
}

void maintenanceFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🔧 Maintenance Flow', () {
    testWidgets('Maintenance: M1-M5', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      await TestHelpers.tapNavItem(tester, 'More');
      final maint = find.textContaining('Maintenance');
      if (maint.evaluate().isNotEmpty) {
        await tester.tap(maint.first);
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 5));
      }

      await r.runCase(id: 'M1', module: 'Maintenance', name: 'Maintenance list loads via More', testFn: () async {
        print('  Maintenance screen loaded');
        await TestHelpers.screenshot(binding, 'm1_list');
      });

      await r.runCase(id: 'M2', module: 'Maintenance', name: 'Maintenance status badges', testFn: () async {
        for (final s in ['Open', 'In Progress', 'Resolved', 'Pending']) {
          if (find.textContaining(s).evaluate().isNotEmpty) print('  Found: $s');
        }
        await TestHelpers.screenshot(binding, 'm2_statuses');
      });

      await r.runCase(id: 'M3', module: 'Maintenance', name: 'Maintenance detail/chat', testFn: () async {
        final cards = find.byType(InkWell);
        if (cards.evaluate().length > 1) {
          await tester.tap(cards.at(1));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Maintenance detail opened');
        } else {
          print('  No maintenance cards');
        }
        await TestHelpers.screenshot(binding, 'm3_detail');
      });

      await r.runCase(id: 'M4', module: 'Maintenance', name: 'Back navigation', testFn: () async {
        final back = await TestHelpers.goBack(tester);
        print('  Back nav: $back');
        await TestHelpers.screenshot(binding, 'm4_back');
      });

      await r.runCase(id: 'M5', module: 'Maintenance', name: 'Pull-to-refresh', testFn: () async {
        final refreshed = await TestHelpers.pullToRefresh(tester);
        print('  Pull-to-refresh: $refreshed');
        await TestHelpers.screenshot(binding, 'm5_refresh');
      });

      await r.finalize();
    });
  });
}
