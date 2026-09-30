import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_service.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ApiClient());
});

final authStateProvider = StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AsyncValue.loading()) {
    ApiClient().onUnauthorized = () {
      debugPrint('[AuthNotifier] HTTP 401 Unauthorized detected. Redirecting user to login...');
      state = const AsyncValue.data(null);
    };
    checkAuth();
  }

  Future<void> checkAuth() async {
    state = const AsyncValue.loading();
    try {
      final user = await _repository.getMe();
      state = AsyncValue.data(user);
    } catch (e) {
      debugPrint('Caught error: $e');
      // If checkAuth fails (e.g. 401), we treat it as not logged in
      // instead of crashing with an error state.
      state = const AsyncValue.data(null);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repository.login(email, password);
      // Initialize socket with new token
      await SocketService().init();
      state = AsyncValue.data(user);
    } catch (e, stack) {
      debugPrint('Caught error: $stack');
      state = AsyncValue.error(e, stack);
    }
  }

  void setUser(User? user) {
    state = AsyncValue.data(user);
  }

  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      // Transitions to null state regardless of server response
      state = const AsyncValue.data(null);
    }
  }

  String? lastError;

  Future<bool> changePassword(String newPassword) async {
    lastError = null;
    try {
      final updatedUser = await _repository.changePassword(newPassword);
      if (updatedUser != null) {
        // Directly set the new user state (with mustChangePassword: false and fresh token)
        state = AsyncValue.data(updatedUser);
        return true;
      }
      // Password changed but no user returned — trigger re-login
      await checkAuth();
      return true;
    } catch (e) {
      debugPrint('Caught error: $e');
      lastError = e.toString().replaceFirst('Exception: ', '');
      return false;
    }
  }
  Future<void> resetPassword(String email) async {
    try {
      await _repository.requestPasswordReset(email);
    } catch (e) {
      rethrow;
    }
  }

  Future<bool> updateProfile({
    String? name,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    lastError = null;
    try {
      final updatedUser = await _repository.updateProfile(
        name: name,
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
      );
      if (updatedUser != null) {
        state = AsyncValue.data(updatedUser);
      } else {
        await checkAuth();
      }
      return true;
    } catch (e) {
      debugPrint('Caught error: $e');
      lastError = e.toString().replaceFirst('Exception: ', '');
      return false;
    }
  }
}
