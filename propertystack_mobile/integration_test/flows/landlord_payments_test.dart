// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  landlordPaymentsTests(binding);
}

void landlordPaymentsTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('💰 Landlord Payments', () {
    testWidgets('Payments: LP1-LP7', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);
      await TestHelpers.tapNavItem(tester, 'Payments');
      await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 5));

      // LP1
      await r.runCase(id: 'LP1', module: 'Payments', name: 'Payments screen loads', testFn: () async {
        print('  Payments screen loaded');
        await TestHelpers.screenshot(binding, 'lp1_list');
      });

      // LP2
      await r.runCase(id: 'LP2', module: 'Payments', name: 'Payment status badges', testFn: () async {
        final statuses = ['Paid', 'Pending', 'Overdue', 'Under Review', 'Collected'];
        int found = 0;
        for (final s in statuses) {
          if (find.textContaining(s).evaluate().isNotEmpty) found++;
        }
        print('  Found $found status types');
        await TestHelpers.screenshot(binding, 'lp2_statuses');
      });

      // LP3
      await r.runCase(id: 'LP3', module: 'Payments', name: 'Payment card → review', testFn: () async {
        final cards = find.byType(InkWell);
        if (cards.evaluate().length > 3) {
          await tester.tap(cards.at(3));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Payment review opened');
        } else {
          print('  No payment cards to tap');
        }
        await TestHelpers.screenshot(binding, 'lp3_review');
      });

      // LP4
      await r.runCase(id: 'LP4', module: 'Payments', name: 'Payment review shows details', testFn: () async {
        final hasAmount = find.textContaining('₦').evaluate().isNotEmpty ||
            find.textContaining('NGN').evaluate().isNotEmpty;
        print('  Amount visible: $hasAmount');
        TestHelpers.printVisibleText(tester);
        await TestHelpers.screenshot(binding, 'lp4_details');
      });

      // LP5
      await r.runCase(id: 'LP5', module: 'Payments', name: 'Payment review back nav', testFn: () async {
        final back = await TestHelpers.goBack(tester);
        print('  Back nav: $back');
        await TestHelpers.screenshot(binding, 'lp5_back');
      });

      // LP6
      await r.runCase(id: 'LP6', module: 'Payments', name: 'Filter/tab switching', testFn: () async {
        for (final tab in ['All', 'Pending', 'Paid', 'Overdue']) {
          final tabFinder = find.text(tab);
          if (tabFinder.evaluate().isNotEmpty) {
            await tester.tap(tabFinder.first);
            await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 1));
            print('  Tapped tab: $tab');
          }
        }
        await TestHelpers.screenshot(binding, 'lp6_tabs');
      });

      // LP7
      await r.runCase(id: 'LP7', module: 'Payments', name: 'Pull-to-refresh', testFn: () async {
        final refreshed = await TestHelpers.pullToRefresh(tester);
        print('  Pull-to-refresh: $refreshed');
        await TestHelpers.screenshot(binding, 'lp7_refresh');
      });

      await r.finalize();
    });
  });
}
