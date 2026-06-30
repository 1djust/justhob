// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tenant_app/features/auth/domain/user.dart';
import 'package:tenant_app/features/auth/domain/workspace.dart';
import 'package:tenant_app/features/auth/presentation/auth_notifier.dart';
import 'package:tenant_app/features/landlord_home/presentation/landlord_home_screen.dart';
import 'package:tenant_app/core/theme/app_theme.dart';

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
    testWidgets('TC-23: AppBar shows "Landlord Dashboard"', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Landlord Dashboard'), findsOneWidget);
    });

    testWidgets('TC-24: Logout icon button present in AppBar', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byIcon(Icons.logout_outlined), findsOneWidget);
    });

    testWidgets('TC-25: "Welcome back," greeting text shown', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Welcome back,'), findsOneWidget);
    });

    testWidgets('TC-26: User name shown in welcome header', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Test Landlord'), findsOneWidget);
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
      // Email appears twice: once as the name fallback in the welcome header,
      // and once in the workspace card — both are intentional, correct behaviour.
      expect(find.text('noname@test.com'), findsNWidgets(2));
    });

    testWidgets('TC-28: "ACTIVE WORKSPACE" label is visible', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('ACTIVE WORKSPACE'), findsOneWidget);
    });

    testWidgets('TC-29: Workspace name shown in workspace card', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Prime Properties'), findsOneWidget);
    });

    testWidgets('TC-30: Role badge shows "LANDLORD"', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('LANDLORD'), findsOneWidget);
    });

    testWidgets('TC-31: Role badge shows "PROPERTY MANAGER"', (tester) async {
      final c = _makeContainer(
        AsyncValue.data(_landlordUser(role: 'PROPERTY_MANAGER')),
      );
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('PROPERTY MANAGER'), findsOneWidget);
    });

    testWidgets('TC-32: User email shown in workspace card', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('landlord@test.com'), findsOneWidget);
    });

    testWidgets('TC-33: "Daily Operations" section header visible', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Daily Operations'), findsOneWidget);
    });

    testWidgets('TC-34: All 4 feature card titles are rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Rent Payments'), findsOneWidget);
      expect(find.text('Maintenance'), findsOneWidget);
      expect(find.text('Properties'), findsOneWidget);
      expect(find.text('Tenant Directory'), findsOneWidget);
    });

    testWidgets('TC-35: All 4 feature card subtitles rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Verify transactions'), findsOneWidget);
      expect(find.text('Manage tickets'), findsOneWidget);
      expect(find.text('Manage units & leases'), findsOneWidget);
      expect(find.text('Contact & leases'), findsOneWidget);
    });

    testWidgets('TC-36: All 4 feature card icons are rendered', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byIcon(Icons.payments_outlined), findsOneWidget);
      expect(find.byIcon(Icons.plumbing_outlined), findsOneWidget);
      expect(find.byIcon(Icons.apartment_outlined), findsOneWidget);
      expect(find.byIcon(Icons.people_outline), findsOneWidget);
    });

    testWidgets('TC-37: Tapping "Rent Payments" shows coming soon snackbar',
        (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      // Card may be below the fold in the 800×600 test viewport — scroll it into view
      await tester.ensureVisible(find.text('Rent Payments'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rent Payments'));
      await tester.pump();
      expect(
        find.text('Rent Payments dashboard is coming soon in mobile app!'),
        findsOneWidget,
      );
    });

    testWidgets('TC-38: Tapping "Maintenance" shows coming soon snackbar',
        (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      // Card may be below the fold in the 800×600 test viewport — scroll it into view
      await tester.ensureVisible(find.text('Maintenance'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Maintenance'));
      await tester.pump();
      expect(
        find.text('Maintenance dashboard is coming soon in mobile app!'),
        findsOneWidget,
      );
    });

    testWidgets('TC-39: Loading state shows CircularProgressIndicator',
        (tester) async {
      final c = _makeContainer(const AsyncValue.loading());
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('TC-40: Null user state shows "Not authenticated"',
        (tester) async {
      final c = _makeContainer(const AsyncValue.data(null));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('Not authenticated'), findsOneWidget);
    });

    testWidgets('TC-41: Error state shows error message', (tester) async {
      final c = _makeContainer(
        AsyncValue.error(Exception('Network failure'), StackTrace.current),
      );
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.textContaining('Error loading dashboard'), findsOneWidget);
    });

    testWidgets('TC-42: Empty workspaces shows "No active workspace"',
        (tester) async {
      final c = _makeContainer(const AsyncValue.data(_noWorkspaceUser));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.text('No active workspace'), findsOneWidget);
    });

    testWidgets('TC-43: RefreshIndicator is present in the screen',
        (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });

    testWidgets('TC-44: Logout tap sets auth state to null', (tester) async {
      final c = _makeContainer(AsyncValue.data(_landlordUser()));
      await tester.pumpWidget(_wrap(child: const LandlordHomeScreen(), container: c));
      await tester.pump();
      await tester.tap(find.byIcon(Icons.logout_outlined));
      await tester.pumpAndSettle();
      final state = c.read(authStateProvider);
      expect(state.value, isNull);
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
