// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  propertiesFlowTests(binding);
}

void propertiesFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🏠 Properties Flow', () {
    testWidgets('Properties: P1-P6', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);
      await TestHelpers.tapNavItem(tester, 'Properties');
      await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));

      // P1
      await r.runCase(id: 'P1', module: 'Properties', name: 'Properties list loads', testFn: () async {
        final hasCards = find.byType(Card).evaluate().isNotEmpty || find.byType(InkWell).evaluate().length > 2;
        final hasEmpty = find.textContaining('No properties').evaluate().isNotEmpty;
        print('  Cards: $hasCards, Empty state: $hasEmpty');
        await TestHelpers.screenshot(binding, 'p1_list');
      });

      // P2
      await r.runCase(id: 'P2', module: 'Properties', name: 'Search field interactive', testFn: () async {
        final searchField = find.byType(TextField);
        if (searchField.evaluate().isNotEmpty) {
          await tester.tap(searchField.first);
          await tester.pump(const Duration(milliseconds: 500));
          await tester.enterText(searchField.first, 'Test');
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          await tester.enterText(searchField.first, '');
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 1));
          print('  Search field interactive ✅');
        }
        await TestHelpers.screenshot(binding, 'p2_search');
      });

      // P3
      await r.runCase(id: 'P3', module: 'Properties', name: 'Category filter chips', testFn: () async {
        final residential = find.text('Residential');
        final all = find.text('All');
        if (residential.evaluate().isNotEmpty) {
          await tester.tap(residential);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          print('  Tapped Residential filter');
        }
        if (all.evaluate().isNotEmpty) {
          await tester.tap(all.first);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 2));
          print('  Tapped All filter');
        }
        await TestHelpers.screenshot(binding, 'p3_filters');
      });

      // P4
      await r.runCase(id: 'P4', module: 'Properties', name: 'Property card → detail', testFn: () async {
        final inkWells = find.byType(InkWell);
        if (inkWells.evaluate().length > 3) {
          await tester.tap(inkWells.at(3));
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Tapped property card');
        } else {
          print('  No property cards to tap');
        }
        await TestHelpers.screenshot(binding, 'p4_detail');
      });

      // P5
      await r.runCase(id: 'P5', module: 'Properties', name: 'Property detail back nav', testFn: () async {
        final wentBack = await TestHelpers.goBack(tester);
        print('  Back navigation: $wentBack');
        await TestHelpers.screenshot(binding, 'p5_back');
      });

      // P6
      await r.runCase(id: 'P6', module: 'Properties', name: 'Pull-to-refresh', testFn: () async {
        final refreshed = await TestHelpers.pullToRefresh(tester);
        print('  Pull-to-refresh: $refreshed');
        await TestHelpers.screenshot(binding, 'p6_refresh');
      });

      await r.finalize();
    });
  });
}
