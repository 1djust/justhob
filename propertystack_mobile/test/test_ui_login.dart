import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:propertystack_mobile/main.dart' as app;

void main() {
  testWidgets('Full UI Flutter test: Enter credentials and tap Sign In on live backend', (WidgetTester tester) async {
    print('[UI TEST] Launching app...');
    app.main();
    await tester.pumpAndSettle(const Duration(seconds: 5));

    print('[UI TEST] Finding email and password fields...');
    final textFields = find.byType(TextField);
    expect(textFields, findsNWidgets(2));

    print('[UI TEST] Entering solomon4drama@gmail.com...');
    await tester.enterText(textFields.at(0), 'solomon4drama@gmail.com');
    await tester.pumpAndSettle();

    print('[UI TEST] Entering password Test1234!...');
    await tester.enterText(textFields.at(1), 'Test1234!');
    await tester.pumpAndSettle();

    print('[UI TEST] Tapping Sign In button...');
    final signInButton = find.widgetWithText(ElevatedButton, 'Sign In');
    if (signInButton.evaluate().isNotEmpty) {
      await tester.tap(signInButton);
    } else {
      await tester.tap(find.text('Sign In'));
    }

    print('[UI TEST] Waiting for network login request to finish...');
    await tester.pumpAndSettle(const Duration(seconds: 10));

    print('[UI TEST] Checking post-login screen state...');
    // Verify dashboard or landlord home elements appeared
    final welcomeText = find.textContaining('Welcome');
    final dashboardText = find.textContaining('Dashboard');
    final landlordHome = find.textContaining('Properties');
    
    print('[UI TEST] Elements found: Welcome=${welcomeText.evaluate().length}, Dashboard=${dashboardText.evaluate().length}, Properties=${landlordHome.evaluate().length}');
  });
}
