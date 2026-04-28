import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../home/data/tenant_repository.dart';
import '../../../../shared/domain/maintenance_request.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_service.dart';

final maintenanceProvider = StateNotifierProvider<MaintenanceNotifier, AsyncValue<List<MaintenanceRequest>>>((ref) {
  return MaintenanceNotifier(TenantRepository(ApiClient()));
});

class MaintenanceNotifier extends StateNotifier<AsyncValue<List<MaintenanceRequest>>> {
  final TenantRepository _repository;
  StreamSubscription? _socketSubscription;

  MaintenanceNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchRequests();
    _listenToSocket();
  }

  void _listenToSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = SocketService().eventStream.listen((event) {
      if (event['type'] == 'MAINTENANCE_UPDATED') {
        print('[MaintenanceNotifier] Socket update: Refreshing requests...');
        fetchRequests();
      }
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    super.dispose();
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
