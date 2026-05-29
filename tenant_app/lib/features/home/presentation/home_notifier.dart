import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/tenant_repository.dart';
import '../../../../shared/domain/tenant.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_service.dart';

final tenantRepositoryProvider = Provider<TenantRepository>((ref) {
  return TenantRepository(ApiClient());
});

final homeStateProvider = StateNotifierProvider<HomeNotifier, AsyncValue<Tenant?>>((ref) {
  final authState = ref.watch(authStateProvider);
  return HomeNotifier(
    ref.watch(tenantRepositoryProvider),
    authState.value,
  );
});

class HomeNotifier extends StateNotifier<AsyncValue<Tenant?>> {
  final TenantRepository _repository;
  final dynamic _user;
  StreamSubscription? _socketSubscription;
  Timer? _pollTimer;

  HomeNotifier(this._repository, this._user) : super(const AsyncValue.loading()) {
    if (_user != null) {
      _init();
      _listenToSocket();
      _startPolling();
    }
  }

  /// Periodic polling every 15 seconds as a guaranteed fallback.
  /// This ensures the dashboard updates even if the socket connection
  /// is broken, the token is stale, or events are missed.
  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      debugPrint('[HomeNotifier] Periodic poll: refreshing dashboard...');
      _init();
    });
  }

  void _listenToSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = SocketService().eventStream.listen((event) {
      final type = event['type'];

      if (type == 'socket-connected') {
        debugPrint('[HomeNotifier] Socket re-connected: Syncing data...');
        _init();
        return;
      }

      if (type == 'PAYMENT_UPDATED' ||
          type == 'MAINTENANCE_UPDATED' ||
          type == 'LEASE_UPDATED' ||
          type == 'LEASE_RENEWAL_OFFER' ||
          type == 'LEASE_RENEWED' ||
          type == 'LEASE_RENEWAL_REJECTED' ||
          type == 'NOTIFICATION_CREATED') {
        debugPrint('[HomeNotifier] Socket event ($type): Refreshing dashboard...');
        _init();
      }
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    await _init();
  }

  Future<void> _init() async {
    try {
      // Find the first TENANT role in user's workspaces
      final tenantMembers = _user.workspaces.where((m) => m.role == 'TENANT');
      final tenantMember = tenantMembers.isNotEmpty ? tenantMembers.first : null;

      if (tenantMember != null) {
        final tenant = await _repository.getTenantProfile();
        SocketService().joinWorkspace(tenant.workspaceId);
        state = AsyncValue.data(tenant);
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (e, stack) {
      debugPrint('Caught error: $stack');
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> respondToRenewalOffer(String leaseId, String offerId, bool accept) async {
    try {
      await _repository.respondToRenewalOffer(leaseId, offerId, accept);
      await _init(); // Refresh data
    } catch (e) {
      debugPrint('Error responding to renewal: $e');
      rethrow;
    }
  }
}
