// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'maintenance_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MaintenanceRequestImpl _$$MaintenanceRequestImplFromJson(
  Map<String, dynamic> json,
) => _$MaintenanceRequestImpl(
  id: json['id'] as String,
  description: json['description'] as String,
  imageUrl: json['imageUrl'] as String?,
  status: json['status'] as String,
  createdAt: DateTime.parse(json['createdAt'] as String),
  propertyId: json['propertyId'] as String,
);

Map<String, dynamic> _$$MaintenanceRequestImplToJson(
  _$MaintenanceRequestImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'description': instance.description,
  'imageUrl': instance.imageUrl,
  'status': instance.status,
  'createdAt': instance.createdAt.toIso8601String(),
  'propertyId': instance.propertyId,
};
