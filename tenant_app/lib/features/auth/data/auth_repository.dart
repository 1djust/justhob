import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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
            debugPrint('[AuthRepository] Failed to write access_token to storage: $storageError');
          }
        }

        return User.fromJson(userData);
      }
    } on DioException catch (e) {
      debugPrint('Caught error: $e');
      String message = 'Login failed. Please check your credentials.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        message = 'Server is taking too long to respond. Please try again.';
      } else if (e.type == DioExceptionType.connectionError) {
        message = 'Cannot reach the server. Please check your internet connection.';
      } else if (e.response != null) {
        dynamic data = e.response?.data;
        if (data is String) {
          try { data = jsonDecode(data); } catch (_) {
      debugPrint('Caught error: $_');}
        }
        if (data is Map) {
          final error = data['error'];
          if (error is Map && error['message'] != null) {
            message = error['message'].toString();
          } else if (error is String) {
            message = error;
          } else if (data['message'] != null) {
            message = data['message'].toString();
          } else {
            message = 'Error: $data';
          }
        } else {
          message = 'Error ${e.response?.statusCode}: $data';
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('An unexpected error occurred: ${e.toString()}');
    }
    return null;
  }

  Future<User?> getMe() async {
    final token = await _apiClient.storage.read(key: 'access_token');
    if (token == null) return null;

    try {
      final response = await _apiClient.dio.get('/auth/me');
      if (response.statusCode == 200) {
        final userData = response.data['user'];
        return User.fromJson(userData);
      }
    } catch (e) {
      debugPrint('[AuthRepository] getMe error: $e');
      return null;
    }
    return null;
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/auth/logout');
    } catch (e) {
      debugPrint('[AuthRepository] logout API error: $e');
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
        try {
          await _apiClient.storage.write(key: 'access_token', value: response.data['access_token']);
        } catch (e) {
          debugPrint('[AuthRepository] Failed to store new token after password change: $e');
        }
        return User.fromJson(response.data['user']);
      }
      if (response.statusCode == 200 && response.data['success'] == true) {
        return null;
      }
      return null;
    } on DioException catch (e) {
      debugPrint('Caught error: $e');
      String message = 'Failed to update password. Please try again.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        message = 'Server is taking too long to respond.';
      } else if (e.type == DioExceptionType.connectionError) {
        message = 'Cannot reach the server. Check your internet connection.';
      } else if (e.response != null) {
        dynamic data = e.response?.data;
        if (data is String) {
          try { data = jsonDecode(data); } catch (_) {
      debugPrint('Caught error: $_');}
        }
        if (data is Map) {
          final error = data['error'];
          if (error is Map && error['message'] != null) {
            message = error['message'].toString();
          } else if (error is String) {
            message = error;
          } else if (data['message'] != null) {
            message = data['message'].toString();
          } else {
            message = 'Error: $data';
          }
        } else {
          message = 'Error ${e.response?.statusCode}: $data';
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to update password: ${e.toString()}');
    }
  }

  Future<void> requestPasswordReset(String email) async {
    await _apiClient.dio.post('/auth/reset-password-request', data: {
      'email': email,
    });
  }
}
