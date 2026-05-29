// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lease_renewal_offer.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$LeaseRenewalOfferImpl _$$LeaseRenewalOfferImplFromJson(
        Map<String, dynamic> json) =>
    _$LeaseRenewalOfferImpl(
      id: json['id'] as String,
      leaseId: json['leaseId'] as String,
      newRent: (json['newRent'] as num).toDouble(),
      newStartDate: DateTime.parse(json['newStartDate'] as String),
      newEndDate: DateTime.parse(json['newEndDate'] as String),
      terms: json['terms'] as String?,
      status: json['status'] as String,
      sentAt: DateTime.parse(json['sentAt'] as String),
      respondedAt: json['respondedAt'] == null
          ? null
          : DateTime.parse(json['respondedAt'] as String),
    );

Map<String, dynamic> _$$LeaseRenewalOfferImplToJson(
        _$LeaseRenewalOfferImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'leaseId': instance.leaseId,
      'newRent': instance.newRent,
      'newStartDate': instance.newStartDate.toIso8601String(),
      'newEndDate': instance.newEndDate.toIso8601String(),
      'terms': instance.terms,
      'status': instance.status,
      'sentAt': instance.sentAt.toIso8601String(),
      'respondedAt': instance.respondedAt?.toIso8601String(),
    };
