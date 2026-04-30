import 'package:freezed_annotation/freezed_annotation.dart';

part 'payment_info.freezed.dart';
part 'payment_info.g.dart';

@freezed
class PaymentInfo with _$PaymentInfo {
  const factory PaymentInfo({
    String? payoutStrategy,
    String? bankCode,
    String? accountNumber,
    String? accountName,
  }) = _PaymentInfo;

  factory PaymentInfo.fromJson(Map<String, dynamic> json) => _$PaymentInfoFromJson(json);
}
