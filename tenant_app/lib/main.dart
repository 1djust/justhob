import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/network/api_client.dart';
import 'core/network/socket_service.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/services/lifecycle_service.dart';
import 'features/home/presentation/notifications_notifier.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // --- LAYER 1: GLOBAL ERROR BOUNDARY ---
  // Override Flutter's default blank-screen crash behavior.
  // If any widget's build() method throws an unhandled exception,
  // instead of showing a blank/white screen in release mode, Flutter
  // will now render a graceful fallback UI (a red error card in debug,
  // or a silent grey card in release so the app keeps running).
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('[GlobalErrorBoundary] Flutter error caught: ${details.exceptionAsString()}');
  };

  ErrorWidget.builder = (FlutterErrorDetails details) {
    // In release mode, show a small, non-intrusive fallback card
    // instead of the red error screen or blank white page.
    if (const bool.fromEnvironment('dart.vm.product')) {
      return Container(
        margin: const EdgeInsets.all(8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          children: [
            Icon(Icons.warning_amber_outlined, color: Colors.grey.shade400),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'This section could not be loaded. Please pull to refresh.',
                style: TextStyle(color: Colors.grey),
              ),
            ),
          ],
        ),
      );
    }
    // In debug mode, keep the full red error screen so we can see stack traces.
    return ErrorWidget(details.exception);
  };

  // Initialize nested dependencies
  await ApiClient().init();
  await SocketService().init();

  runApp(
    const ProviderScope(
      child: MainApp(),
    ),
  );
}

class MainApp extends ConsumerWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // Initialize lifecycle observer for security (logout on background)
    ref.watch(lifecycleServiceProvider);

    // Listen for socket events and refresh global state if needed
    ref.listen(StreamProvider((ref) => SocketService().eventStream),
        (prev, next) {
      if (next.hasValue) {
        final type = next.value!['type'];
        debugPrint('[MainApp] Global Socket Event: $type');

        // Trigger refresh for notifications count globally
        if (type == 'NOTIFICATION_CREATED' || type == 'LEASE_RENEWAL_OFFER') {
          ref.read(notificationsProvider.notifier).fetchNotifications();
        }
      }
    });

    return MaterialApp.router(
      title: 'Just Hub Tenant',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: router,
    );
  }
}
