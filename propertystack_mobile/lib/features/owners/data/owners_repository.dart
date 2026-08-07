import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../../core/network/api_client.dart';
import '../domain/owner_model.dart';

class OwnersRepository {
  final ApiClient _apiClient;

  OwnersRepository(this._apiClient);

  /// Fetch all owners/landlords for a given workspace
  Future<List<OwnerModel>> fetchOwners(String workspaceId) async {
    try {
      final response = await _apiClient.dio.get(
        '/workspaces/$workspaceId/owners',
      );

      if (response.statusCode == 200) {
        final List<dynamic> list = response.data['owners'] ?? [];
        return list.map((json) => OwnerModel.fromApiJson(json as Map<String, dynamic>)).toList();
      }
      return [];
    } on DioException catch (e) {
      debugPrint('[OwnersRepository] fetchOwners error: $e');
      String message = 'Failed to load owners.';
      if (e.response?.data is Map && e.response?.data['error'] != null) {
        message = e.response!.data['error'].toString();
      }
      throw Exception(message);
    } catch (e) {
      debugPrint('[OwnersRepository] fetchOwners unexpected error: $e');
      throw Exception('Failed to load owners: ${e.toString()}');
    }
  }

  /// Add a new owner/landlord to the workspace
  Future<Map<String, dynamic>> addOwner(
    String workspaceId, {
    required String name,
    required String email,
    String? password,
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/workspaces/$workspaceId/owners',
        data: {
          'name': name,
          'email': email,
          if (password != null && password.isNotEmpty) 'password': password,
          if (payoutStrategy != null) 'payoutStrategy': payoutStrategy,
          if (bankCode != null) 'bankCode': bankCode,
          if (accountNumber != null) 'accountNumber': accountNumber,
          if (accountName != null) 'accountName': accountName,
        },
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return {
          'owner': response.data['owner'],
          'inviteLink': response.data['inviteLink'],
        };
      }
      throw Exception('Unexpected response code: ${response.statusCode}');
    } on DioException catch (e) {
      debugPrint('[OwnersRepository] addOwner error: $e');
      String message = 'Failed to add owner.';
      if (e.response?.data is Map) {
        final err = e.response!.data['error'];
        if (err != null) message = err.toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to add owner: ${e.toString()}');
    }
  }

  /// Update owner details (bank settlement, payout strategy)
  Future<void> updateOwner(
    String workspaceId,
    String ownerId, {
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    try {
      final response = await _apiClient.dio.put(
        '/workspaces/$workspaceId/owners/$ownerId',
        data: {
          if (payoutStrategy != null) 'payoutStrategy': payoutStrategy,
          'bankCode': bankCode,
          'accountNumber': accountNumber,
          'accountName': accountName,
        },
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update owner settings.');
      }
    } on DioException catch (e) {
      debugPrint('[OwnersRepository] updateOwner error: $e');
      String message = 'Failed to update owner settings.';
      if (e.response?.data is Map && e.response?.data['error'] != null) {
        message = e.response!.data['error'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to update owner: ${e.toString()}');
    }
  }

  /// Delete an owner from the workspace
  Future<void> deleteOwner(String workspaceId, String ownerId) async {
    try {
      final response = await _apiClient.dio.delete(
        '/workspaces/$workspaceId/owners/$ownerId',
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to delete owner.');
      }
    } on DioException catch (e) {
      debugPrint('[OwnersRepository] deleteOwner error: $e');
      String message = 'Failed to remove owner.';
      if (e.response?.data is Map && e.response?.data['error'] != null) {
        message = e.response!.data['error'].toString();
      }
      throw Exception(message);
    } catch (e) {
      throw Exception('Failed to delete owner: ${e.toString()}');
    }
  }
}
