import 'package:freezed_annotation/freezed_annotation.dart';
import 'lease.dart';
import 'maintenance_request.dart';

part 'tenant.freezed.dart';
part 'tenant.g.dart';

@freezed
class Tenant with _$Tenant {
  const factory Tenant({
    required String id,
    required String name,
    String? email,
    String? phone,
    required String workspaceId,
    List<Lease>? leases,
    List<MaintenanceRequest>? maintenanceRequests,
  }) = _Tenant;

  factory Tenant.fromJson(Map<String, dynamic> json) => _$TenantFromJson(json);
}
