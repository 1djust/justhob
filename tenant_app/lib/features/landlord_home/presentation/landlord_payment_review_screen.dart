import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'landlord_payments_notifier.dart';
import '../../../../shared/domain/payment.dart';
import '../../../../core/theme/app_theme.dart';
import '../../auth/presentation/auth_notifier.dart';

class LandlordPaymentReviewScreen extends ConsumerStatefulWidget {
  final Payment payment;

  const LandlordPaymentReviewScreen({
    super.key,
    required this.payment,
  });

  @override
  ConsumerState<LandlordPaymentReviewScreen> createState() => _LandlordPaymentReviewScreenState();
}

class _LandlordPaymentReviewScreenState extends ConsumerState<LandlordPaymentReviewScreen> {
  final TextEditingController _rejectionController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _rejectionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final paymentsAsync = ref.watch(landlordPaymentsProvider);
    final payment = paymentsAsync.maybeWhen(
      data: (list) => list.firstWhere(
        (p) => p.id == widget.payment.id,
        orElse: () => widget.payment,
      ),
      orElse: () => widget.payment,
    );
    final theme = Theme.of(context);
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final dateFormatter = DateFormat('MMMM d, yyyy');

    final leaseMap = payment.lease;
    final tenantName = leaseMap?['tenant']?['name'] ?? 'Unknown Tenant';
    final propertyName = leaseMap?['property']?['name'] ?? 'Unknown Property';

    final authState = ref.watch(authStateProvider);
    final bool isPropertyManager = authState.maybeWhen(
      data: (user) {
        if (user == null) return false;
        return user.workspaces.any((m) => m.role == 'PROPERTY_MANAGER');
      },
      orElse: () => false,
    );

    // Parse proof bytes
    ImageProvider? proofImage;
    if (payment.proofUrl != null && payment.proofUrl!.startsWith('data:image')) {
      try {
        final commaIndex = payment.proofUrl!.indexOf(',');
        if (commaIndex != -1) {
          final base64Str = payment.proofUrl!.substring(commaIndex + 1);
          final bytes = base64Decode(base64Str);
          proofImage = MemoryImage(bytes);
        }
      } catch (e) {
        debugPrint('[LandlordPaymentReviewScreen] Error parsing base64 image: $e');
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Verify Payment'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Tenant & Property info card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TENANT',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      tenantName,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      propertyName,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Payment metadata card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    _buildDetailRow(
                      context,
                      label: 'Amount Due',
                      value: currencyFormatter.format(payment.amount),
                      isBold: true,
                    ),
                    const Divider(height: 24),
                    _buildDetailRow(
                      context,
                      label: 'Due Date',
                      value: dateFormatter.format(payment.dueDate),
                    ),
                    const Divider(height: 24),
                    _buildDetailRow(
                      context,
                      label: 'Current Status',
                      value: payment.status,
                      customColor: _getStatusColor(payment.status),
                    ),
                    const Divider(height: 24),
                    _buildDetailRow(
                      context,
                      label: 'Payment ID',
                      value: payment.id,
                    ),
                    const Divider(height: 24),
                    _buildDetailRow(
                      context,
                      label: 'Payment Method',
                      value: payment.proofUrl != null ? 'Bank Transfer' : (payment.status == 'PAID' ? 'Online Payment' : 'TBD'),
                    ),
                    if (payment.amountPaid != null) ...[
                      const Divider(height: 24),
                      _buildDetailRow(
                        context,
                        label: 'Submitted Amount Paid',
                        value: currencyFormatter.format(payment.amountPaid!),
                        isBold: true,
                        customColor: Colors.blue,
                      ),
                    ],
                    if (payment.promiseDate != null) ...[
                      const Divider(height: 24),
                      _buildDetailRow(
                        context,
                        label: 'Balance Promise Date',
                        value: dateFormatter.format(payment.promiseDate!),
                      ),
                    ],
                    if (payment.note != null && payment.note!.isNotEmpty) ...[
                      const Divider(height: 24),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Tenant Note',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: AppTheme.textSecondary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12.0),
                            decoration: BoxDecoration(
                              color: AppTheme.cardColor,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Text(
                              payment.note!,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Proof Image Preview
            Text(
              'Submitted Receipt',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            if (proofImage != null)
              Container(
                height: 240,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: () {
                      _showFullScreenImage(context, proofImage!);
                    },
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image(image: proofImage, fit: BoxFit.cover),
                        Positioned(
                          right: 12,
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black.withAlpha(160),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.zoom_out_map, color: Colors.white, size: 14),
                                const SizedBox(width: 4),
                                Text(
                                  'Tap to view',
                                  style: theme.textTheme.labelSmall?.copyWith(color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              Container(
                height: 140,
                decoration: BoxDecoration(
                  color: AppTheme.cardColor,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.image_not_supported_outlined, color: AppTheme.textSecondary, size: 36),
                    const SizedBox(height: 8),
                    Text(
                      'No receipt uploaded by tenant',
                      style: theme.textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 32),

            // Submit Buttons (if UNDER_REVIEW and has manager permissions)
            if (payment.status == 'UNDER_REVIEW' && isPropertyManager)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => _showRejectionDialog(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 14.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('REJECT'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _handleApprove,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14.0),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('APPROVE'),
                    ),
                  ),
                ],
              )
            else
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _getStatusColor(payment.status).withAlpha(15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _getStatusColor(payment.status).withAlpha(30)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      payment.status == 'PAID'
                          ? Icons.check_circle_outline
                          : (payment.status == 'UNDER_REVIEW'
                              ? Icons.hourglass_empty_outlined
                              : Icons.error_outline),
                      color: _getStatusColor(payment.status),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      payment.status == 'PAID'
                          ? 'This payment has been approved and logged.'
                          : (payment.status == 'UNDER_REVIEW'
                              ? 'Pending verification by the property manager.'
                              : 'This transaction request was rejected.'),
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: _getStatusColor(payment.status),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    BuildContext context, {
    required String label,
    required String value,
    bool isBold = false,
    Color? customColor,
  }) {
    final theme = Theme.of(context);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppTheme.textSecondary,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: theme.textTheme.bodyLarge?.copyWith(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: customColor ?? AppTheme.textPrimary,
            ),
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'PAID':
        return const Color(0xFF10B981);
      case 'PARTIALLY_PAID':
        return Colors.blue;
      case 'UNDER_REVIEW':
        return Colors.orange;
      case 'OVERDUE':
        return Colors.red;
      default:
        return AppTheme.textSecondary;
    }
  }

  Future<void> _handleApprove() async {
    setState(() => _isSubmitting = true);
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final notifier = ref.read(landlordPaymentsProvider.notifier);
      await notifier.approvePayment(widget.payment.id, approvedAmountPaid: widget.payment.amountPaid);
      
      if (mounted) {
        scaffoldMessenger.showSnackBar(
          const SnackBar(content: Text('Payment approved successfully!')),
        );
        navigator.pop();
      }
    } catch (e) {
      if (mounted) {
        scaffoldMessenger.showSnackBar(
          SnackBar(content: Text('Failed to approve: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showRejectionDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Payment Proof'),
        content: Form(
          key: _formKey,
          child: TextFormField(
            controller: _rejectionController,
            decoration: const InputDecoration(
              labelText: 'Rejection Reason',
              hintText: 'e.g. Invalid transaction reference',
            ),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'Please provide a reason';
              }
              return null;
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (_formKey.currentState?.validate() == true) {
                final scaffoldMessenger = ScaffoldMessenger.of(context);
                final navigator = Navigator.of(context);
                Navigator.of(ctx).pop();
                setState(() => _isSubmitting = true);
                try {
                  final notifier = ref.read(landlordPaymentsProvider.notifier);
                  await notifier.rejectPayment(widget.payment.id, _rejectionController.text.trim());
                  
                  if (mounted) {
                    scaffoldMessenger.showSnackBar(
                      const SnackBar(content: Text('Payment proof rejected.')),
                    );
                    navigator.pop();
                  }
                } catch (e) {
                  if (mounted) {
                    scaffoldMessenger.showSnackBar(
                      SnackBar(content: Text('Failed to reject: $e')),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isSubmitting = false);
                }
              }
            },
            child: const Text('SUBMIT'),
          ),
        ],
      ),
    );
  }

  void _showFullScreenImage(BuildContext context, ImageProvider image) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => Scaffold(
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
            elevation: 0,
          ),
          backgroundColor: Colors.black,
          body: Center(
            child: InteractiveViewer(
              child: Image(image: image, fit: BoxFit.contain),
            ),
          ),
        ),
      ),
    );
  }
}
