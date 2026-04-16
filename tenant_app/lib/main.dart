import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/network/api_client.dart';
import 'core/network/socket_service.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

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
    
    // Listen for socket events and refresh global state if needed
    // This could also be used to show in-app notifications
    ref.listen(StreamProvider((ref) => SocketService().eventStream), (prev, next) {
      if (next.hasValue) {
        print('[MainApp] Global Socket Event: ${next.value!['type']}');
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
