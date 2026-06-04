import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/change_password_screen.dart';
import '../../features/auth/presentation/auth_notifier.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/notifications_screen.dart';
import '../../features/payments/presentation/payments_screen.dart';
import '../../features/payments/presentation/payments_notifier.dart';
import '../../features/payments/presentation/lockout_screen.dart';
import '../../features/maintenance/presentation/maintenance_list_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';

/// A notifier that communicates auth changes to GoRouter without rebuilding the Router instance itself.
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen(authStateProvider, (_, __) => notifyListeners());
    _ref.listen(paymentsProvider, (_, __) => notifyListeners());
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  return RouterNotifier(ref);
});

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.read(routerNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      // Access the auth state via ref.read instead of ref.watch in the redirect function
      // This ensures we have the latest state when redirect is triggered by the notifier
      final authState = ref.read(authStateProvider);
      final authStateValue = authState.value;
      final isLoggedIn = authState.hasValue && authStateValue != null;
      final isLoggingIn = state.matchedLocation == '/login';
      final isChangingPassword = state.matchedLocation == '/change-password';

      if (!isLoggedIn) {
        return isLoggingIn ? null : '/login';
      }

      if (authStateValue.mustChangePassword) {
        return isChangingPassword ? null : '/change-password';
      }

      if (isLoggingIn || isChangingPassword) {
        return '/';
      }

      final payments = ref.read(paymentsProvider).valueOrNull;
      bool isLockedOut = false;
      if (payments != null) {
        isLockedOut = payments.any((p) => 
          (p.status == 'OVERDUE' || p.status == 'PARTIALLY_PAID') && 
          p.dueDate.difference(DateTime.now()).inDays <= -30 &&
          p.paymentPlanStatus != 'APPROVED'
        );
      }

      final isLockoutScreen = state.matchedLocation == '/lockout';
      final isPaymentsScreen = state.matchedLocation == '/payments';

      if (isLockedOut) {
        if (!isLockoutScreen && !isPaymentsScreen) {
           return '/lockout';
        }
      } else if (isLockoutScreen) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/lockout',
        builder: (context, state) => const LockoutScreen(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/payments',
        builder: (context, state) => const PaymentsScreen(),
      ),
      GoRoute(
        path: '/maintenance',
        builder: (context, state) => const MaintenanceListScreen(),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
});
