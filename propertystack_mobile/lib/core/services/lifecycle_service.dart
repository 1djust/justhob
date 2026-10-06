import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/auth_notifier.dart';
import '../../features/auth/presentation/login_screen.dart';
import 'biometric_service.dart';

final lifecycleServiceProvider = Provider<LifecycleService>((ref) {
  final service = LifecycleService(ref);
  service.init();
  ref.onDispose(() => service.dispose());
  return service;
});

class LifecycleService extends WidgetsBindingObserver {
  final Ref _ref;

  LifecycleService(this._ref);

  /// Flag indicating whether an intentional in-app system intent
  /// (such as Camera, Gallery, File Picker, or Share sheet) is currently active.
  /// When active, temporary OS backgrounding (paused state) will not trigger auto-logout.
  static bool _isSystemPickerActive = false;

  static bool get isSystemPickerActive => _isSystemPickerActive;

  static void setSystemPickerActive(bool active) {
    _isSystemPickerActive = active;
    debugPrint('[LifecycleService] isSystemPickerActive set to: $active');
  }

  /// Wraps any asynchronous system picker or native intent call so that
  /// the app knows not to terminate the user session when the OS temporarily pauses Flutter.
  static Future<T> wrapSystemPicker<T>(Future<T> Function() action) async {
    setSystemPickerActive(true);
    try {
      return await action();
    } finally {
      // Small debounce delay to ensure OS lifecycle transition settles back to resumed
      await Future.delayed(const Duration(milliseconds: 600));
      setSystemPickerActive(false);
    }
  }

  void init() {
    WidgetsBinding.instance.addObserver(this);
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    debugPrint('[LifecycleService] State changed to: $state');
    
    // Check if user is currently logged in before evaluating auto-logout
    final authState = _ref.read(authStateProvider);
    final isLoggedIn = authState.hasValue && authState.value != null;

    if (!isLoggedIn) return;

    // Detect if app is entering background / minimized state
    final isBackgrounded = state == AppLifecycleState.paused ||
                           state == AppLifecycleState.hidden;

    if (isBackgrounded) {
      if (_isSystemPickerActive) {
        debugPrint('[LifecycleService] App paused due to active system picker/native dialog. Preserving session.');
        return;
      }

      debugPrint('[LifecycleService] Security: App minimized or switched away. Triggering auto-logout.');
      _performAutoLogout();
    }
  }

  Future<void> _performAutoLogout() async {
    try {
      // Reset biometric session & login auto prompt so user is cleanly prompted on return
      BiometricService.resetSession();
      LoginScreen.resetAutoPrompt();

      // Invalidate session locally and on the server
      await _ref.read(authStateProvider.notifier).logout();
    } catch (e) {
      debugPrint('[LifecycleService] Error during auto-logout: $e');
    }
  }
}
