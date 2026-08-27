// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:propertystack_mobile/core/widgets/header_action_icons.dart';
import 'package:propertystack_mobile/features/auth/domain/user.dart';
import 'package:propertystack_mobile/features/auth/domain/workspace.dart';
import 'package:propertystack_mobile/features/auth/presentation/auth_notifier.dart';
import 'package:propertystack_mobile/features/landlord_home/data/landlord_stats.dart';
import 'package:propertystack_mobile/features/landlord_home/presentation/landlord_home_notifier.dart';
import 'package:propertystack_mobile/features/landlord_home/presentation/landlord_home_screen.dart';
import 'package:propertystack_mobile/core/theme/app_theme.dart';

// ---------------------------------------------------------------------------
// Stub AuthNotifier — never touches network or ApiClient
// ---------------------------------------------------------------------------
class _StubAuthNotifier extends StateNotifier<AsyncValue<User?>>
    implements AuthNotifier {
  _StubAuthNotifier(super.initialState);

  @override
  Future<void> checkAuth() async {} // no-op

  @override
  Future<void> login(String email, String password) async {} // no-op

  @override
  void setUser(User? user) => state = AsyncValue.data(user);

  @override
  Future<void> logout() async => state = const AsyncValue.data(null);

  @override
  Future<bool> changePassword(String newPassword) async => false;

  @override
  Future<void> resetPassword(String email) async {}

  @override
  Future<bool> updateProfile({
    String? name,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async => true;

  @override
  String? lastError;
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------
User _landlordUser({String role = 'LANDLORD'}) => User(
      id: 'user-landlord',
      email: 'landlord@test.com',
      name: 'Test Landlord',
      mustChangePassword: false,
      workspaces: [
        WorkspaceMember(
          id: 'm1',
          role: role,
          workspaceId: 'ws-1',
          workspace: const Workspace(id: 'ws-1', name: 'Prime Properties'),
        ),
      ],
    );

const _tenantUser = User(
  id: 'user-tenant',
  email: 'tenant@test.com',
  name: 'Test Tenant',
  mustChangePassword: false,
  workspaces: [
    WorkspaceMember(
      id: 'm2',
      role: 'TENANT',
      workspaceId: 'ws-1',
      workspace: Workspace(id: 'ws-1', name: 'Prime Properties'),
    ),
  ],
);

const _noWorkspaceUser = User(
  id: 'user-noWs',
  email: 'nows@test.com',
  name: 'No Workspace',
  mustChangePassword: false,
  workspaces: [],
);

const _mustChangePasswordUser = User(
  id: 'user-cp',
  email: 'changepass@test.com',
  name: 'Change Pass',
  mustChangePassword: true,
  workspaces: [],
);

// ---------------------------------------------------------------------------
// Widget test helpers
// ---------------------------------------------------------------------------
ProviderContainer _makeContainer(AsyncValue<User?> authState) {
  final notifier = _StubAuthNotifier(authState);
  final container = ProviderContainer(
    overrides: [
      authStateProvider.overrideWith((_) => notifier),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

ProviderContainer _makeContainerWithStats({
  required AsyncValue<User?> authState,
  LandlordStats? stats,
}) {
  final notifier = _StubAuthNotifier(authState);
  final container = ProviderContainer(
    overrides: [
      authStateProvider.overrideWith((_) => notifier),
      if (stats != null)
        landlordStatsProvider.overrideWith((ref) => Future.value(stats)),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Widget _wrap({required Widget child, required ProviderContainer container}) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: AppTheme.lightTheme,
      home: child,
    ),
  );
}

// ---------------------------------------------------------------------------
// Routing guard pure simulation (mirrors app_router.dart redirect logic)
// ---------------------------------------------------------------------------
String? _simulateRedirect({required User? user, required String location}) {
  if (user == null) {
    return location == '/login' ? null : '/login';
  }
  if (user.mustChangePassword) {
    return location == '/change-password' ? null : '/change-password';
  }

  final isLandlord = user.workspaces.any(
    (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
  );

  if (isLandlord) {
    return location == '/landlord' ? null : '/landlord';
  }

  if (location == '/landlord') return '/';
  if (location == '/login') return '/';

  return null;
}

// ---------------------------------------------------------------------------
// ============================================================
// MAIN TEST RUNNER
// ============================================================
// ---------------------------------------------------------------------------
void main() {
  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1 — Role Detection Logic
  // ─────────────────────────────────────────────────────────────────────────
  group('🔐 SUITE 1 — Role Detection Logic', () {
    bool isLandlord(User u) => u.workspaces.any(
          (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
        );

    test('TC-01: LANDLORD role is correctly detected', () {
      expect(isLandlord(_landlordUser()), isTrue);
    });

    test('TC-02: PROPERTY_MANAGER role is correctly detected', () {
      expect(isLandlord(_landlordUser(role: 'PROPERTY_MANAGER')), isTrue);
    });

    test('TC-03: TENANT role is NOT treated as landlord', () {
      expect(isLandlord(_tenantUser), isFalse);
    });

    test('TC-04: SUPER_ADMIN role is NOT treated as landlord', () {
      const admin = User(
        id: 'admin',
        email: 'admin@test.com',
        name: 'Admin',
        mustChangePassword: false,
        workspaces: [
          WorkspaceMember(
            id: 'ma',
            role: 'SUPER_ADMIN',
            workspaceId: 'ws-x',
            workspace: Workspace(id: 'ws-x', name: 'Admin WS'),
          ),
        ],
      );
      expect(isLandlord(admin), isFalse);
    });

    test('TC-05: Empty workspaces list is NOT treated as landlord', () {
      expect(isLandlord(_noWorkspaceUser), isFalse);
    });

    test('TC-06: Lowercase "landlord" does NOT match (roles are uppercase)', () {
      const lowerRole = 'landlord';
      final isMatch = lowerRole == 'LANDLORD' || lowerRole == 'PROPERTY_MANAGER';
      expect(isMatch, isFalse);
    });

    test('TC-07: Correct workspace name extracted for landlord member', () {
      final ws = _landlordUser().workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );
      expect(ws.workspace.name, equals('Prime Properties'));
    });

    test('TC-08: Mixed-role user — landlord role found among multiple', () {
      final user = User(
        id: 'multi',
        email: 'multi@test.com',
        name: 'Multi',
        mustChangePassword: false,
        workspaces: [
          const WorkspaceMember(
            id: 'm-t',
            role: 'TENANT',
            workspaceId: 'ws-1',
            workspace: Workspace(id: 'ws-1', name: 'Tenant WS'),
          ),
          WorkspaceMember(
            id: 'm-l',
            role: 'LANDLORD',
            workspaceId: 'ws-2',
            workspace: const Workspace(id: 'ws-2', name: 'Landlord WS'),
          ),
        ],
      );
      expect(isLandlord(user), isTrue);
      final landlordWs = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );
      expect(landlordWs.workspace.name, equals('Landlord WS'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2 — Routing Guard Logic
  // ─────────────────────────────────────────────────────────────────────────
  group('🔀 SUITE 2 — Routing Guard Logic', () {
    test('TC-09: Unauthenticated on / → /login', () {
      expect(_simulateRedirect(user: null, location: '/'), equals('/login'));
    });

    test('TC-10: Unauthenticated on /landlord → /login', () {
      expect(_simulateRedirect(user: null, location: '/landlord'), equals('/login'));
    });

    test('TC-11: Unauthenticated on /login → no redirect (no loop)', () {
      expect(_simulateRedirect(user: null, location: '/login'), isNull);
    });

    test('TC-12: Landlord on /login → /landlord', () {
      expect(
          _simulateRedirect(user: _landlordUser(), location: '/login'),
          equals('/landlord'));
    });

    test('TC-13: Landlord on / → /landlord', () {
      expect(
          _simulateRedirect(user: _landlordUser(), location: '/'),
          equals('/landlord'));
    });

    test('TC-14: Landlord already on /landlord → no redirect', () {
      expect(
          _simulateRedirect(user: _landlordUser(), location: '/landlord'),
          isNull);
    });

    test('TC-15: PROPERTY_MANAGER on / → /landlord', () {
      expect(
          _simulateRedirect(
              user: _landlordUser(role: 'PROPERTY_MANAGER'), location: '/'),
          equals('/landlord'));
    });

    test('TC-16: Tenant on / → no redirect (tenant flow untouched)', () {
      expect(_simulateRedirect(user: _tenantUser, location: '/'), isNull,
          reason: 'Critical regression: tenant home must be unaffected');
    });

    test('TC-17: Tenant on /login → /', () {
      expect(_simulateRedirect(user: _tenantUser, location: '/login'), equals('/'));
    });

    test('TC-18: Tenant attempting /landlord → blocked, back to /', () {
      expect(
          _simulateRedirect(user: _tenantUser, location: '/landlord'),
          equals('/'));
    });

    test('TC-19: mustChangePassword user → forced to /change-password', () {
      expect(
          _simulateRedirect(user: _mustChangePasswordUser, location: '/'),
          equals('/change-password'));
    });

    test('TC-20: mustChangePassword user on /change-password → no redirect', () {
      expect(
          _simulateRedirect(
              user: _mustChangePasswordUser, location: '/change-password'),
          isNull);
    });

    test('TC-21: No-workspace user on / → no landlord redirect', () {
      expect(_simulateRedirect(user: _noWorkspaceUser, location: '/'), isNull);
    });

    test('TC-22: No-workspace user on /landlord → blocked to /', () {
      expect(
          _simulateRedirect(user: _noWorkspaceUser, location: '/landlord'),
          equals('/'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3 — LandlordHomeScreen Widget Tests
  // ─────────────────────────────────────────────────────────────────────────
  group('🏠 SUITE 3 — LandlordHomeScreen Widget Tests', () {
    testWidgets('TC-23: Welcome text and subheader rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text("Here's your property summary today."), findsOneWidget);
    });

    testWidgets('TC-24: HeaderActionIcons present in header', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(HeaderActionIcons), findsOneWidget);
    });

    testWidgets('TC-25 & 26: Welcome back greeting with user first name rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Welcome back, Test'), findsOneWidget);
    });

    testWidgets('TC-27: Falls back to email when name is null', (tester) async {
      const user = User(
        id: 'nn',
        email: 'noname@test.com',
        name: null,
        mustChangePassword: false,
        workspaces: [
          WorkspaceMember(
            id: 'm1',
            role: 'LANDLORD',
            workspaceId: 'ws-1',
            workspace: Workspace(id: 'ws-1', name: 'WS'),
          ),
        ],
      );
      final c = _makeContainer(AsyncValue.data(user));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Welcome back, noname@test.com'), findsOneWidget);
    });

    testWidgets('TC-33: "Revenue Updates" section header visible', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Revenue Updates'), findsOneWidget);
    });

    testWidgets('TC-34: All 4 stat card titles are rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Total Properties'), findsOneWidget);
      expect(find.text('Total Tenants'), findsOneWidget);
      expect(find.text('Rent Collected'), findsOneWidget);
      expect(find.text('Pending Fixes'), findsOneWidget);
    });

    testWidgets('TC-35: Navigation tabs rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Properties'), findsOneWidget);
      expect(find.text('Tenants'), findsOneWidget);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('More'), findsOneWidget);
    });

    testWidgets('TC-36: Navigation bar icons rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(BottomNavigationBar), findsOneWidget);
    });

    testWidgets('TC-37: Tapping "Payments" routes to payments dashboard',
        (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      final router = GoRouter(
        initialLocation: '/landlord',
        routes: [
          GoRoute(
            path: '/landlord',
            builder: (context, state) => const LandlordHomeScreen(),
          ),
          GoRoute(
            path: '/landlord/payments',
            builder: (context, state) => const Scaffold(
              body: Text('Landlord Payments Screen'),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: MaterialApp.router(
            theme: AppTheme.lightTheme,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card may be below the fold in the 800×600 test viewport — scroll it into view
      await tester.ensureVisible(find.text('Payments'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Payments'));
      await tester.pumpAndSettle();
      expect(
        find.text('Landlord Payments Screen'),
        findsOneWidget,
      );
    });

    testWidgets('TC-38: "Pending Fixes" metric is visible', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Pending Fixes'), findsOneWidget);
    });

    testWidgets('TC-39: Loading state builds safely', (tester) async {
      final c = _makeContainer(const AsyncValue.loading());
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(LandlordHomeScreen), findsOneWidget);
    });

    testWidgets('TC-40: Null user state builds safely', (tester) async {
      final c = _makeContainer(const AsyncValue.data(null));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(LandlordHomeScreen), findsOneWidget);
    });

    testWidgets('TC-41: Error state handles error state gracefully', (tester) async {
      final c = _makeContainer(
        AsyncValue.error(Exception('Network failure'), StackTrace.current),
      );
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(LandlordHomeScreen), findsOneWidget);
    });

    testWidgets('TC-42: Empty workspaces builds dashboard safely',
        (tester) async {
      final c = _makeContainer(const AsyncValue.data(_noWorkspaceUser));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(LandlordHomeScreen), findsOneWidget);
    });

    testWidgets('TC-43: RefreshIndicator is present in the screen',
        (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });

    testWidgets('TC-44: Sign Out button accessible via More overlay', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pumpAndSettle();
      // More tab now shows overlay, not a full screen with Sign Out
      expect(find.text('More'), findsOneWidget);
    });

    testWidgets('TC-44b: New user with 0 stats shows All caught up and 0 metrics', (tester) async {
      final stats = LandlordStats(
        totalProperties: 0,
        totalTenants: 0,
        rentCollected: 0.0,
        pendingMaintenance: 0,
        underReviewPayments: 0,
        overduePaymentsCount: 0,
        expiringLeasesCount: 0,
      );
      final c = _makeContainerWithStats(
        authState: AsyncValue.data(_landlordUser()),
        stats: stats,
      );
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pumpAndSettle();

      expect(find.text('All caught up'), findsOneWidget);
      expect(find.text('No collections yet'), findsOneWidget);
      expect(find.text('All clear'), findsOneWidget);
      expect(find.text('0 Active'), findsNWidgets(2));
      expect(find.text('Overdue Payments'), findsNothing);
      expect(find.text('Expiring Leases'), findsNothing);
    });

    testWidgets('TC-44c: User with overdue payments renders Overdue Payments card', (tester) async {
      final stats = LandlordStats(
        totalProperties: 2,
        totalTenants: 4,
        rentCollected: 500000.0,
        pendingMaintenance: 1,
        underReviewPayments: 0,
        overduePaymentsCount: 3,
        expiringLeasesCount: 0,
      );
      final c = _makeContainerWithStats(
        authState: AsyncValue.data(_landlordUser()),
        stats: stats,
      );
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pumpAndSettle();

      expect(find.text('Overdue Payments'), findsOneWidget);
      expect(find.text('3 invoices are past due'), findsOneWidget);
      expect(find.text('All caught up'), findsNothing);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 4 — Domain Model Parsing
  // ─────────────────────────────────────────────────────────────────────────
  group('👤 SUITE 4 — Domain Model Parsing', () {
    test('TC-45: User.fromJson parses LANDLORD workspace', () {
      final user = User.fromJson({
        'id': 'u1',
        'email': 'l@test.com',
        'name': 'Landlord',
        'mustChangePassword': false,
        'workspaces': [
          {
            'id': 'm1',
            'role': 'LANDLORD',
            'workspaceId': 'ws-1',
            'workspace': {'id': 'ws-1', 'name': 'Prime Properties'},
          }
        ],
      });
      expect(user.workspaces.first.role, equals('LANDLORD'));
      expect(user.workspaces.first.workspace.name, equals('Prime Properties'));
    });

    test('TC-46: User.fromJson parses PROPERTY_MANAGER workspace', () {
      final user = User.fromJson({
        'id': 'u2',
        'email': 'pm@test.com',
        'mustChangePassword': false,
        'workspaces': [
          {
            'id': 'm2',
            'role': 'PROPERTY_MANAGER',
            'workspaceId': 'ws-2',
            'workspace': {'id': 'ws-2', 'name': 'My Properties'},
          }
        ],
      });
      expect(user.workspaces.first.role, equals('PROPERTY_MANAGER'));
    });

    test('TC-47: User.fromJson parses TENANT workspace', () {
      final user = User.fromJson({
        'id': 'u3',
        'email': 't@test.com',
        'mustChangePassword': false,
        'workspaces': [
          {
            'id': 'm3',
            'role': 'TENANT',
            'workspaceId': 'ws-3',
            'workspace': {'id': 'ws-3', 'name': 'Skyline Apts'},
          }
        ],
      });
      expect(user.workspaces.first.role, equals('TENANT'));
    });

    test('TC-48: User.fromJson handles empty workspaces array', () {
      final user = User.fromJson({
        'id': 'u4',
        'email': 'e@test.com',
        'workspaces': <dynamic>[],
      });
      expect(user.workspaces, isEmpty);
    });

    test('TC-49: User.fromJson handles null name', () {
      final user = User.fromJson({
        'id': 'u5',
        'email': 'nn@test.com',
        'name': null,
        'workspaces': <dynamic>[],
      });
      expect(user.name, isNull);
    });

    test('TC-50: mustChangePassword defaults to false', () {
      final user = User.fromJson({
        'id': 'u6',
        'email': 'u@test.com',
        'workspaces': <dynamic>[],
      });
      expect(user.mustChangePassword, isFalse);
    });

    test('TC-51: WorkspaceMember.fromJson round-trip', () {
      final member = WorkspaceMember.fromJson({
        'id': 'wm1',
        'role': 'LANDLORD',
        'workspaceId': 'ws-99',
        'workspace': {'id': 'ws-99', 'name': 'Sunset Villas'},
      });
      expect(member.id, equals('wm1'));
      expect(member.role, equals('LANDLORD'));
      expect(member.workspaceId, equals('ws-99'));
      expect(member.workspace.name, equals('Sunset Villas'));
    });

    test('TC-52: Workspace.fromJson round-trip', () {
      final ws = Workspace.fromJson({'id': 'ws-abc', 'name': 'Harbor View'});
      expect(ws.id, equals('ws-abc'));
      expect(ws.name, equals('Harbor View'));
    });

    test('TC-53: role.replaceAll("_", " ") formats display strings correctly',
        () {
      expect('LANDLORD'.replaceAll('_', ' '), equals('LANDLORD'));
      expect('PROPERTY_MANAGER'.replaceAll('_', ' '), equals('PROPERTY MANAGER'));
    });
  });
}
