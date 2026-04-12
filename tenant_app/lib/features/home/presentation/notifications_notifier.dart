import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/notification_repository.dart';
import '../../../../shared/domain/notification.dart';
import '../../../../core/network/api_client.dart';

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, AsyncValue<List<NotificationItem>>>((ref) {
  return NotificationsNotifier(NotificationRepository(ApiClient()));
});

class NotificationsNotifier extends StateNotifier<AsyncValue<List<NotificationItem>>> {
  final NotificationRepository _repository;

  NotificationsNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchNotifications();
  }

  Future<void> fetchNotifications() async {
    state = const AsyncValue.loading();
    try {
      final notifications = await _repository.getNotifications();
      // Sort by creation date descending
      notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = AsyncValue.data(notifications);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _repository.markAllAsRead();
      final currentData = state.value ?? [];
      state = AsyncValue.data(
        currentData.map((n) => n.copyWith(isRead: true)).toList(),
      );
    } catch (e) {
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
    } catch (e) {
      rethrow;
    }
  }

  int get unreadCount {
    return state.value?.where((n) => !n.isRead).length ?? 0;
  }
}
