import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/auth_notifier.dart';

final lifecycleServiceProvider = Provider<LifecycleService>((ref) {
  final service = LifecycleService(ref);
  service.init();
  ref.onDispose(() => service.dispose());
  return service;
});

class LifecycleService extends WidgetsBindingObserver {
  final Ref _ref;

  LifecycleService(this._ref);

  void init() {
    WidgetsBinding.instance.addObserver(this);
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    debugPrint('[LifecycleService] State changed to: $state');
    
    // We check if the user is currently logged in before triggering logout
    final authState = _ref.read(authStateProvider);
    final isLoggedIn = authState.hasValue && authState.value != null;

    if (state == AppLifecycleState.paused && isLoggedIn) {
      debugPrint('[LifecycleService] App backgrounded. Logging out user for security.');
      _ref.read(authStateProvider.notifier).logout();
    }
  }
}
