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
  final dynamic _user; // Using dynamic to avoid circular dependency or import issues for now

  HomeNotifier(this._repository, this._user) : super(const AsyncValue.loading()) {
    if (_user != null) {
      _init();
    }
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
      state = AsyncValue.error(e, stack);
    }
  }
}
