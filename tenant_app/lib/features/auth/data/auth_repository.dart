import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../domain/user.dart';

class AuthRepository {
  final ApiClient _apiClient;

  AuthRepository(this._apiClient);

  Future<User?> login(String email, String password) async {
    try {
      final response = await _apiClient.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        final userData = response.data['user'];
        final token = response.data['access_token'];
        
        if (token != null) {
          try {
            await _apiClient.storage.write(key: 'access_token', value: token);
          } catch (storageError) {
            // Token save failed (Keystore issue on some physical devices)
            // Login still succeeds but session won't persist after app restart
          }
        }

        return User.fromJson(userData);
      }
    } on DioException catch (e) {
      // Extract the actual server error message for display
      String message = 'Login failed. Please check your credentials.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        message = 'Server is taking too long to respond. Please try again.';
      } else if (e.type == DioExceptionType.connectionError) {
        message = 'Cannot reach the server. Please check your internet connection.';
      } else if (e.response != null) {
        // Try to extract structured error from API response
        final data = e.response?.data;
        if (data is Map) {
          final error = data['error'];
          if (error is Map && error['message'] != null) {
            message = error['message'].toString();
          } else if (data['message'] != null) {
            message = data['message'].toString();
          }
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('An unexpected error occurred: ${e.toString()}');
    }
    return null;
  }

  Future<User?> getMe() async {
    // Immediately return null if we have no token, skipping the long network wait on cold start.
    final token = await _apiClient.storage.read(key: 'access_token');
    if (token == null) {
      return null;
    }

    try {
      final response = await _apiClient.dio.get('/auth/me');
      if (response.statusCode == 200) {
        final userData = response.data['user'];
        return User.fromJson(userData);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/auth/logout');
    } catch (e) {
      // Ignore server errors during logout to ensure local cleanup continues
    } finally {
      await _apiClient.cookieJar.deleteAll();
      await _apiClient.storage.delete(key: 'access_token');
    }
  }

  Future<User?> changePassword(String newPassword) async {
    try {
      final response = await _apiClient.dio.post('/auth/change-password', data: {
        'newPassword': newPassword,
      });
      if (response.statusCode == 200 && response.data['access_token'] != null) {
        // Store the fresh token
        await _apiClient.storage.write(key: 'access_token', value: response.data['access_token']);
        // Return the updated user
        return User.fromJson(response.data['user']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  Future<void> requestPasswordReset(String email) async {
    await _apiClient.dio.post('/auth/reset-password-request', data: {
      'email': email,
    });
  }
}
