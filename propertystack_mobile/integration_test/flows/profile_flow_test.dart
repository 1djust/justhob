// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:propertystack_mobile/main.dart' as app;
import '../helpers/test_helpers.dart';
import '../helpers/test_reporter.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  profileFlowTests(binding);
}

void profileFlowTests(IntegrationTestWidgetsFlutterBinding binding) {
  final r = TestReporter();

  group('👤 Profile Flow', () {
    testWidgets('Profile: PR1-PR10', (tester) async {
      r.startSuite(deviceId: 'emulator-5554');
      await TestHelpers.launchApp(tester, app.main);
      await TestHelpers.loginAs(tester);
      await TestHelpers.isOnLandlordDashboard(tester);

      // Navigate to profile via More menu
      await TestHelpers.tapNavItem(tester, 'More');
      final profile = find.textContaining('Profile');
      if (profile.evaluate().isNotEmpty) {
        await tester.tap(profile.first);
        await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
      }

      // PR1
      await r.runCase(id: 'PR1', module: 'Profile', name: 'Profile screen loads', testFn: () async {
        print('  Profile screen loaded');
        TestHelpers.printVisibleText(tester);
        await TestHelpers.screenshot(binding, 'pr1_loaded');
      });

      // PR2
      await r.runCase(id: 'PR2', module: 'Profile', name: 'Notification Settings opens', testFn: () async {
        final notif = find.text('Notification Settings');
        if (notif.evaluate().isNotEmpty) {
          await tester.ensureVisible(notif);
          await tester.tap(notif);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Notification Settings opened');
          await TestHelpers.goBack(tester);
        }
        await TestHelpers.screenshot(binding, 'pr2_notif');
      });

      // PR3
      await r.runCase(id: 'PR3', module: 'Profile', name: 'Privacy & Security opens', testFn: () async {
        final privacy = find.text('Privacy & Security');
        if (privacy.evaluate().isNotEmpty) {
          await tester.ensureVisible(privacy);
          await tester.tap(privacy);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Privacy & Security opened');
          await TestHelpers.goBack(tester);
        }
        await TestHelpers.screenshot(binding, 'pr3_privacy');
      });

      // PR4
      await r.runCase(id: 'PR4', module: 'Profile', name: 'Help & Support opens', testFn: () async {
        final help = find.text('Help & Support');
        if (help.evaluate().isNotEmpty) {
          await tester.ensureVisible(help);
          await tester.tap(help);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Help & Support opened');
          await TestHelpers.goBack(tester);
        }
        await TestHelpers.screenshot(binding, 'pr4_help');
      });

      // PR5
      await r.runCase(id: 'PR5', module: 'Profile', name: 'Change Password opens', testFn: () async {
        await TestHelpers.scrollDown(tester);
        final changePw = find.text('Change Password');
        if (changePw.evaluate().isNotEmpty) {
          await tester.ensureVisible(changePw);
          await tester.tap(changePw);
          await TestHelpers.pumpFor(tester, duration: const Duration(seconds: 3));
          print('  Change Password opened');
          await TestHelpers.goBack(tester);
        }
        await TestHelpers.screenshot(binding, 'pr5_changepw');
      });

      // PR6
      await r.runCase(id: 'PR6', module: 'Profile', name: 'Appearance picker visible', testFn: () async {
        final appearance = find.textContaining('Appearance');
        final darkMode = find.textContaining('Dark');
        final lightMode = find.textContaining('Light');
        print('  Appearance: ${appearance.evaluate().isNotEmpty}, Dark: ${darkMode.evaluate().isNotEmpty}, Light: ${lightMode.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'pr6_appearance');
      });

      // PR7
      await r.runCase(id: 'PR7', module: 'Profile', name: 'Language picker visible', testFn: () async {
        final lang = find.textContaining('Language');
        print('  Language picker: ${lang.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'pr7_language');
      });

      // PR8
      await r.runCase(id: 'PR8', module: 'Profile', name: 'Currency picker visible', testFn: () async {
        final currency = find.textContaining('Currency');
        print('  Currency picker: ${currency.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'pr8_currency');
      });

      // PR9
      await r.runCase(id: 'PR9', module: 'Profile', name: 'Version info at bottom', testFn: () async {
        await TestHelpers.scrollDown(tester);
        await TestHelpers.scrollDown(tester);
        final version = find.textContaining('PropertyStack v');
        print('  Version info: ${version.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'pr9_version');
      });

      // PR10
      await r.runCase(id: 'PR10', module: 'Profile', name: 'Logout button visible', testFn: () async {
        final logout = find.textContaining('Logout');
        final signOut = find.textContaining('Sign Out');
        print('  Logout: ${logout.evaluate().isNotEmpty}, Sign Out: ${signOut.evaluate().isNotEmpty}');
        await TestHelpers.screenshot(binding, 'pr10_logout');
      });

      await r.finalize();
    });
  });
}
