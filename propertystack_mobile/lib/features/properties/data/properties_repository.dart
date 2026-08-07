import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../domain/property_model.dart';

final propertiesRepositoryProvider = Provider<PropertiesRepository>((ref) {
  return PropertiesRepository(ApiClient());
});

class PropertiesRepository {
  final ApiClient _apiClient;

  PropertiesRepository(this._apiClient);

  /// Fetches all properties for a workspace.
  Future<List<PropertyModel>> getProperties(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get('/workspaces/$workspaceId/properties');
      final List data = response.data['properties'] ?? [];
      return data.map((json) => PropertyModel.fromJson(json)).toList();
    } on DioException catch (e) {
      debugPrint('[PropertiesRepository] getProperties error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to load properties: ${e.toString()}');
    }
  }

  /// Creates a new property in a workspace.
  Future<PropertyModel> createProperty(
    String workspaceId, {
    required String name,
    required String address,
    String? ownerId,
    List<Map<String, String>>? units,
  }) async {
    try {
      final payload = <String, dynamic>{
        'name': name,
        'address': address,
        if (ownerId != null && ownerId.isNotEmpty) 'ownerId': ownerId,
        if (units != null && units.isNotEmpty)
          'units': units
              .map((u) => {
                    'unitNumber': u['unitNumber'] ?? '',
                    'type': toBackendPropertyType(u['type'] ?? ''),
                  })
              .toList(),
      };

      final response = await _apiClient.dio.post(
        '/workspaces/$workspaceId/properties',
        data: payload,
      );
      final data = response.data['property'] ?? response.data;
      return PropertyModel.fromJson(data);
    } on DioException catch (e) {
      debugPrint('[PropertiesRepository] createProperty error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to create property: ${e.toString()}');
    }
  }

  /// Updates an existing property.
  Future<PropertyModel> updateProperty(
    String workspaceId,
    String propertyId, {
    String? name,
    String? address,
    String? ownerId,
  }) async {
    try {
      final payload = <String, dynamic>{
        if (name != null) 'name': name,
        if (address != null) 'address': address,
        if (ownerId != null) 'ownerId': ownerId,
      };

      final response = await _apiClient.dio.put(
        '/workspaces/$workspaceId/properties/$propertyId',
        data: payload,
      );
      final data = response.data['property'] ?? response.data;
      return PropertyModel.fromJson(data);
    } on DioException catch (e) {
      debugPrint('[PropertiesRepository] updateProperty error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to update property: ${e.toString()}');
    }
  }

  /// Deletes a property.
  Future<void> deleteProperty(String workspaceId, String propertyId) async {
    try {
      await _apiClient.dio.delete('/workspaces/$workspaceId/properties/$propertyId');
    } on DioException catch (e) {
      debugPrint('[PropertiesRepository] deleteProperty error: $e');
      throw Exception(_parseErrorMessage(e));
    } catch (e) {
      throw Exception('Failed to delete property: ${e.toString()}');
    }
  }

  /// Maps human-friendly UI unit types to backend Prisma PropertyType enum values.
  static String toBackendPropertyType(String uiType) {
    switch (uiType.trim()) {
      case 'Self-Contain':
        return 'ROOM_SELF_CONTAIN';
      case 'Mini Flat':
        return 'MINI_FLAT';
      case 'R&P S/C':
        return 'ROOM_PARLOUR_SELF_CONTAIN';
      case 'Single Room':
        return 'SINGLE_ROOM';
      case '2-Bed Flat':
        return 'TWO_BEDROOM_FLAT';
      case '3-Bed Flat':
        return 'THREE_BEDROOM_FLAT';
      case 'Duplex':
        return 'DUPLEX';
      default:
        return uiType.isEmpty ? 'MINI_FLAT' : uiType;
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
