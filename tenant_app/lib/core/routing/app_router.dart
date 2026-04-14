import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/change_password_screen.dart';
import '../../features/auth/presentation/auth_notifier.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/notifications_screen.dart';
import '../../features/payments/presentation/payments_screen.dart';
import '../../features/maintenance/presentation/maintenance_list_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
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

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
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
