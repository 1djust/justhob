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
        
        // Show a brief SnackBar for visual confirmation during debugging
        final scaffoldMessenger = ScaffoldMessenger.maybeOf(context);
        if (scaffoldMessenger != null) {
          scaffoldMessenger.showSnackBar(
            SnackBar(
              content: Text('Real-time Update: $type'),
              duration: const Duration(seconds: 2),
              backgroundColor: Colors.blue.shade800,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }

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
