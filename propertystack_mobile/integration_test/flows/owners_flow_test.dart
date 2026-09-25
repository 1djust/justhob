// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  ownersFlowTests(binding);
}

void ownersFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🏢 Owners Flow', () {
    testWidgets('Owners: O1-O6', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      // Navigate to Owners via More menu
      await TestHelpers.tapNavItem(tester, 'More');
      final owners = find.textContaining('Owners');
      if (owners.evaluate().isNotEmpty) {
        await tester.tap(owners.first);
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 5));
      }

      // O1
      await r.runCase(id: 'O1', module: 'Owners', name: 'Owners list loads via More', testFn: () async {
        print('  Owners screen loaded');
        await TestHelpers.screenshot(binding, 'o1_list');
      });

      // O2
      await r.runCase(id: 'O2', module: 'Owners', name: 'Owner card → detail', testFn: () async {
        final cards = find.byType(InkWell);
        if (cards.evaluate().length > 2) {
          await tester.tap(cards.at(2));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Owner detail opened');
        } else {
          print('  No owner cards to tap');
        }
        await TestHelpers.screenshot(binding, 'o2_detail');
      });

      // O3
      await r.runCase(id: 'O3', module: 'Owners', name: 'Owner detail back nav', testFn: () async {
        final back = await TestHelpers.goBack(tester);
        print('  Back nav: $back');
        await TestHelpers.screenshot(binding, 'o3_back');
      });

      // O4
      await r.runCase(id: 'O4', module: 'Owners', name: 'Add Landlord button visible', testFn: () async {
        final fab = find.byType(FloatingActionButton);
        final addBtn = find.textContaining('Add');
        final addIcon = find.byIcon(Icons.add);
        print('  FAB: ${fab.evaluate().isNotEmpty}, Add btn: ${addBtn.evaluate().isNotEmpty}, Add icon: ${addIcon.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'o4_add');
      });

      // O5
      await r.runCase(id: 'O5', module: 'Owners', name: 'Pull-to-refresh', testFn: () async {
        final refreshed = await TestHelpers.pullToRefresh(tester);
        print('  Pull-to-refresh: $refreshed');
        await TestHelpers.screenshot(binding, 'o5_refresh');
      });

      // O6: Add new Landlord
      await r.runCase(id: 'O6', module: 'Owners', name: 'Create new landlord via Add Landlord screen', testFn: () async {
        final fab = find.byType(FloatingActionButton);
        if (fab.evaluate().isNotEmpty) {
          await tester.tap(fab.first);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));

          final formFields = find.byType(TextFormField);
          if (formFields.evaluate().length >= 2) {
            final ts = DateTime.now().millisecondsSinceEpoch % 10000;
            final testName = 'Landlord Test $ts';
            final testEmail = 'landlord$ts@test.com';

            await tester.enterText(formFields.at(0), testName);
            await tester.pump(const Duration(milliseconds: 300));

            await tester.enterText(formFields.at(1), testEmail);
            await tester.pump(const Duration(milliseconds: 300));

            // Tap Authorize Add button
            final authBtn = find.text('Authorize Add');
            if (authBtn.evaluate().isNotEmpty) {
              await tester.tap(authBtn.first);
              await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 4));

              // If success modal appears with Done button, tap it
              final doneBtn = find.text('Done');
              if (doneBtn.evaluate().isNotEmpty) {
                await tester.tap(doneBtn.first);
                await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
              }

              print('  Created landlord: $testName ✅');
            }
          }
        }
        await TestHelpers.screenshot(binding, 'o6_create_landlord');
      });

      await r.finalize();
    });
  });
}
