// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'maintenance_message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MaintenanceMessageImpl _$$MaintenanceMessageImplFromJson(
  Map<String, dynamic> json,
) => _$MaintenanceMessageImpl(
  id: json['id'] as String,
  content: json['content'] as String,
  type: json['type'] as String? ?? 'USER',
  requestId: json['requestId'] as String,
  senderId: json['senderId'] as String?,
  sender: json['sender'] as Map<String, dynamic>?,
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$$MaintenanceMessageImplToJson(
  _$MaintenanceMessageImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'content': instance.content,
  'type': instance.type,
  'requestId': instance.requestId,
  'senderId': instance.senderId,
  'sender': instance.sender,
  'createdAt': instance.createdAt.toIso8601String(),
};
