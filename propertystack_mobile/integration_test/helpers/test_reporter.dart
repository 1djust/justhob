// ignore_for_file: avoid_print

import 'dart:convert';
import 'dart:io';

/// Test result status for each individual test case.
enum TestStatus { passed, failed, skipped }

/// A single test case result with detailed diagnostic metadata.
class TestResult {
  final String id;
  final String module;
  final String name;
  final TestStatus status;
  final String? reason;
  final String? errorDetails;
  final String? stackTrace;
  final String? remediation;
  final Duration duration;

  TestResult({
    required this.id,
    required this.module,
    required this.name,
    required this.status,
    this.reason,
    this.errorDetails,
    this.stackTrace,
    this.remediation,
    this.duration = Duration.zero,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'module': module,
        'name': name,
        'status': status.name.toUpperCase(),
        'reason': reason,
        'errorDetails': errorDetails,
        'stackTrace': stackTrace,
        'remediation': remediation,
        'durationMs': duration.inMilliseconds,
      };
}

/// Collects test results and generates JSON + terminal reports.
class TestReporter {
  static final TestReporter _instance = TestReporter._();
  factory TestReporter() => _instance;
  TestReporter._();

  final List<TestResult> _results = [];
  final Stopwatch _suiteTimer = Stopwatch();
  String _deviceId = 'unknown';

  /// Start the suite timer.
  void startSuite({String deviceId = 'emulator-5554'}) {
    _results.clear();
    _deviceId = deviceId;
    _suiteTimer
      ..reset()
      ..start();
  }

  /// Derives actionable suggestions for fixing common test failures.
  static String deriveRemediation(Object error, StackTrace? stack) {
    final str = error.toString().toLowerCase();
    
    if (str.contains('connection refused') || str.contains('socketexception') || str.contains('errno = 111')) {
      return 'Backend API is unreachable. Ensure the dev server is running (run `bash wsl_start_dev.sh`) and listening on port 3001.';
    }
    if (str.contains('403') || str.contains('forbidden') || str.contains('no tenant profile')) {
      return 'Account role mismatch or missing tenant/landlord record. Verify test account workspace membership in the database or seed test data.';
    }
    if (str.contains('401') || str.contains('unauthorized')) {
      return 'Authentication failed. Check test email and password in `TestHelpers.testEmail` / `TestHelpers.testPassword`.';
    }
    if (str.contains('timeout') || str.contains('taking longer than expected')) {
      return 'Operation timed out waiting for UI or network. Check API response times or increase wait duration with `TestHelpers.pumpFor()`.';
    }
    if (str.contains('finder') || str.contains('zero widgets') || str.contains('no element')) {
      return 'Widget not found on screen. Check if previous navigation succeeded, or inspect screen widgets using `TestHelpers.printVisibleText(tester)`.';
    }
    if (str.contains('lateinitializationerror')) {
      return 'A late field was initialized multiple times or accessed too early. Verify singleton initialization lifecycle.';
    }
    if (str.contains('assertion') && str.contains('is not true')) {
      return 'Assertion failed. Verify screen state, route path, or expected text matches the actual UI output.';
    }

    return 'Check exception stack trace and verify screen state at the point of failure.';
  }

  /// Record a test result.
  void record({
    required String id,
    required String module,
    required String name,
    required TestStatus status,
    String? reason,
    String? errorDetails,
    String? stackTrace,
    String? remediation,
    Duration duration = Duration.zero,
  }) {
    final result = TestResult(
      id: id,
      module: module,
      name: name,
      status: status,
      reason: reason,
      errorDetails: errorDetails,
      stackTrace: stackTrace,
      remediation: remediation,
      duration: duration,
    );
    _results.add(result);

    // Live output per test
    final icon = switch (status) {
      TestStatus.passed => '✅',
      TestStatus.failed => '❌',
      TestStatus.skipped => '⚠️',
    };
    print('$icon [$id] $name${reason != null ? " — $reason" : ""}');
  }

  /// Helper to run a test case and automatically record pass/fail with full diagnostics.
  Future<void> runCase({
    required String id,
    required String module,
    required String name,
    required Future<void> Function() testFn,
  }) async {
    final sw = Stopwatch()..start();
    try {
      await testFn();
      sw.stop();
      record(
        id: id,
        module: module,
        name: name,
        status: TestStatus.passed,
        duration: sw.elapsed,
      );
    } catch (e, stack) {
      sw.stop();
      final fullError = e.toString();
      final conciseReason = fullError.split('\n').first;
      final stackLines = stack.toString().split('\n').take(6).join('\n');
      final fixSuggestion = deriveRemediation(e, stack);

      record(
        id: id,
        module: module,
        name: name,
        status: TestStatus.failed,
        reason: conciseReason,
        errorDetails: fullError,
        stackTrace: stackLines,
        remediation: fixSuggestion,
        duration: sw.elapsed,
      );

      print('   ↳ ⚠️ Failure Details: $conciseReason');
      print('   ↳ 💡 How to Fix: $fixSuggestion');
    }
  }

  /// Get counts by status.
  int get passed => _results.where((r) => r.status == TestStatus.passed).length;
  int get failed => _results.where((r) => r.status == TestStatus.failed).length;
  int get skipped => _results.where((r) => r.status == TestStatus.skipped).length;
  int get total => _results.length;

  /// Generate full report object.
  Map<String, dynamic> generateReport() {
    return {
      'timestamp': DateTime.now().toIso8601String(),
      'device': _deviceId,
      'durationMs': _suiteTimer.elapsedMilliseconds,
      'summary': {
        'total': total,
        'passed': passed,
        'failed': failed,
        'skipped': skipped,
        'passRate': total > 0 ? '${(passed / total * 100).toStringAsFixed(1)}%' : '0%',
      },
      'results': _results.map((r) => r.toJson()).toList(),
    };
  }

  /// Print the terminal summary report with failure diagnostics.
  void printReport() {
    _suiteTimer.stop();
    final elapsed = _suiteTimer.elapsed;
    final now = DateTime.now().toIso8601String().substring(0, 19);

    print('');
    print('╔══════════════════════════════════════════════════════════════════════════╗');
    print('║  PropertyStack — Test Diagnostic Report                                  ║');
    print('║  Date: $now                                           ║');
    print('║  Device: $_deviceId                                                  ║');
    print('║  Duration: ${elapsed.inMinutes}m ${elapsed.inSeconds % 60}s                                                       ║');
    print('╠══════════════════════════════════════════════════════════════════════════╣');
    print('║  ✅ PASSED:  $passed / $total                                                        ║');
    print('║  ❌ FAILED:  $failed                                                                ║');
    print('║  ⚠️  SKIPPED: $skipped                                                               ║');
    print('╚══════════════════════════════════════════════════════════════════════════╝');

    // Print module breakdown
    final modules = <String, List<TestResult>>{};
    for (final r in _results) {
      modules.putIfAbsent(r.module, () => []).add(r);
    }

    print('');
    print('Module Breakdown:');
    for (final entry in modules.entries) {
      final modulePassed = entry.value.where((r) => r.status == TestStatus.passed).length;
      final moduleTotal = entry.value.length;
      final icon = modulePassed == moduleTotal ? '✅' : '⚠️';
      print('  $icon ${entry.key}: $modulePassed/$moduleTotal passed');
    }

    // Print detailed failures with how-to-fix guide
    final failedTests = _results.where((r) => r.status == TestStatus.failed);
    if (failedTests.isNotEmpty) {
      print('');
      print('══════════════════════════════════════════════════════════════════════════');
      print('❌ DETAILED FAILURE DIAGNOSTICS & FIX GUIDE:');
      print('══════════════════════════════════════════════════════════════════════════');
      for (final r in failedTests) {
        print('\n🔴 [${r.id}] ${r.module} > ${r.name}');
        print('   Error: ${r.reason}');
        if (r.remediation != null) {
          print('   💡 How to Fix: ${r.remediation}');
        }
        if (r.stackTrace != null && r.stackTrace!.isNotEmpty) {
          print('   Location/Trace:');
          for (final line in r.stackTrace!.split('\n')) {
            print('     $line');
          }
        }
      }
      print('══════════════════════════════════════════════════════════════════════════\n');
    }

    // Stream each line of the JSON report with a clear prefix so Android logcat NEVER truncates
    final reportJson = const JsonEncoder.withIndent('  ').convert(generateReport());
    print('###JSON_STREAM_START###');
    for (final line in reportJson.split('\n')) {
      print('###LINE###$line');
    }
    print('###JSON_STREAM_END###');
    print('');
  }

  /// Write JSON report to file (safe fallback on Android sandbox).
  Future<void> writeJsonReport() async {
    try {
      final now = DateTime.now();
      final timestamp = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}_${now.hour.toString().padLeft(2, '0')}${now.minute.toString().padLeft(2, '0')}';

      final reportDir = Directory('integration_test/reports');
      if (!reportDir.existsSync()) {
        reportDir.createSync(recursive: true);
      }

      final report = generateReport();
      final jsonFile = File('${reportDir.path}/report_$timestamp.json');
      await jsonFile.writeAsString(const JsonEncoder.withIndent('  ').convert(report));
    } catch (_) {
      // Android root is read-only, stream extraction handles report delivery safely
    }
  }

  /// Generate and print the full report + write JSON.
  Future<void> finalize() async {
    printReport();
    await writeJsonReport();
  }
}
