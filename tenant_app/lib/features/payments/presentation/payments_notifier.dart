import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../home/data/tenant_repository.dart';
import '../../../../shared/domain/payment.dart';
import '../../../../core/network/api_client.dart';

final paymentsProvider = StateNotifierProvider<PaymentsNotifier, AsyncValue<List<Payment>>>((ref) {
  return PaymentsNotifier(TenantRepository(ApiClient()));
});

class PaymentsNotifier extends StateNotifier<AsyncValue<List<Payment>>> {
  final TenantRepository _repository;

  PaymentsNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchPayments();
  }

  Future<void> fetchPayments() async {
    state = const AsyncValue.loading();
    try {
      final payments = await _repository.getPayments();
      // Sort by due date descending
      payments.sort((a, b) => b.dueDate.compareTo(a.dueDate));
      state = AsyncValue.data(payments);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<String> processPayment(String leaseId, double amount) async {
    try {
      final url = await _repository.createPayment(amount: amount, leaseId: leaseId);
      // We don't fetch payments immediately because they need to complete it in browser first
      return url;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> submitProof(String paymentId, String base64Image, {String? note}) async {
    try {
      await _repository.uploadPaymentProof(
        paymentId: paymentId,
        base64Image: base64Image,
        note: note,
      );
      // Fetch latest payments to reflect the UNDER_REVIEW status
      await fetchPayments();
    } catch (e) {
      rethrow;
    }
  }

  /// Creates a new payment record and immediately submits proof of payment.
  /// This is the primary flow for tenants submitting rent proof.
  Future<void> createAndSubmitProof({
    required String leaseId,
    required double amount,
    required String base64Image,
    String? note,
  }) async {
    try {
      // Step 1: Create the payment record
      final paymentId = await _repository.createPaymentRecord(
        amount: amount,
        leaseId: leaseId,
        note: note,
      );

      // Step 2: Submit the proof image to the newly created payment
      await _repository.uploadPaymentProof(
        paymentId: paymentId,
        base64Image: base64Image,
        note: note,
      );

      // Refresh the list
      await fetchPayments();
    } catch (e) {
      rethrow;
    }
  }
}
