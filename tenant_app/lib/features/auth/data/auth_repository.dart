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
          await _apiClient.storage.write(key: 'access_token', value: token);
        }

        return User.fromJson(userData);
      }
    } on DioException {
      rethrow;
    }
    return null;
  }

  Future<User?> getMe() async {
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
    await _apiClient.dio.post('/auth/logout');
    await _apiClient.cookieJar.deleteAll();
    await _apiClient.storage.delete(key: 'access_token');
  }

  Future<bool> changePassword(String newPassword) async {
    try {
      final response = await _apiClient.dio.post('/auth/change-password', data: {
        'newPassword': newPassword,
      });
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}
