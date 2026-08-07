import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/owners_repository.dart';
import '../domain/owner_model.dart';

final ownersRepositoryProvider = Provider<OwnersRepository>((ref) {
  return OwnersRepository(ApiClient());
});

class OwnersState {
  final List<OwnerModel> owners;
  final String searchQuery;
  final bool isLoading;
  final String? error;
  final String? workspaceId;

  const OwnersState({
    required this.owners,
    this.searchQuery = '',
    this.isLoading = false,
    this.error,
    this.workspaceId,
  });

  List<OwnerModel> get filteredOwners {
    if (searchQuery.trim().isEmpty) return owners;
    final q = searchQuery.toLowerCase();
    return owners.where((o) {
      return o.name.toLowerCase().contains(q) || o.email.toLowerCase().contains(q);
    }).toList();
  }

  int get totalOwners => owners.length;

  int get pendingSetupCount =>
      owners.where((o) => o.setupStatus == 'NOT SET' || o.accountStatus == 'Account Pending').length;

  OwnersState copyWith({
    List<OwnerModel>? owners,
    String? searchQuery,
    bool? isLoading,
    String? error,
    String? workspaceId,
  }) {
    return OwnersState(
      owners: owners ?? this.owners,
      searchQuery: searchQuery ?? this.searchQuery,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      workspaceId: workspaceId ?? this.workspaceId,
    );
  }
}

class OwnersNotifier extends StateNotifier<OwnersState> {
  final OwnersRepository _repository;

  OwnersNotifier(this._repository, String? workspaceId)
      : super(OwnersState(owners: const [], workspaceId: workspaceId)) {
    if (workspaceId != null && workspaceId.isNotEmpty) {
      loadOwners();
    }
  }

  Future<void> loadOwners() async {
    final wsId = state.workspaceId;
    if (wsId == null || wsId.isEmpty) return;

    state = state.copyWith(isLoading: true, error: null);
    try {
      final list = await _repository.fetchOwners(wsId);
      state = state.copyWith(owners: list, isLoading: false);
    } catch (e) {
      debugPrint('[OwnersNotifier] loadOwners error: $e');
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  Future<Map<String, dynamic>?> addOwner({
    required String name,
    required String email,
    String? phone,
    String? password,
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    final wsId = state.workspaceId;
    if (wsId == null || wsId.isEmpty) return null;

    try {
      final res = await _repository.addOwner(
        wsId,
        name: name,
        email: email,
        password: password,
        payoutStrategy: payoutStrategy,
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
      );
      await loadOwners();
      return res;
    } catch (e) {
      debugPrint('[OwnersNotifier] addOwner error: $e');
      rethrow;
    }
  }

  Future<void> updateOwnerBankDetails({
    required String ownerId,
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) async {
    final wsId = state.workspaceId;
    if (wsId == null || wsId.isEmpty) return;

    try {
      await _repository.updateOwner(
        wsId,
        ownerId,
        payoutStrategy: payoutStrategy,
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
      );
      await loadOwners();
    } catch (e) {
      debugPrint('[OwnersNotifier] updateOwnerBankDetails error: $e');
      rethrow;
    }
  }

  Future<void> deleteOwner(String ownerId) async {
    final wsId = state.workspaceId;
    if (wsId == null || wsId.isEmpty) return;

    try {
      await _repository.deleteOwner(wsId, ownerId);
      await loadOwners();
    } catch (e) {
      debugPrint('[OwnersNotifier] deleteOwner error: $e');
      rethrow;
    }
  }
}

final ownersProvider = StateNotifierProvider<OwnersNotifier, OwnersState>((ref) {
  final repository = ref.watch(ownersRepositoryProvider);
  final authState = ref.watch(authStateProvider);
  final user = authState.valueOrNull;

  String? workspaceId;
  if (user != null && user.workspaces.isNotEmpty) {
    final member = user.workspaces.firstWhere(
      (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
      orElse: () => user.workspaces.first,
    );
    workspaceId = member.workspaceId;
  }

  return OwnersNotifier(repository, workspaceId);
});
