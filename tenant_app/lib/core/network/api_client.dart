import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiConfig {
  static const bool isProduction = false;
  static const String prodUrl = 'https://propertystack.onrender.com/api';
  static const String devUrl = 'http://10.0.2.2:3001/api'; // Android Emulator alias
  
  static String get baseUrl {
    if (isProduction) return prodUrl;
    if (Platform.isAndroid) return devUrl;
    return 'http://127.0.0.1:3001/api';
  }
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  late final CookieJar cookieJar;
  late final FlutterSecureStorage storage;
  String? inMemoryToken;

  ApiClient._internal();

  Future<void> init() async {
    // Configure secure storage with encryptedSharedPreferences for physical Android devices.
    // Without this, the Android Keystore can silently fail on real hardware.
    if (Platform.isAndroid) {
      storage = const FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
      );
    } else {
      storage = const FlutterSecureStorage();
    }

    final appDocDir = await getApplicationDocumentsDirectory();
    final String path = appDocDir.path;
    
    cookieJar = PersistCookieJar(
      storage: FileStorage("$path/.cookies/"),
    );

    dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 60),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(CookieManager(cookieJar));
    
    // Auth Interceptor for JWT
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          try {
            String? token = inMemoryToken;
            if (token == null) {
              token = await storage.read(key: 'access_token');
            }
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (e) {
      debugPrint('Caught error: $e');
            // If secure storage read fails, fallback to inMemoryToken
            if (inMemoryToken != null) {
              options.headers['Authorization'] = 'Bearer $inMemoryToken';
            }
            debugPrint('[ApiClient] Secure storage read failed: $e');
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            // Token expired or invalid, clear it
            inMemoryToken = null;
            try {
              await storage.delete(key: 'access_token');
              await cookieJar.deleteAll();
            } catch (clearErr) {
              debugPrint('[ApiClient] Failed to clear storage on 401: $clearErr');
            }
            // In a full implementation, you might dispatch a global event here to redirect
            // to login using a GlobalKey<NavigatorState>.
          }
          return handler.next(e);
        },
      ),
    );

    if (!ApiConfig.isProduction) {
      dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
        ),
      );
    }
  }
}

