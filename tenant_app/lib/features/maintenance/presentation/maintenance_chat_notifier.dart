import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/socket_service.dart';
import '../../home/data/tenant_repository.dart';
import '../../../../shared/domain/maintenance_message.dart';
import '../../../../core/network/api_client.dart';
import '../../auth/presentation/auth_notifier.dart';

final maintenanceChatProvider = StateNotifierProvider.family<MaintenanceChatNotifier, AsyncValue<List<MaintenanceMessage>>, String>((ref, requestId) {
  final repository = TenantRepository(ApiClient());
  final user = ref.watch(authStateProvider).value;
  final workspaceId = user?.workspaces.firstOrNull?.workspaceId ?? '';
  return MaintenanceChatNotifier(repository, requestId, workspaceId, SocketService());
});

class MaintenanceChatNotifier extends StateNotifier<AsyncValue<List<MaintenanceMessage>>> {
  final TenantRepository _repository;
  final String _requestId;
  final String _workspaceId;
  final SocketService _socketService;
  StreamSubscription? _socketSubscription;

  MaintenanceChatNotifier(this._repository, this._requestId, this._workspaceId, this._socketService) : super(const AsyncValue.loading()) {
    fetchMessages();
    _initSocket();
  }

  Future<void> fetchMessages() async {
    try {
      final messages = await _repository.getMaintenanceMessages(_requestId);
      state = AsyncValue.data(messages);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  void _initSocket() {
    _socketService.joinMaintenanceRoom(_workspaceId, _requestId);
    
    _socketSubscription = _socketService.eventStream.listen((event) {
      if (event['type'] == 'maintenance-message') {
        final messageData = event['data'];
        if (messageData['requestId'] == _requestId) {
          final message = MaintenanceMessage.fromJson(messageData);
          
          state.whenData((currentMessages) {
            // Avoid adding duplicate if we sent it and it's already in the list
            if (!currentMessages.any((m) => m.id == message.id)) {
              state = AsyncValue.data([...currentMessages, message]);
            }
          });
        }
      }
    });
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty) return;
    try {
      await _repository.sendMaintenanceMessage(_requestId, content);
      // The message will be added via the socket listener
    } catch (e) {
      debugPrint('[Chat] Error sending message: $e');
      rethrow;
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _socketService.leaveMaintenanceRoom(_requestId);
    super.dispose();
  }
}
