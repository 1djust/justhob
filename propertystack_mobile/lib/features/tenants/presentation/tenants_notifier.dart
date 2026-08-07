import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/tenants_repository.dart';
import '../domain/tenant_model.dart';

/// Active workspace ID provider for landlord/manager users
final activeWorkspaceIdProvider = Provider<String?>((ref) {
  final authState = ref.watch(authStateProvider);
  final user = authState.valueOrNull;
  if (user == null) return null;

  final landlordWorkspaces = user.workspaces
      .where((m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER')
      .toList();

  if (landlordWorkspaces.isEmpty) return null;
  return landlordWorkspaces.first.workspaceId;
});

/// Tenants list provider
final tenantsProvider = FutureProvider<List<TenantModel>>((ref) async {
  final workspaceId = ref.watch(activeWorkspaceIdProvider);
  if (workspaceId == null) return [];

  final repository = ref.watch(tenantsRepositoryProvider);
  return repository.getTenants(workspaceId);
});

/// Workspace-level global partial payments setting
final workspacePartialPaymentsProvider = FutureProvider<bool>((ref) async {
  final workspaceId = ref.watch(activeWorkspaceIdProvider);
  if (workspaceId == null) return true;

  final repository = ref.watch(tenantsRepositoryProvider);
  return repository.getWorkspacePartialPayments(workspaceId);
});
