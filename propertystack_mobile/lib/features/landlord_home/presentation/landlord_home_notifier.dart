import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/landlord_home_repository.dart';
import '../data/landlord_stats.dart';

final landlordStatsProvider = FutureProvider<LandlordStats?>((ref) async {
  final authState = ref.watch(authStateProvider);
  final user = authState.valueOrNull;

  if (user == null) return null;

  final landlordWorkspaces = user.workspaces
      .where((m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER')
      .toList();

  if (landlordWorkspaces.isEmpty) return null;

  final activeWorkspace = landlordWorkspaces.first;
  final repository = ref.watch(landlordHomeRepositoryProvider);

  return repository.getWorkspaceStats(activeWorkspace.workspaceId);
});
