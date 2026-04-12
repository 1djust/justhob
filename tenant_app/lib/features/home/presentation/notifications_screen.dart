import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'notifications_notifier.dart';
import 'package:intl/intl.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsState = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => ref.read(notificationsProvider.notifier).markAllAsRead(),
            child: const Text('Mark all as read'),
          ),
        ],
      ),
      body: notificationsState.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none_outlined, size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text(
                    'No notifications yet',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(notificationsProvider.notifier).fetchNotifications(),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notifications.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return _NotificationTile(notification: notification);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  final dynamic notification;

  const _NotificationTile({required this.notification});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    IconData icon;
    Color iconColor;

    switch (notification.type) {
      case 'PAYMENT_APPROVED':
        icon = Icons.check_circle_outline;
        iconColor = Colors.green;
        break;
      case 'PAYMENT_REJECTED':
        icon = Icons.error_outline;
        iconColor = Colors.red;
        break;
      case 'PAYMENT_SUBMITTED':
        icon = Icons.upload_file_outlined;
        iconColor = Colors.blue;
        break;
      default:
        icon = Icons.notifications_outlined;
        iconColor = Colors.grey;
    }

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: iconColor.withValues(alpha: 0.1),
        child: Icon(icon, color: iconColor, size: 24),
      ),
      title: Text(
        notification.title,
        style: TextStyle(
          fontWeight: notification.isRead ? FontWeight.normal : FontWeight.bold,
          fontSize: 15,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          Text(
            notification.message,
            style: TextStyle(
              color: notification.isRead ? Colors.grey.shade600 : Colors.black87,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            DateFormat.yMMMd().add_jm().format(notification.createdAt),
            style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
          ),
        ],
      ),
      trailing: !notification.isRead
          ? Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Colors.blue,
                shape: BoxShape.circle,
              ),
            )
          : null,
      onTap: () {
        if (!notification.isRead) {
          ref.read(notificationsProvider.notifier).markAsRead(notification.id);
        }
      },
    );
  }
}
