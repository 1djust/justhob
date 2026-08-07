import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import 'landlord_stats.dart';

final landlordHomeRepositoryProvider = Provider<LandlordHomeRepository>((ref) {
  return LandlordHomeRepository(ApiClient());
});

class LandlordHomeRepository {
  final ApiClient _apiClient;

  LandlordHomeRepository(this._apiClient);

  /// Fetches summary stats for a workspace.
  Future<LandlordStats> getWorkspaceStats(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get('/workspaces/$workspaceId/stats');
      final data = response.data['stats'] ?? {};
      return LandlordStats.fromJson(data);
    } on DioException catch (e) {
      debugPrint('[LandlordHomeRepository] getWorkspaceStats error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to load stats: ${e.toString()}');
    }
  }

  String _parseErrorMessage(DioException e) {
    if (e.response != null && e.response?.data is Map) {
      final data = e.response?.data as Map;
      if (data['message'] != null) return data['message'].toString();
      if (data['error'] != null) {
        final err = data['error'];
        if (err is Map && err['message'] != null) return err['message'].toString();
        return err.toString();
      }
    }
    if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
      return 'Server connection timed out. Please try again.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach the server. Please check your network connection.';
    }
    return 'An error occurred. Please try again.';
  }
}
