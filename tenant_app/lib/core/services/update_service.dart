import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/foundation.dart';
import '../network/api_client.dart';

class UpdateInfo {
  final String latestVersion;
  final int latestBuildNumber;
  final bool isMandatory;
  final String downloadUrl;
  final String releaseNotes;

  UpdateInfo({
    required this.latestVersion,
    required this.latestBuildNumber,
    required this.isMandatory,
    required this.downloadUrl,
    required this.releaseNotes,
  });

  factory UpdateInfo.fromJson(Map<String, dynamic> json) {
    return UpdateInfo(
      latestVersion: json['latestVersion'] ?? '1.0.0',
      latestBuildNumber: json['latestBuildNumber'] ?? 1,
      isMandatory: json['isMandatory'] ?? false,
      downloadUrl: json['downloadUrl'] ?? '',
      releaseNotes: json['releaseNotes'] ?? 'A new update is available.',
    );
  }
}

class UpdateService {
  final Dio _dio = ApiClient().dio;

  // We fetch updates from the web frontend directly, as it hosts the static files
  String get _webBaseUrl {
    if (ApiConfig.isProduction) {
      return 'https://justhob.vercel.app';
    }
    // For local dev, you might want to point this to your local next.js if running
    return 'http://10.0.2.2:3000';
  }

  Future<UpdateInfo?> checkForUpdate() async {
    try {
      final response = await _dio.get('$_webBaseUrl/downloads/version.json');

      if (response.statusCode == 200 && response.data != null) {
        final serverInfo = UpdateInfo.fromJson(response.data);

        final packageInfo = await PackageInfo.fromPlatform();
        // pubspec version is '0.1.0+1'. The buildNumber here is '1'
        final localBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

        if (serverInfo.latestBuildNumber > localBuildNumber) {
          return serverInfo;
        }
      }
    } catch (e) {
      // Fail silently for update checks so it doesn't interrupt usage
      debugPrint('Failed to check for updates: $e');
    }
    return null;
  }
}
