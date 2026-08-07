import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../home/data/tenant_repository.dart';
import '../../../../shared/domain/maintenance_request.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_service.dart';

final maintenanceProvider = StateNotifierProvider<MaintenanceNotifier, AsyncValue<List<MaintenanceRequest>>>((ref) {
  return MaintenanceNotifier(TenantRepository(ApiClient()), ref);
});

class MaintenanceNotifier extends StateNotifier<AsyncValue<List<MaintenanceRequest>>> {
  final TenantRepository _repository;
  final Ref _ref;
  StreamSubscription? _socketSubscription;

  MaintenanceNotifier(this._repository, this._ref) : super(const AsyncValue.loading()) {
    fetchRequests();
    _listenToSocket();
  }

  void _listenToSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = SocketService().eventStream.listen((event) {
      if (event['type'] == 'MAINTENANCE_UPDATED' || event['type'] == 'MAINTENANCE_CREATED') {
        debugPrint('[MaintenanceNotifier] Socket update: Refreshing requests...');
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
      final authState = _ref.read(authStateProvider);
      final user = authState.valueOrNull;

      if (user == null) {
        state = const AsyncValue.data([]);
        return;
      }

      final isManagerOrLandlord = user.workspaces.any(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      if (isManagerOrLandlord) {
        final workspaceMember = user.workspaces.firstWhere(
          (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
        );
        final requests = await _repository.getManagerMaintenanceRequests(workspaceMember.workspaceId);
        state = AsyncValue.data(requests);
      } else {
        final requests = await _repository.getMaintenanceRequests();
        state = AsyncValue.data(requests);
      }
    } catch (e, stack) {
      debugPrint('Caught error in MaintenanceNotifier: $stack');
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> updateStatus({
    required String requestId,
    String? status,
    String? priority,
  }) async {
    try {
      final authState = _ref.read(authStateProvider);
      final user = authState.valueOrNull;
      if (user == null) return;

      final workspaceMember = user.workspaces.firstWhere(
        (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      );

      await _repository.updateMaintenanceStatus(
        workspaceId: workspaceMember.workspaceId,
        requestId: requestId,
        status: status,
        priority: priority,
      );
      await fetchRequests();
    } catch (e) {
      rethrow;
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
