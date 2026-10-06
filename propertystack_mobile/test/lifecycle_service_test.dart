import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:propertystack_mobile/core/services/lifecycle_service.dart';
import 'package:propertystack_mobile/features/auth/domain/user.dart';
import 'package:propertystack_mobile/features/auth/presentation/auth_notifier.dart';

class _MockAuthNotifier extends StateNotifier<AsyncValue<User?>> implements AuthNotifier {
  _MockAuthNotifier(super.initialState);

  int logoutCallCount = 0;

  @override
  Future<void> checkAuth() async {}

  @override
  Future<void> login(String email, String password) async {}

  @override
  void setUser(User? user) => state = AsyncValue.data(user);

  @override
  Future<void> logout() async {
    logoutCallCount++;
    state = const AsyncValue.data(null);
  }

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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final mockUser = User(
    id: 'user_123',
    email: 'tenant@propertystack.ng',
    name: 'Test Tenant',
    role: 'TENANT',
  );

  group('LifecycleService Auto-Logout Tests', () {
    late ProviderContainer container;
    late _MockAuthNotifier mockAuth;

    setUp(() {
      LifecycleService.setSystemPickerActive(false);
      mockAuth = _MockAuthNotifier(AsyncValue.data(mockUser));
      container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith((ref) => mockAuth),
        ],
      );
    });

    tearDown(() {
      container.dispose();
      LifecycleService.setSystemPickerActive(false);
    });

    test('Trigger auto-logout when app enters paused state while user is logged in', () async {
      final service = container.read(lifecycleServiceProvider);

      expect(mockAuth.logoutCallCount, equals(0));
      expect(container.read(authStateProvider).value, isNotNull);

      // Simulate app minimized / switched away
      service.didChangeAppLifecycleState(AppLifecycleState.paused);
      await pumpEventQueue();

      expect(mockAuth.logoutCallCount, equals(1));
      expect(container.read(authStateProvider).value, isNull);
    });

    test('Trigger auto-logout when app enters hidden state while user is logged in', () async {
      final service = container.read(lifecycleServiceProvider);

      expect(mockAuth.logoutCallCount, equals(0));

      // Simulate app hidden (Flutter 3.13+)
      service.didChangeAppLifecycleState(AppLifecycleState.hidden);
      await pumpEventQueue();

      expect(mockAuth.logoutCallCount, equals(1));
      expect(container.read(authStateProvider).value, isNull);
    });

    test('Do NOT trigger auto-logout when app is paused if user is not logged in', () async {
      mockAuth.setUser(null);
      final service = container.read(lifecycleServiceProvider);

      service.didChangeAppLifecycleState(AppLifecycleState.paused);
      await pumpEventQueue();

      expect(mockAuth.logoutCallCount, equals(0));
    });

    test('Do NOT trigger auto-logout when active system picker is open (camera/gallery/share)', () async {
      final service = container.read(lifecycleServiceProvider);

      // System picker is active
      LifecycleService.setSystemPickerActive(true);

      // Simulate app paused while native picker dialog is open
      service.didChangeAppLifecycleState(AppLifecycleState.paused);
      await pumpEventQueue();

      expect(mockAuth.logoutCallCount, equals(0));
      expect(container.read(authStateProvider).value, isNotNull);
    });

    test('wrapSystemPicker protects session during async picker operation', () async {
      final service = container.read(lifecycleServiceProvider);

      bool pickerExecuted = false;

      final pickerFuture = LifecycleService.wrapSystemPicker(() async {
        expect(LifecycleService.isSystemPickerActive, isTrue);

        // While in picker, app pauses
        service.didChangeAppLifecycleState(AppLifecycleState.paused);
        await pumpEventQueue();

        // Should NOT log out
        expect(mockAuth.logoutCallCount, equals(0));
        pickerExecuted = true;
        return 'image_path.jpg';
      });

      final result = await pickerFuture;
      expect(result, equals('image_path.jpg'));
      expect(pickerExecuted, isTrue);
      expect(mockAuth.logoutCallCount, equals(0));
      expect(container.read(authStateProvider).value, isNotNull);
    });
  });
}
