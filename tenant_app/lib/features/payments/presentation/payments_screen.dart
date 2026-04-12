import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'payments_notifier.dart';
import 'package:intl/intl.dart';

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsState = ref.watch(paymentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payments'),
      ),
      body: paymentsState.when(
        data: (payments) {
          if (payments.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text(
                    'No payment history found',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(paymentsProvider.notifier).fetchPayments(),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              itemCount: payments.length,
              separatorBuilder: (context, index) => const SizedBox(height: 16),
              itemBuilder: (context, index) {
                final payment = payments[index];
                return _PaymentCard(payment: payment);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 16),
              const Text('Failed to load payments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              Text('$err', style: TextStyle(color: Colors.grey.shade600), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.read(paymentsProvider.notifier).fetchPayments(),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PaymentCard extends ConsumerStatefulWidget {
  final dynamic payment;

  const _PaymentCard({required this.payment});

  @override
  ConsumerState<_PaymentCard> createState() => _PaymentCardState();
}

class _PaymentCardState extends ConsumerState<_PaymentCard> {
  bool _isLoading = false;

  Future<void> _handlePayment() async {
    setState(() => _isLoading = true);
    try {
      final url = await ref.read(paymentsProvider.notifier).processPayment(
        widget.payment.leaseId,
        widget.payment.amount,
      );
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open payment gateway.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error initiating payment: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _submitProofOfPayment() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    
    if (image == null) return;
    
    final bytes = await image.readAsBytes();
    final base64Str = base64Encode(bytes);
    
    setState(() => _isLoading = true);
    try {
      await ref.read(paymentsProvider.notifier).submitProof(widget.payment.id, base64Str);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Proof submitted and is pending review.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error submitting proof: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final payment = widget.payment;
    final isPaid = payment.status == 'PAID' || payment.status == 'COMPLETED';
    final isUnderReview = payment.status == 'UNDER_REVIEW';
    final isRejected = payment.status == 'REJECTED';
    final isOverdue = (!isPaid && !isUnderReview) && payment.dueDate.isBefore(DateTime.now());

    Color statusColor;
    if (isPaid) {
      statusColor = Colors.green.shade600;
    } else if (isUnderReview) {
      statusColor = Colors.blue.shade500;
    } else if (isRejected || isOverdue) {
      statusColor = Colors.red.shade500;
    } else {
      statusColor = Colors.orange.shade500;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isPaid ? Icons.check_circle_outline 
                    : isUnderReview ? Icons.hourglass_top
                    : (isOverdue ? Icons.warning_amber_rounded : Icons.pending_actions_outlined),
                    color: statusColor,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(payment.amount),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: -0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Due: ${DateFormat.yMMMd().format(payment.dueDate)}',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    payment.status.replaceAll('_', ' '),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            if (isRejected && payment.rejectionReason != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Rejected: ${payment.rejectionReason}',
                        style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (!isPaid && !isUnderReview) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isLoading ? null : _submitProofOfPayment,
                      icon: const Icon(Icons.upload_file),
                      label: const Text('Upload Proof'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handlePayment,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: _isLoading 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Pay Online', style: TextStyle(fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ]
          ],
        ),
      ),
    );
  }
}
