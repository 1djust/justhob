import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../domain/tenant_model.dart';

final tenantsRepositoryProvider = Provider<TenantsRepository>((ref) {
  return TenantsRepository(ApiClient());
});

class TenantsRepository {
  final ApiClient _apiClient;

  TenantsRepository(this._apiClient);

  /// Fetch all tenants for a workspace
  Future<List<TenantModel>> getTenants(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get('/workspaces/$workspaceId/tenants');
      final List data = response.data['tenants'] ?? [];
      return data.map((json) => TenantModel.fromJson(json)).toList();
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] getTenants error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to load tenants: ${e.toString()}');
    }
  }

  /// Create a new tenant
  Future<Map<String, dynamic>> createTenant(
    String workspaceId, {
    required String name,
    String? email,
    String? phone,
  }) async {
    try {
      final body = <String, dynamic>{'name': name};
      if (email != null && email.isNotEmpty) body['email'] = email;
      if (phone != null && phone.isNotEmpty) body['phone'] = phone;

      final response = await _apiClient.dio.post(
        '/workspaces/$workspaceId/tenants',
        data: body,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] createTenant error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to create tenant: ${e.toString()}');
    }
  }

  /// Update tenant details (including partial payment override)
  Future<void> updateTenant(
    String workspaceId,
    String tenantId, {
    required String name,
    String? email,
    String? phone,
    bool? allowPartialPayments,
  }) async {
    try {
      final body = <String, dynamic>{'name': name};
      if (email != null) body['email'] = email;
      if (phone != null) body['phone'] = phone;
      body['allowPartialPayments'] = allowPartialPayments;

      await _apiClient.dio.put(
        '/workspaces/$workspaceId/tenants/$tenantId',
        data: body,
      );
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] updateTenant error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to update tenant: ${e.toString()}');
    }
  }

  /// Delete / archive a tenant
  Future<void> deleteTenant(String workspaceId, String tenantId) async {
    try {
      await _apiClient.dio.delete(
        '/workspaces/$workspaceId/tenants/$tenantId',
      );
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] deleteTenant error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to delete tenant: ${e.toString()}');
    }
  }

  /// End a tenant's tenancy
  Future<void> endTenancy(
    String workspaceId,
    String tenantId, {
    required String reason,
    String? note,
  }) async {
    try {
      await _apiClient.dio.post(
        '/workspaces/$workspaceId/tenants/$tenantId/end-tenancy',
        data: {
          'reason': reason.toUpperCase(),
          'note': note ?? 'Ended from mobile app',
        },
      );
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] endTenancy error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to end tenancy: ${e.toString()}');
    }
  }

  /// Create a lease agreement for a tenant
  Future<Map<String, dynamic>> createLease(
    String workspaceId,
    String tenantId, {
    required String propertyId,
    String? unitId,
    required String startDate,
    String? endDate,
    required double yearlyRent,
    String? agreementText,
    String? managerSignature,
    String? legalDocUrl,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/workspaces/$workspaceId/tenants/$tenantId/leases',
        data: {
          'propertyId': propertyId,
          if (unitId != null && unitId.isNotEmpty) 'unitId': unitId,
          'startDate': startDate,
          if (endDate != null && endDate.isNotEmpty) 'endDate': endDate,
          'yearlyRent': yearlyRent,
          if (agreementText != null && agreementText.isNotEmpty) 'agreementText': agreementText,
          if (managerSignature != null && managerSignature.isNotEmpty) 'managerSignature': managerSignature,
          if (legalDocUrl != null && legalDocUrl.isNotEmpty) 'legalDocUrl': legalDocUrl,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] createLease error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to create lease: ${e.toString()}');
    }
  }

  /// Get workspace partial payment setting
  Future<bool> getWorkspacePartialPayments(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get('/workspaces');
      final workspaces = (response.data['workspaces'] as List?) ?? [];
      for (final wm in workspaces) {
        final ws = wm['workspace'];
        if (ws != null && ws['id'] == workspaceId) {
          return ws['allowPartialPayments'] as bool? ?? true;
        }
      }
      return true; // Default to enabled
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] getWorkspacePartialPayments error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to fetch workspace settings: ${e.toString()}');
    }
  }

  /// Update workspace global partial payment setting
  Future<void> updateWorkspacePartialPayments(
    String workspaceId, {
    required bool allowPartialPayments,
  }) async {
    try {
      await _apiClient.dio.patch(
        '/workspaces/$workspaceId',
        data: {'allowPartialPayments': allowPartialPayments},
      );
    } on DioException catch (e) {
      debugPrint('[TenantsRepository] updateWorkspacePartialPayments error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to update workspace settings: ${e.toString()}');
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
      return 'Server connection timed out.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach server.';
    }
    return 'An error occurred while processing request.';
  }
}
