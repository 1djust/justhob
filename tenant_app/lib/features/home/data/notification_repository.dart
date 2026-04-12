import '../../../../core/network/api_client.dart';
import '../../../../shared/domain/notification.dart';

class NotificationRepository {
  final ApiClient _apiClient;

  NotificationRepository(this._apiClient);

  Future<List<NotificationItem>> getNotifications() async {
    final response = await _apiClient.dio.get('/notifications');
    final List data = response.data['notifications'];
    return data.map((json) => NotificationItem.fromJson(json)).toList();
  }

  Future<void> markAllAsRead() async {
    await _apiClient.dio.patch('/notifications/read-all');
  }

  Future<void> markAsRead(String id) async {
    await _apiClient.dio.patch('/notifications/$id/read');
  }
}
