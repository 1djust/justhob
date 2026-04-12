// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PaymentImpl _$$PaymentImplFromJson(Map<String, dynamic> json) =>
    _$PaymentImpl(
      id: json['id'] as String,
      amount: (json['amount'] as num).toDouble(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      paidDate: json['paidDate'] == null
          ? null
          : DateTime.parse(json['paidDate'] as String),
      leaseId: json['leaseId'] as String,
      status: json['status'] as String,
      note: json['note'] as String?,
      proofUrl: json['proofUrl'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      receiptId: json['receiptId'] as String?,
    );

Map<String, dynamic> _$$PaymentImplToJson(_$PaymentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
      'dueDate': instance.dueDate.toIso8601String(),
      'paidDate': instance.paidDate?.toIso8601String(),
      'leaseId': instance.leaseId,
      'status': instance.status,
      'note': instance.note,
      'proofUrl': instance.proofUrl,
      'rejectionReason': instance.rejectionReason,
      'receiptId': instance.receiptId,
    };
