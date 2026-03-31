import 'package:freezed_annotation/freezed_annotation.dart';
import 'property.dart';

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
    Property? property,
  }) = _Lease;

  factory Lease.fromJson(Map<String, dynamic> json) => _$LeaseFromJson(json);
}
