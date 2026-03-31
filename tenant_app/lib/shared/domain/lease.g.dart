// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lease.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$LeaseImpl _$$LeaseImplFromJson(Map<String, dynamic> json) => _$LeaseImpl(
  id: json['id'] as String,
  tenantId: json['tenantId'] as String,
  propertyId: json['propertyId'] as String,
  startDate: DateTime.parse(json['startDate'] as String),
  endDate: json['endDate'] == null
      ? null
      : DateTime.parse(json['endDate'] as String),
  yearlyRent: (json['yearlyRent'] as num).toDouble(),
  status: json['status'] as String,
  property: json['property'] == null
      ? null
      : Property.fromJson(json['property'] as Map<String, dynamic>),
);

Map<String, dynamic> _$$LeaseImplToJson(_$LeaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'tenantId': instance.tenantId,
      'propertyId': instance.propertyId,
      'startDate': instance.startDate.toIso8601String(),
      'endDate': instance.endDate?.toIso8601String(),
      'yearlyRent': instance.yearlyRent,
      'status': instance.status,
      'property': instance.property,
    };
