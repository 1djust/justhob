import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiConfig {
  static const bool isProduction = true;
  static const String prodUrl = 'https://justhob.onrender.com/api';
  static const String devUrl = 'http://10.0.2.2:3001/api'; // Android Emulator localhost
  
  static String get baseUrl => isProduction ? prodUrl : devUrl;
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  late final CookieJar cookieJar;
  final storage = const FlutterSecureStorage();

  ApiClient._internal();

  Future<void> init() async {
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
          final token = await storage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            // Token expired or invalid, clear it
            await storage.delete(key: 'access_token');
            await cookieJar.deleteAll();
            // In a full implementation, you might dispatch a global event here to redirect
            // to login using a GlobalKey<NavigatorState>.
          }
          return handler.next(e);
        },
      ),
    );

    dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
      ),
    );
  }
}
