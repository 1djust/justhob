import 'dart:convert';
import 'lib/shared/domain/payment.dart';

void main() {
  const jsonStr = '''{
    "id": "a3704a50-1469-4d9a-a8cb-ffee918f514e",
    "leaseId": "test-lease-001",
    "amount": 2400000,
    "dueDate": "2026-05-03T23:00:00.000Z",
    "paidDate": null,
    "status": "OVERDUE",
    "note": "Overdue Rent",
    "rrr": null,
    "transactionId": null,
    "paymentUrl": null,
    "createdAt": "2026-06-03T21:03:26.822Z",
    "updatedAt": "2026-06-05T00:01:06.848Z",
    "proofUrl": null,
    "receiptId": null,
    "rejectionReason": null,
    "workspaceId": "test-workspace-001",
    "amountPaid": null,
    "balanceNote": null,
    "balancePromise": null,
    "paymentPlanRequested": false,
    "paymentPlanStatus": null,
    "evictionDate": "2026-06-12T00:00:00.000Z",
    "gracePeriodEnd": "2026-08-03T23:00:00.000Z",
    "evictionNoticeSent": true
  }''';

  try {
    final paymentJson = jsonDecode(jsonStr);
    final payment = Payment.fromJson(paymentJson);
    print('Parsed successfully: ${payment.id}');
    print(payment);
  } catch (e) {
    print('Error parsing payment: $e');
  }
}
