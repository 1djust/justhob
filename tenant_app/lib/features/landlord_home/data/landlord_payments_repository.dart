import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../shared/domain/payment.dart';

final landlordPaymentsRepositoryProvider = Provider<LandlordPaymentsRepository>((ref) {
  return LandlordPaymentsRepository(ApiClient());
});

class LandlordPaymentsRepository {
  final ApiClient _apiClient;

  LandlordPaymentsRepository(this._apiClient);

  /// Fetches all payments (across all leases) for a given workspace.
  Future<List<Payment>> getPayments(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get('/workspaces/$workspaceId/payments');
      final List data = response.data['payments'] ?? [];
      return data.map((json) => Payment.fromJson(json)).toList();
    } on DioException catch (e) {
      debugPrint('[LandlordPaymentsRepository] getPayments error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to load payments: ${e.toString()}');
    }
  }

  /// Submits manager approval or rejection for a transaction proof.
  Future<void> reviewPayment({
    required String workspaceId,
    required String paymentId,
    required String status, // 'PAID' or 'REJECTED'
    String? rejectionReason,
    double? approvedAmountPaid,
  }) async {
    try {
      await _apiClient.dio.patch(
        '/workspaces/$workspaceId/payments/$paymentId/review',
        data: {
          'status': status,
          if (rejectionReason != null) 'rejectionReason': rejectionReason,
          if (approvedAmountPaid != null) 'approvedAmountPaid': approvedAmountPaid,
        },
      );
    } on DioException catch (e) {
      debugPrint('[LandlordPaymentsRepository] reviewPayment error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to submit review: ${e.toString()}');
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
