import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/foundation.dart';

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
    final rawUrl = (json['downloadUrl'] as String?) ?? '';
    final fullDownloadUrl = rawUrl.startsWith('http')
        ? rawUrl
        : 'https://propertystack.vercel.app$rawUrl';

    return UpdateInfo(
      latestVersion: json['latestVersion'] ?? '1.0.0',
      latestBuildNumber: json['latestBuildNumber'] ?? 1,
      isMandatory: json['isMandatory'] ?? false,
      downloadUrl: fullDownloadUrl,
      releaseNotes: json['releaseNotes'] ?? 'A new update is available.',
    );
  }
}

class UpdateService {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  Future<UpdateInfo?> checkForUpdate() async {
    final urls = [
      'https://propertystack.vercel.app/downloads/version.json',
      'https://justhob.vercel.app/downloads/version.json',
    ];

    for (final url in urls) {
      try {
        final response = await _dio.get(
          url,
          options: Options(
            responseType: ResponseType.plain,
            followRedirects: true,
            validateStatus: (status) => status != null && status < 400,
          ),
        );

        if (response.data != null) {
          final dynamic rawData = response.data;
          final Map<String, dynamic> data = rawData is String
              ? jsonDecode(rawData) as Map<String, dynamic>
              : rawData as Map<String, dynamic>;

          final serverInfo = UpdateInfo.fromJson(data);

          final packageInfo = await PackageInfo.fromPlatform();
          final localBuildNumber = int.tryParse(packageInfo.buildNumber) ?? 0;

          debugPrint(
            'Update check: server build=${serverInfo.latestBuildNumber}, local build=$localBuildNumber',
          );

          if (serverInfo.latestBuildNumber > localBuildNumber) {
            return serverInfo;
          }
        }
      } catch (e) {
        debugPrint('Failed to check for updates from $url: $e');
      }
    }
    return null;
  }
}
