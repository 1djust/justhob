import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/change_password_screen.dart';
import '../../features/auth/presentation/auth_notifier.dart';
import '../../features/auth/presentation/manager_onboarding_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/home/presentation/notifications_screen.dart';
import '../../features/payments/presentation/payments_screen.dart';
import '../../features/payments/presentation/payments_notifier.dart';
import '../../features/payments/presentation/lockout_screen.dart';
import '../../features/maintenance/presentation/maintenance_list_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/home/presentation/home_notifier.dart';
import '../../features/auth/presentation/lease_review_screen.dart';
import '../../features/landlord_home/presentation/landlord_home_screen.dart';
import '../../features/landlord_home/presentation/landlord_payments_screen.dart';
import '../../features/landlord_home/presentation/landlord_payment_review_screen.dart';
import '../../features/properties/domain/property_model.dart';
import '../../features/properties/presentation/properties_screen.dart';
import '../../features/properties/presentation/property_detail_screen.dart';
import '../../features/tenants/presentation/tenants_screen.dart';
import '../../features/owners/domain/owner_model.dart';
import '../../features/owners/presentation/owners_screen.dart';
import '../../features/owners/presentation/owner_detail_screen.dart';
import '../../features/owners/presentation/add_landlord_screen.dart';
import '../../features/landlord_home/presentation/occupancy_screen.dart';
import '../../shared/domain/payment.dart';

/// A notifier that communicates auth changes to GoRouter without rebuilding the Router instance itself.
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen(authStateProvider, (_, __) => notifyListeners());
    _ref.listen(paymentsProvider, (_, __) => notifyListeners());
    _ref.listen(homeStateProvider, (_, __) => notifyListeners());
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
      final isRegistering = state.matchedLocation == '/register';
      final isChangingPassword = state.matchedLocation == '/change-password';
      final isLink = state.matchedLocation == '/link';

      if (!isLoggedIn) {
        return (isLoggingIn || isRegistering || isLink) ? null : '/login';
      }

      if (authStateValue.mustChangePassword) {
        return isChangingPassword ? null : '/change-password';
      }

      final isOnboarding = state.matchedLocation == '/onboarding';

      final isManager = authStateValue.role == 'PROPERTY_MANAGER' ||
          authStateValue.globalRole == 'PROPERTY_MANAGER' ||
          authStateValue.workspaces.any((m) => m.role == 'PROPERTY_MANAGER');

      final isOnboarded = authStateValue.isOnboarded &&
          authStateValue.workspaces.isNotEmpty;

      // Gatekeeper: If manager has not completed onboarding, force them to /onboarding
      if (isManager && !isOnboarded) {
        return isOnboarding ? null : '/onboarding';
      }

      if (isOnboarding) {
        return isManager ? '/landlord' : '/';
      }

      final isLandlord = authStateValue.workspaces.any(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      final isLandlordPath = state.matchedLocation.startsWith('/landlord');

      if (isLandlord) {
        final isAllowedSharedPath = state.matchedLocation == '/notifications' ||
            state.matchedLocation == '/profile' ||
            state.matchedLocation == '/change-password';
        if (!isLandlordPath && !isAllowedSharedPath) {
          return '/landlord';
        }
        return null;
      }

      // Tenant-specific redirects
      if (isLandlordPath) {
        return '/';
      }

      final tenant = ref.read(homeStateProvider).valueOrNull;
      final activeLease = tenant?.leases?.isNotEmpty == true ? tenant!.leases!.first : null;
      final leaseStatus = activeLease?.status;

      final isLeaseReviewScreen = state.matchedLocation == '/lease-review';

      if (leaseStatus == 'PENDING_SIGNATURE' || leaseStatus == 'REJECTED') {
        if (!isLeaseReviewScreen) {
          return '/lease-review';
        }
        return null;
      } else if (isLeaseReviewScreen) {
        return '/';
      }

      if (isLoggingIn || isRegistering || isChangingPassword || isOnboarding) {
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
      // Smart deep link handler for email CTA routing
      GoRoute(
        path: '/link',
        redirect: (context, state) {
          final action = state.uri.queryParameters['action'] ?? 'login';
          final email = state.uri.queryParameters['email'];

          switch (action) {
            case 'register':
              final step = state.uri.queryParameters['step'];
              final queryParams = <String, String>{};
              if (email != null) queryParams['email'] = email;
              if (step != null) queryParams['step'] = step;
              return Uri(
                path: '/register',
                queryParameters: queryParams.isNotEmpty ? queryParams : null,
              ).toString();
            case 'dashboard':
              return '/landlord';
            case 'onboarding':
              return '/onboarding';
            case 'payments':
              return '/payments';
            default:
              return '/login';
          }
        },
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ??
              (state.extra is String ? state.extra as String : null);
          final step = state.uri.queryParameters['step'];
          return RegisterScreen(
            key: ValueKey('register_${email}_${step}'),
            initialEmail: email,
            initialStep: step == 'otp' ? 2 : 1,
          );
        },
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const ManagerOnboardingScreen(),
      ),
      GoRoute(
        path: '/landlord',
        builder: (context, state) {
          return const LandlordHomeScreen();
        },
      ),
      GoRoute(
        path: '/landlord/properties',
        builder: (context, state) => const PropertiesScreen(),
      ),
      GoRoute(
        path: '/landlord/properties/detail',
        builder: (context, state) {
          final extra = state.extra;
          final property = extra is PropertyModel
              ? extra
              : PropertyModel.fromJson(extra as Map<String, dynamic>);
          return PropertyDetailScreen(property: property);
        },
      ),
      GoRoute(
        path: '/landlord/tenants',
        builder: (context, state) => const TenantsScreen(),
      ),
      GoRoute(
        path: '/landlord/owners',
        builder: (context, state) => const OwnersScreen(),
      ),
      GoRoute(
        path: '/landlord/owners/detail',
        builder: (context, state) {
          final extra = state.extra;
          final owner = extra is OwnerModel
              ? extra
              : OwnerModel.fromJson(extra as Map<String, dynamic>);
          return OwnerDetailScreen(owner: owner);
        },
      ),
      GoRoute(
        path: '/landlord/owners/new',
        builder: (context, state) => const AddLandlordScreen(),
      ),
      GoRoute(
        path: '/landlord/occupancy',
        builder: (context, state) => const OccupancyScreen(),
      ),
      GoRoute(
        path: '/landlord/maintenance',
        builder: (context, state) => const MaintenanceListScreen(),
      ),
      GoRoute(
        path: '/landlord/payments',
        builder: (context, state) => const LandlordPaymentsScreen(),
      ),
      GoRoute(
        path: '/landlord/payments/review',
        builder: (context, state) {
          final extra = state.extra;
          final payment = extra is Payment
              ? extra
              : Payment.fromJson(extra as Map<String, dynamic>);
          return LandlordPaymentReviewScreen(payment: payment);
        },
      ),
      GoRoute(
        path: '/lockout',
        builder: (context, state) => const LockoutScreen(),
      ),
      GoRoute(
        path: '/lease-review',
        builder: (context, state) => const LeaseReviewScreen(),
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
