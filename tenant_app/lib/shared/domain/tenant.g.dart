// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tenant.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TenantImpl _$$TenantImplFromJson(Map<String, dynamic> json) => _$TenantImpl(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String?,
  phone: json['phone'] as String?,
  workspaceId: json['workspaceId'] as String,
  leases: (json['leases'] as List<dynamic>?)
      ?.map((e) => Lease.fromJson(e as Map<String, dynamic>))
      .toList(),
  maintenanceRequests: (json['maintenanceRequests'] as List<dynamic>?)
      ?.map((e) => MaintenanceRequest.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$$TenantImplToJson(_$TenantImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
      'workspaceId': instance.workspaceId,
      'leases': instance.leases,
      'maintenanceRequests': instance.maintenanceRequests,
    };
