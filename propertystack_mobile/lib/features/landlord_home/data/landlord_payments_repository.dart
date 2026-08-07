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

  /// Records an offline cash or bank transfer payment.
  Future<void> recordOfflinePayment({
    required String workspaceId,
    required String leaseId,
    required double amount,
    required String dueDate,
    required String status, // 'PENDING' or 'PAID'
    String? note,
  }) async {
    try {
      await _apiClient.dio.post(
        '/workspaces/$workspaceId/payments',
        data: {
          'leaseId': leaseId,
          'amount': amount,
          'dueDate': dueDate,
          'status': status,
          if (note != null && note.isNotEmpty) 'note': note,
        },
      );
    } on DioException catch (e) {
      debugPrint('[LandlordPaymentsRepository] recordOfflinePayment error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to record payment: ${e.toString()}');
    }
  }

  /// Records a partial payment installment with optional balance promise date.
  Future<void> recordPartialPayment({
    required String workspaceId,
    required String paymentId,
    required double amount,
    String? balancePromiseDate,
    String? balancePromiseNote,
  }) async {
    try {
      await _apiClient.dio.post(
        '/workspaces/$workspaceId/payments/$paymentId/partial-pay',
        data: {
          'amount': amount,
          if (balancePromiseDate != null) 'balancePromiseDate': balancePromiseDate,
          if (balancePromiseNote != null) 'balancePromiseNote': balancePromiseNote,
        },
      );
    } on DioException catch (e) {
      debugPrint('[LandlordPaymentsRepository] recordPartialPayment error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to record partial payment: ${e.toString()}');
    }
  }

  /// Dispatches an automated payment reminder to tenant via email and notification.
  Future<void> sendReminder({
    required String workspaceId,
    required String paymentId,
  }) async {
    try {
      await _apiClient.dio.post(
        '/workspaces/$workspaceId/payments/$paymentId/remind',
      );
    } on DioException catch (e) {
      debugPrint('[LandlordPaymentsRepository] sendReminder error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to send reminder: ${e.toString()}');
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
