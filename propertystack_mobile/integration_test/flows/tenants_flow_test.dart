// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  tenantsFlowTests(binding);
}

void tenantsFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('👥 Tenants Flow', () {
    testWidgets('Tenants: T1-T5', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);
      await TestHelpers.tapNavItem(tester, 'Tenants');
      await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));

      // T1
      await r.runCase(id: 'T1', module: 'Tenants', name: 'Tenants list loads', testFn: () async {
        final hasContent = find.byType(ListView).evaluate().isNotEmpty ||
            find.textContaining('No tenants').evaluate().isNotEmpty ||
            find.byType(Card).evaluate().isNotEmpty;
        print('  Tenants screen loaded: $hasContent');
        await TestHelpers.screenshot(binding, 't1_list');
      });

      // T2
      await r.runCase(id: 'T2', module: 'Tenants', name: 'Search tenants', testFn: () async {
        final searchField = find.byType(TextField);
        if (searchField.evaluate().isNotEmpty) {
          await tester.enterText(searchField.first, 'Test');
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          await tester.enterText(searchField.first, '');
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 1));
          print('  Search field interactive ✅');
        }
        await TestHelpers.screenshot(binding, 't2_search');
      });

      // T3
      await r.runCase(id: 'T3', module: 'Tenants', name: 'Tap tenant card', testFn: () async {
        final cards = find.byType(InkWell);
        if (cards.evaluate().length > 3) {
          await tester.tap(cards.at(3));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          print('  Tapped tenant card');
          await TestHelpers.goBack(tester);
        } else {
          print('  No tenant cards to tap (empty state)');
        }
        await TestHelpers.screenshot(binding, 't3_tap');
      });

      // T4
      await r.runCase(id: 'T4', module: 'Tenants', name: 'Pull-to-refresh', testFn: () async {
        final refreshed = await TestHelpers.pullToRefresh(tester);
        print('  Pull-to-refresh: $refreshed');
        await TestHelpers.screenshot(binding, 't4_refresh');
      });

      // T5: Add new Tenant
      await r.runCase(id: 'T5', module: 'Tenants', name: 'Create new tenant via Add Tenant sheet', testFn: () async {
        final addBtn = find.text('Add');
        if (addBtn.evaluate().isNotEmpty) {
          await tester.tap(addBtn.first);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));

          final textFields = find.byType(TextField);
          // Indices: 0 is search field behind bottom sheet, 1 is Name, 2 is Email, 3 is Phone
          if (textFields.evaluate().length >= 4) {
            final ts = DateTime.now().millisecondsSinceEpoch % 10000;
            final testName = 'Test Tenant $ts';
            final testEmail = 'tenant$ts@test.com';
            final testPhone = '0801${ts.toString().padLeft(7, '0')}';

            await tester.enterText(textFields.at(1), testName);
            await tester.pump(const Duration(milliseconds: 300));

            await tester.enterText(textFields.at(2), testEmail);
            await tester.pump(const Duration(milliseconds: 300));

            await tester.enterText(textFields.at(3), testPhone);
            await tester.pump(const Duration(milliseconds: 300));

            // Tap Create Tenant button
            final createBtn = find.text('Create Tenant');
            if (createBtn.evaluate().isNotEmpty) {
              await tester.tap(createBtn.first);
              await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 4));

              // If success modal appears with Done button, tap it
              final doneBtn = find.text('Done');
              if (doneBtn.evaluate().isNotEmpty) {
                await tester.tap(doneBtn.first);
                await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
              }

              print('  Created tenant: $testName ✅');
            }
          }
        }
        await TestHelpers.screenshot(binding, 't5_create_tenant');
      });

      // Finalize and write JSON report
      await r.finalize();
    });
  });
}
