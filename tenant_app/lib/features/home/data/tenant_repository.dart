import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../../shared/domain/tenant.dart';
import '../../../../shared/domain/maintenance_request.dart';
import '../../../../shared/domain/payment.dart';
import '../../../../shared/domain/maintenance_message.dart';

class TenantRepository {
  final ApiClient _apiClient;

  TenantRepository(this._apiClient);

  Future<Tenant> getTenantProfile() async {
    final response = await _apiClient.dio.get('/tenant/dashboard');
    return Tenant.fromJson(response.data['tenant']);
  }

  Future<List<MaintenanceRequest>> getMaintenanceRequests() async {
    final response = await _apiClient.dio.get('/tenant/maintenance');
    final List data = response.data['requests'];
    return data.map((json) => MaintenanceRequest.fromJson(json)).toList();
  }

  Future<MaintenanceRequest> createMaintenanceRequest({
    required String propertyId,
    required String description,
    String? imageUrl,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/tenant/maintenance',
        data: {
          'propertyId': propertyId,
          'description': description,
          'imageUrl': imageUrl,
        },
      );
      return MaintenanceRequest.fromJson(response.data['request']);
    } on DioException catch (e) {
      String message = 'Failed to create request.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        message = 'Server is taking too long to respond. Please try again.';
      } else if (e.type == DioExceptionType.connectionError) {
        message = 'Cannot reach the server. Please check your internet connection.';
      } else if (e.response != null) {
        final data = e.response?.data;
        if (data is Map) {
          if (data['message'] != null) {
            message = data['message'].toString();
          } else if (data['error'] != null) {
            message = data['error'].toString();
          }
        } else if (data is String && data.isNotEmpty) {
           message = data;
        } else if (e.response?.statusCode == 402) {
           message = 'Free plan limit reached. Please upgrade to submit more maintenance requests.';
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('An unexpected error occurred: ${e.toString()}');
    }
  }

  Future<List<Payment>> getPayments() async {
    final response = await _apiClient.dio.get('/tenant/payments');
    final List data = response.data['payments'];
    return data.map((json) => Payment.fromJson(json)).toList();
  }

  Future<String> createPayment({
    required double amount,
    required String leaseId,
    String? note,
  }) async {
    final response = await _apiClient.dio.post(
      '/tenant/payments',
      data: {
        'amount': amount,
        'leaseId': leaseId,
        'note': note,
      },
    );
    return response.data['paymentUrl'] as String;
  }

  /// Creates a payment record and returns the payment ID.
  /// Used for the submit-proof flow where we need the ID to attach proof to.
  Future<String> createPaymentRecord({
    required double amount,
    required String leaseId,
    String? note,
  }) async {
    final response = await _apiClient.dio.post(
      '/tenant/payments',
      data: {
        'amount': amount,
        'leaseId': leaseId,
        'note': note,
      },
    );
    return response.data['paymentId'] as String;
  }

  Future<Payment> uploadPaymentProof({
    required String paymentId,
    required String base64Image,
    String? note,
  }) async {
    final response = await _apiClient.dio.post(
      '/tenant/payments/$paymentId/submit-proof',
      data: {
        'proofUrl': 'data:image/jpeg;base64,$base64Image',
        'note': note,
      },
    );
    return Payment.fromJson(response.data['payment']);
  }

  Future<List<MaintenanceMessage>> getMaintenanceMessages(String requestId) async {
    final response = await _apiClient.dio.get('/tenant/maintenance/$requestId/messages');
    final List data = response.data['messages'];
    return data.map((json) => MaintenanceMessage.fromJson(json)).toList();
  }

  Future<MaintenanceMessage> sendMaintenanceMessage(String requestId, String content) async {
    final response = await _apiClient.dio.post(
      '/tenant/maintenance/$requestId/messages',
      data: {'content': content},
    );
    return MaintenanceMessage.fromJson(response.data['message']);
  }
}
