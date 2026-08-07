import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../data/landlord_payments_repository.dart';
import '../../../../shared/domain/payment.dart';
import '../../../../core/network/socket_service.dart';

final landlordPaymentsProvider = StateNotifierProvider.autoDispose<
    LandlordPaymentsNotifier, AsyncValue<List<Payment>>>((ref) {
  final repository = ref.watch(landlordPaymentsRepositoryProvider);
  
  // Extract the landlord's active workspace ID dynamically from the auth state
  final authState = ref.watch(authStateProvider).valueOrNull;
  if (authState == null) {
    return LandlordPaymentsNotifier(repository, '');
  }

  final landlordWs = authState.workspaces.firstWhere(
    (m) => m.role == 'LANDLORD' || m.role == 'PROPERTY_MANAGER',
    orElse: () => authState.workspaces.first,
  );

  return LandlordPaymentsNotifier(repository, landlordWs.workspaceId);
});

class LandlordPaymentsNotifier extends StateNotifier<AsyncValue<List<Payment>>> {
  final LandlordPaymentsRepository _repository;
  final String _workspaceId;
  StreamSubscription? _socketSubscription;

  LandlordPaymentsNotifier(this._repository, this._workspaceId)
      : super(const AsyncValue.loading()) {
    if (_workspaceId.isNotEmpty) {
      SocketService().joinWorkspace(_workspaceId);
      fetchPayments();
      _listenToSocket();
    } else {
      state = const AsyncValue.data([]);
    }
  }

  void _listenToSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = SocketService().eventStream.listen((event) {
      final type = event['type'];
      if (type == 'PAYMENT_UPDATED' || type == 'PAYMENT_CREATED') {
        debugPrint('[LandlordPaymentsNotifier] Socket update: Refreshing payments...');
        fetchPayments();
      }
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    super.dispose();
  }

  Future<void> fetchPayments() async {
    if (_workspaceId.isEmpty) return;
    state = const AsyncValue.loading();
    try {
      final payments = await _repository.getPayments(_workspaceId);
      // Sort payments by due date descending
      payments.sort((a, b) => b.dueDate.compareTo(a.dueDate));
      state = AsyncValue.data(payments);
    } catch (e, stack) {
      debugPrint('[LandlordPaymentsNotifier] fetchPayments error: $e\n$stack');
      state = AsyncValue.error(e, stack);
    }
  }

  /// Reviews a payment proof with status 'PAID' (approve)
  Future<void> approvePayment(String paymentId, {double? approvedAmountPaid}) async {
    if (_workspaceId.isEmpty) return;
    try {
      await _repository.reviewPayment(
        workspaceId: _workspaceId,
        paymentId: paymentId,
        status: 'PAID',
        approvedAmountPaid: approvedAmountPaid,
      );
      // Refresh local list to show the updated status
      await fetchPayments();
    } catch (e) {
      debugPrint('[LandlordPaymentsNotifier] approvePayment error: $e');
      rethrow;
    }
  }

  /// Reviews a payment proof with status 'REJECTED' (reject)
  Future<void> rejectPayment(String paymentId, String reason) async {
    if (_workspaceId.isEmpty) return;
    try {
      await _repository.reviewPayment(
        workspaceId: _workspaceId,
        paymentId: paymentId,
        status: 'REJECTED',
        rejectionReason: reason,
      );
      // Refresh local list
      await fetchPayments();
    } catch (e) {
      debugPrint('[LandlordPaymentsNotifier] rejectPayment error: $e');
      rethrow;
    }
  }
}
