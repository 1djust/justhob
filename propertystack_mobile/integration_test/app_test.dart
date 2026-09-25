// ignore_for_file: avoid_print
import 'package:integration_test/integration_test.dart';
import 'helpers/test_reporter.dart';
import 'flows/auth_flow_test.dart';
import 'flows/landlord_dashboard_test.dart';
import 'flows/properties_flow_test.dart';
import 'flows/tenants_flow_test.dart';
import 'flows/owners_flow_test.dart';
import 'flows/landlord_payments_test.dart';
import 'flows/maintenance_flow_test.dart';
import 'flows/occupancy_flow_test.dart';
import 'flows/profile_flow_test.dart';
import 'flows/notifications_flow_test.dart';
import 'flows/navigation_flow_test.dart';

/// PropertyStack Mobile — Full Integration Test Suite (64 test cases)
///
/// Runs ALL test flows on the connected Android emulator.
/// Watch your emulator screen to see tests execute in real-time!
///
/// Usage:
///   flutter run -t integration_test/app_test.dart -d emulator-5554
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final reporter = TestReporter();
  reporter.startSuite(deviceId: 'emulator-5554');

  print('');
  print('╔══════════════════════════════════════════════════╗');
  print('║  PropertyStack — Full Integration Test Suite      ║');
  print('║  64 Test Cases across 11 Modules                  ║');
  print('║  Watch your emulator screen! 📱                   ║');
  print('╚══════════════════════════════════════════════════╝');
  print('');

  // Run all flows in sequence
  authFlowTests(binding);           // A1-A6  (6 tests)
  landlordDashboardTests(binding);  // D1-D8  (8 tests)
  propertiesFlowTests(binding);     // P1-P6  (6 tests)
  tenantsFlowTests(binding);        // T1-T5  (5 tests)
  ownersFlowTests(binding);         // O1-O6  (6 tests)
  landlordPaymentsTests(binding);   // LP1-LP7 (7 tests)
  maintenanceFlowTests(binding);    // M1-M5  (5 tests)
  occupancyFlowTests(binding);      // OC1-OC3 (3 tests)
  profileFlowTests(binding);        // PR1-PR10 (10 tests)
  notificationsFlowTests(binding);  // N1-N3  (3 tests)
  navigationFlowTests(binding);     // NV1-NV5 (5 tests)
}
