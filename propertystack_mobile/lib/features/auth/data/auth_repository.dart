import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import '../domain/user.dart';

class RegisterResult {
  final User? user;
  final bool requiresEmailConfirmation;
  final String? message;

  RegisterResult({
    this.user,
    this.requiresEmailConfirmation = false,
    this.message,
  });
}

class AuthRepository {
  final ApiClient _apiClient;

  AuthRepository(this._apiClient);

  String _extractDioErrorMessage(DioException e, {required String defaultError}) {
    debugPrint('Caught error: $e');
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Server is taking too long to respond. Please try again.';
    } else if (e.type == DioExceptionType.connectionError ||
        e.response == null ||
        (e.error != null && e.error.toString().contains('SocketException'))) {
      return 'Cannot reach the server. Please check your internet connection or verify the API server is running.';
    } else if (e.response != null) {
      dynamic data = e.response?.data;
      if (data is String) {
        try {
          data = jsonDecode(data);
        } catch (e) {
          debugPrint('Caught error: $e');
        }
      }
      if (data is Map) {
        final error = data['error'];
        if (error is Map && error['message'] != null) {
          return error['message'].toString();
        } else if (error is String) {
          return error;
        } else if (data['message'] != null) {
          return data['message'].toString();
        } else {
          return 'Error: $data';
        }
      } else {
        return 'Error ${e.response?.statusCode}: $data';
      }
    }
    return defaultError;
  }

  Future<RegisterResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['requiresEmailConfirmation'] == true) {
          return RegisterResult(
            requiresEmailConfirmation: true,
            message: data['message'] ??
                'Registration successful! Please check your email to confirm your account.',
          );
        }

        final userData = data['user'];
        final token = data['access_token'];

        if (token != null) {
          try {
            _apiClient.inMemoryToken = token;
            await _apiClient.storage.write(key: 'access_token', value: token);
          } catch (storageError) {
            debugPrint(
                '[AuthRepository] Failed to write access_token to storage: $storageError');
          }
        }

        return RegisterResult(
          user: userData != null ? User.fromJson(userData) : null,
          requiresEmailConfirmation: false,
        );
      }
      throw Exception('Registration failed.');
    } on DioException catch (e) {
      throw Exception(_extractDioErrorMessage(e, defaultError: 'Registration failed. Please check your details.'));
    } catch (e) {
      throw Exception('An unexpected error occurred: ${e.toString()}');
    }
  }

  Future<bool> verifyOtp({
    required String email,
    required String token,
    String type = 'signup',
  }) async {
    try {
      final response = await _apiClient.dio.post('/auth/verify-otp', data: {
        'email': email.trim(),
        'token': token.trim(),
        'type': type,
      });

      if (response.statusCode == 200 && response.data['success'] == true) {
        final token = response.data['access_token'];
        if (token != null) {
          try {
            _apiClient.inMemoryToken = token;
            await _apiClient.storage.write(key: 'access_token', value: token);
          } catch (storageError) {
            debugPrint('[AuthRepository] Failed to write access_token to storage: $storageError');
          }
        }
        return true;
      }
      return false;
    } on DioException catch (e) {
      debugPrint('Caught verifyOtp error: $e');
      String message = 'Invalid or expired verification code.';
      if (e.response?.data is Map && e.response?.data['message'] != null) {
        message = e.response!.data['message'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to verify OTP: ${e.toString()}');
    }
  }

  Future<void> resendOtp({
    required String email,
    String type = 'signup',
  }) async {
    try {
      await _apiClient.dio.post('/auth/resend-otp', data: {
        'email': email.trim(),
        'type': type,
      });
    } on DioException catch (e) {
      debugPrint('Caught resendOtp error: $e');
      String message = 'Failed to resend verification code.';
      if (e.response?.data is Map && e.response?.data['message'] != null) {
        message = e.response!.data['message'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to resend code: ${e.toString()}');
    }
  }

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
            _apiClient.inMemoryToken = token;
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
          try { data = jsonDecode(data); } catch (e) {
      debugPrint('Caught error: $e');}
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

  Future<User?> onboardManager({
    required String workspaceName,
    String? bankCode,
    String? accountNumber,
    String? accountName,
    String? phone,
  }) async {
    try {
      final response = await _apiClient.dio.post('/auth/onboard-manager', data: {
        'workspaceName': workspaceName.trim(),
        if (bankCode != null && bankCode.isNotEmpty) 'bankCode': bankCode.trim(),
        if (accountNumber != null && accountNumber.isNotEmpty) 'accountNumber': accountNumber.trim(),
        if (accountName != null && accountName.isNotEmpty) 'accountName': accountName.trim(),
        if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
      });

      if (response.statusCode == 200 && response.data['user'] != null) {
        final user = User.fromJson(response.data['user']);
        return user;
      }
      return null;
    } on DioException catch (e) {
      debugPrint('Caught onboardManager error: $e');
      String message = 'Failed to complete onboarding.';
      if (e.response?.data is Map && e.response?.data['message'] != null) {
        message = e.response!.data['message'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to complete onboarding: ${e.toString()}');
    }
  }

  Future<User?> getMe() async {
    String? token = _apiClient.inMemoryToken;
    try {
      token ??= await _apiClient.storage.read(key: 'access_token');
    } catch (e) {
      debugPrint('[AuthRepository] Failed to read token from storage in getMe: $e');
    }
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
      _apiClient.inMemoryToken = null;
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
          _apiClient.inMemoryToken = response.data['access_token'];
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
          try { data = jsonDecode(data); } catch (e) {
      debugPrint('Caught error: $e');}
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

  Future<User?> updateProfile({
    String? name,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    try {
      final response = await _apiClient.dio.put('/auth/profile', data: {
        if (name != null) 'name': name,
        if (bankCode != null) 'bankCode': bankCode,
        if (accountNumber != null) 'accountNumber': accountNumber,
        if (accountName != null) 'accountName': accountName,
      });

      if (response.statusCode == 200 && response.data['user'] != null) {
        return User.fromJson(response.data['user']);
      }
      return null;
    } on DioException catch (e) {
      debugPrint('[AuthRepository] updateProfile error: $e');
      String message = 'Failed to update profile details.';
      if (e.response?.data is Map && e.response?.data['message'] != null) {
        message = e.response!.data['message'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to update profile: ${e.toString()}');
    }
  }
}
