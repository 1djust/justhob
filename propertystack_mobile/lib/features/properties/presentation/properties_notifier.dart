import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/properties_repository.dart';
import '../domain/property_model.dart';

final propertiesProvider = FutureProvider<List<PropertyModel>>((ref) async {
  final authState = ref.watch(authStateProvider);
  final user = authState.valueOrNull;

  if (user == null) return [];

  final landlordWorkspaces = user.workspaces
      .where((m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER')
      .toList();

  if (landlordWorkspaces.isEmpty) return [];

  final activeWorkspace = landlordWorkspaces.first;
  final repository = ref.watch(propertiesRepositoryProvider);

  return repository.getProperties(activeWorkspace.workspaceId);
});
