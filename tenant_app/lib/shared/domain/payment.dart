import 'package:freezed_annotation/freezed_annotation.dart';

part 'payment.freezed.dart';
part 'payment.g.dart';

@freezed
class Payment with _$Payment {
  const factory Payment({
    required String id,
    required double amount,
    required DateTime dueDate,
    DateTime? paidDate,
    required String leaseId,
    required String status,
    String? note,
    String? proofUrl,
    String? rejectionReason,
    String? receiptId,
  }) = _Payment;

  factory Payment.fromJson(Map<String, dynamic> json) => _$PaymentFromJson(json);
}
