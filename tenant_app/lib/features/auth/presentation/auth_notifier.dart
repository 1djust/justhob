import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';
import '../../../../core/network/api_client.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ApiClient());
});

final authStateProvider = StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AsyncValue.loading()) {
    checkAuth();
  }

  Future<void> checkAuth() async {
    state = const AsyncValue.loading();
    try {
      final user = await _repository.getMe();
      state = AsyncValue.data(user);
    } catch (e) {
      // If checkAuth fails (e.g. 401), we treat it as not logged in
      // instead of crashing with an error state.
      state = const AsyncValue.data(null);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repository.login(email, password);
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      // Transitions to null state regardless of server response
      state = const AsyncValue.data(null);
    }
  }

  Future<bool> changePassword(String newPassword) async {
    final updatedUser = await _repository.changePassword(newPassword);
    if (updatedUser != null) {
      // Directly set the new user state (with mustChangePassword: false and fresh token)
      state = AsyncValue.data(updatedUser);
      return true;
    }
    return false;
  }
  Future<void> resetPassword(String email) async {
    try {
      await _repository.requestPasswordReset(email);
    } catch (e) {
      rethrow;
    }
  }
}
