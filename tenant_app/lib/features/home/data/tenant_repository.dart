import '../../../../core/network/api_client.dart';
import '../../../../shared/domain/tenant.dart';
import '../../../../shared/domain/maintenance_request.dart';
import '../../../../shared/domain/payment.dart';

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
    final response = await _apiClient.dio.post(
      '/tenant/maintenance',
      data: {
        'propertyId': propertyId,
        'description': description,
        'imageUrl': imageUrl,
      },
    );
    return MaintenanceRequest.fromJson(response.data['request']);
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
}
