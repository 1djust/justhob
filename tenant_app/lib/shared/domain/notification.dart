import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

@freezed
class NotificationItem with _$NotificationItem {
  const factory NotificationItem({
    required String id,
    required String title,
    required String message,
    required String type,
    required bool isRead,
    required DateTime createdAt,
  }) = _NotificationItem;

  factory NotificationItem.fromJson(Map<String, dynamic> json) => _$NotificationItemFromJson(json);
}
