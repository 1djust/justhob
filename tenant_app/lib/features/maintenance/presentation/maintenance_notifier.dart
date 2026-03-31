import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../home/data/tenant_repository.dart';
import '../../../../shared/domain/maintenance_request.dart';
import '../../../../core/network/api_client.dart';

final maintenanceProvider = StateNotifierProvider<MaintenanceNotifier, AsyncValue<List<MaintenanceRequest>>>((ref) {
  return MaintenanceNotifier(TenantRepository(ApiClient()));
});

class MaintenanceNotifier extends StateNotifier<AsyncValue<List<MaintenanceRequest>>> {
  final TenantRepository _repository;

  MaintenanceNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchRequests();
  }

  Future<void> fetchRequests() async {
    state = const AsyncValue.loading();
    try {
      final requests = await _repository.getMaintenanceRequests();
      state = AsyncValue.data(requests);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> createRequest({
    required String propertyId,
    required String description,
  }) async {
    try {
      await _repository.createMaintenanceRequest(
        propertyId: propertyId,
        description: description,
      );
      await fetchRequests();
    } catch (e) {
      rethrow;
    }
  }
}
