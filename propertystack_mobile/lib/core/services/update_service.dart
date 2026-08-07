import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'dart:io';
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
  // Use a standalone Dio instance — the update check must not depend on
  // ApiClient.init() having completed, since it runs early in initState.
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  // We fetch updates from the web frontend directly, as it hosts the static files
  String get _webBaseUrl {
    if (ApiConfig.isProduction) {
      return 'https://propertystack.vercel.app';
    }
    if (Platform.isLinux || Platform.isWindows || Platform.isMacOS) {
      return 'http://localhost:3000';
    }
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

        debugPrint('Update check: server build=${ serverInfo.latestBuildNumber}, local build=$localBuildNumber');

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
