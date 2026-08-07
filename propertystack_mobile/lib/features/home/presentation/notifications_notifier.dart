import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import '../data/notification_repository.dart';
import '../../../../shared/domain/notification.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/socket_service.dart';

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, AsyncValue<List<NotificationItem>>>((ref) {
  return NotificationsNotifier(NotificationRepository(ApiClient()));
});

class NotificationsNotifier extends StateNotifier<AsyncValue<List<NotificationItem>>> {
  final NotificationRepository _repository;
  StreamSubscription? _socketSubscription;
  Timer? _pollTimer;

  NotificationsNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchNotifications();
    _listenToSocket();
    _startPolling();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      fetchNotifications();
    });
  }

  void _listenToSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = SocketService().eventStream.listen((event) {
      final type = event['type'];
      if (type == 'socket-connected' || type == 'NOTIFICATION_CREATED' || type == 'LEASE_RENEWAL_OFFER') {
        debugPrint('[NotificationsNotifier] Socket update ($type): Refreshing notifications...');
        fetchNotifications();
      }
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> fetchNotifications() async {
    try {
      final notifications = await _repository.getNotifications();
      // Sort by creation date descending
      notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      if (mounted) {
        state = AsyncValue.data(notifications);
      }
    } catch (e, stack) {
      debugPrint('Caught error: $stack');
      if (mounted) {
        state = AsyncValue.error(e, stack);
      }
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _repository.markAllAsRead();
      final currentData = state.value ?? [];
      state = AsyncValue.data(
        currentData.map((n) => n.copyWith(isRead: true)).toList(),
      );
    } catch (e, stack) {
      debugPrint('Error marking all as read: $e\n$stack');
      rethrow;
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      await _repository.markAsRead(id);
      final currentData = state.value ?? [];
      state = AsyncValue.data(
        currentData.map((n) => n.id == id ? n.copyWith(isRead: true) : n).toList(),
      );
    } catch (e, stack) {
      debugPrint('Error marking as read: $e\n$stack');
      rethrow;
    }
  }

  int get unreadCount {
    return state.value?.where((n) => !n.isRead).length ?? 0;
  }
}
