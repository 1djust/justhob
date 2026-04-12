// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$NotificationItemImpl _$$NotificationItemImplFromJson(
  Map<String, dynamic> json,
) => _$NotificationItemImpl(
  id: json['id'] as String,
  title: json['title'] as String,
  message: json['message'] as String,
  type: json['type'] as String,
  isRead: json['isRead'] as bool,
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$$NotificationItemImplToJson(
  _$NotificationItemImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'message': instance.message,
  'type': instance.type,
  'isRead': instance.isRead,
  'createdAt': instance.createdAt.toIso8601String(),
};
