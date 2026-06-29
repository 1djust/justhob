import 'package:freezed_annotation/freezed_annotation.dart';
import 'property.dart';
import 'payment_info.dart';
import 'lease_renewal_offer.dart';

part 'lease.freezed.dart';
part 'lease.g.dart';

@freezed
class Lease with _$Lease {
  const factory Lease({
    required String id,
    required String tenantId,
    required String propertyId,
    required DateTime startDate,
    DateTime? endDate,
    required double yearlyRent,
    required String status,
    String? agreementText,
    String? rejectionReason,
    String? signatureUrl,
    String? managerSignature,
    String? legalDocUrl,
    Property? property,
    PaymentInfo? paymentInfo,
    List<LeaseRenewalOffer>? renewalOffers,
  }) = _Lease;

  factory Lease.fromJson(Map<String, dynamic> json) => _$LeaseFromJson(json);
}
