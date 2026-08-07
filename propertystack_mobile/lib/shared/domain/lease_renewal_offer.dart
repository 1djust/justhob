import 'package:freezed_annotation/freezed_annotation.dart';

part 'lease_renewal_offer.freezed.dart';
part 'lease_renewal_offer.g.dart';

@freezed
class LeaseRenewalOffer with _$LeaseRenewalOffer {
  const factory LeaseRenewalOffer({
    required String id,
    required String leaseId,
    required double newRent,
    required DateTime newStartDate,
    required DateTime newEndDate,
    String? terms,
    required String status,
    required DateTime sentAt,
    DateTime? respondedAt,
  }) = _LeaseRenewalOffer;

  factory LeaseRenewalOffer.fromJson(Map<String, dynamic> json) => _$LeaseRenewalOfferFromJson(json);
}
