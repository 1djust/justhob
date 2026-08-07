import 'dart:convert';
import 'lib/shared/domain/tenant.dart';

void main() {
  const jsonStr = '''{
    "id": "tenant-001",
    "name": "John Doe",
    "email": "tenant@justhob.com",
    "phone": "555-0100",
    "workspaceId": "test-workspace-001",
    "allowPartialPayments": true,
    "leases": [
      {
        "id": "test-lease-001",
        "tenantId": "tenant-001",
        "propertyId": "test-property-001",
        "unitId": "test-unit-001",
        "startDate": "2025-06-03T00:00:00.000Z",
        "endDate": "2026-06-03T00:00:00.000Z",
        "yearlyRent": 2400000,
        "paymentFrequency": "YEARLY",
        "status": "ACTIVE",
        "createdAt": "2026-06-03T21:03:26.790Z",
        "updatedAt": "2026-06-03T21:03:26.790Z",
        "deletedAt": null,
        "paymentInfo": {
          "id": "test-pay-info-001",
          "leaseId": "test-lease-001",
          "bankName": "Guaranty Trust Bank",
          "accountName": "PropertyStack Ltd",
          "accountNumber": "0123456789",
          "createdAt": "2026-06-03T21:03:26.796Z",
          "updatedAt": "2026-06-03T21:03:26.796Z"
        }
      }
    ]
  }''';

  try {
    final tenantJson = jsonDecode(jsonStr);
    final tenant = Tenant.fromJson(tenantJson);
    print('Parsed successfully: ${tenant.id}');
    print(tenant);
  } catch (e) {
    print('Error parsing tenant: $e');
  }
}
