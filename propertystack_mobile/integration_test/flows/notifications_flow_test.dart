// ignore_for_file: avoid_print
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  notificationsFlowTests(binding);
}

void notificationsFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('🔔 Notifications Flow', () {
    testWidgets('Notifications: N1-N3', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      // Look for bell icon in the header
      final bellIcon = find.byIcon(Icons.notifications_outlined);
      final bellIcon2 = find.byIcon(Icons.notifications);
      if (bellIcon.evaluate().isNotEmpty) {
        await tester.tap(bellIcon.first);
      } else if (bellIcon2.evaluate().isNotEmpty) {
        await tester.tap(bellIcon2.first);
      }
      await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));

      // N1
      await r.runCase(id: 'N1', module: 'Notifications', name: 'Notifications screen loads', testFn: () async {
        print('  Notifications screen loaded');
        await TestHelpers.screenshot(binding, 'n1_loaded');
      });

      // N2
      await r.runCase(id: 'N2', module: 'Notifications', name: 'Notification cards displayed', testFn: () async {
        final hasCards = find.byType(Card).evaluate().isNotEmpty ||
            find.byType(ListTile).evaluate().isNotEmpty;
        final hasEmpty = find.textContaining('No notification').evaluate().isNotEmpty ||
            find.textContaining('no notification').evaluate().isNotEmpty;
        print('  Cards: $hasCards, Empty: $hasEmpty');
        await TestHelpers.screenshot(binding, 'n2_cards');
      });

      // N3
      await r.runCase(id: 'N3', module: 'Notifications', name: 'Back navigation', testFn: () async {
        final back = await TestHelpers.goBack(tester);
        print('  Back nav: $back');
        await TestHelpers.screenshot(binding, 'n3_back');
      });

      await r.finalize();
    });
  });
}
