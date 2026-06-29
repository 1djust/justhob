import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:tenant_app/core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../../home/presentation/home_notifier.dart';
import '../../../shared/domain/payment.dart';
import '../../../shared/domain/property.dart';
import '../presentation/payments_notifier.dart';
import '../../../core/services/receipt_service.dart';
import '../../../core/utils/nigerian_banks.dart';
import '../../../core/utils/error_message.dart';
import '../../../core/widgets/app_loading_indicator.dart';

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsState = ref.watch(paymentsProvider);
    final homeState = ref.watch(homeStateProvider);
    final tenant = homeState.valueOrNull;

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
                  const SizedBox(height: 8),
                  Text(
                    'Tap + to submit your proof of payment',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(homeStateProvider.notifier).refresh();
              await ref.read(paymentsProvider.notifier).fetchPayments();
            },
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              children: [
                // Payment Account Card
                if (tenant != null && tenant.leases != null && tenant.leases!.isNotEmpty && tenant.leases!.first.paymentInfo != null)
                  _PaymentAccountCard(paymentInfo: tenant.leases!.first.paymentInfo!),
                
                const SizedBox(height: 24),
                
                Text(
                  'Payment History',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(height: 12),

                ...payments.map((payment) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _PaymentCard(payment: payment),
                )),
              ],
            ),
          );
        },
        loading: () => const AppLoadingIndicator(),
        error: (err, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 16),
              const Text('Failed to load payments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Text(getFriendlyErrorMessage(err), style: TextStyle(color: Colors.grey.shade600), textAlign: TextAlign.center),
              ),
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSubmitProofSheet(context, ref),
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Submit Proof'),
        backgroundColor: AppTheme.textPrimary,
        foregroundColor: Colors.white,
        elevation: 3,
      ),
    );
  }

  void _showSubmitProofSheet(BuildContext context, WidgetRef ref) {
    final homeState = ref.read(homeStateProvider);
    final tenant = homeState.valueOrNull;

    if (tenant == null || tenant.leases == null || tenant.leases!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No active lease found. Contact your property manager.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SubmitProofSheet(
        leases: tenant.leases!,
        allowPartialPayments: tenant.allowPartialPayments ?? false,
        onSubmit: (leaseId, amount, base64Image, note, amountPaid, promiseDate) async {
          Navigator.of(ctx).pop();
          try {
            await ref.read(paymentsProvider.notifier).createAndSubmitProof(
              leaseId: leaseId,
              amount: amount,
              base64Image: base64Image,
              note: note,
              amountPaid: amountPaid,
              promiseDate: promiseDate,
            );
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Proof submitted! Awaiting manager review.'),
                    ],
                  ),
                  backgroundColor: Colors.green.shade600,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            }
          } catch (e) {
      debugPrint('Caught error: $e');
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Error: $e'),
                  backgroundColor: Colors.red.shade600,
                ),
              );
            }
          }
        },
      ),
    );
  }
}

class _SubmitProofSheet extends StatefulWidget {
  final List<dynamic> leases;
  final bool allowPartialPayments;
  final Future<void> Function(String leaseId, double amount, String base64Image, String? note, double? amountPaid, String? promiseDate) onSubmit;

  const _SubmitProofSheet({required this.leases, required this.allowPartialPayments, required this.onSubmit});

  @override
  State<_SubmitProofSheet> createState() => _SubmitProofSheetState();
}

class _SubmitProofSheetState extends State<_SubmitProofSheet> {
  late String _selectedLeaseId;
  late double _amount;
  final _noteController = TextEditingController();
  final _amountPaidController = TextEditingController();
  DateTime? _promiseDate;
  bool _isPartialPayment = false;
  XFile? _pickedImage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final firstLease = widget.leases.first;
    _selectedLeaseId = firstLease.id;
    _amount = firstLease.yearlyRent;
  }

  @override
  void dispose() {
    _noteController.dispose();
    _amountPaidController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (image != null && mounted) {
      setState(() => _pickedImage = image);
    }
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (image != null && mounted) {
      setState(() => _pickedImage = image);
    }
  }

  Future<void> _submit() async {
    if (_pickedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a proof of payment image')),
      );
      return;
    }

    double? parsedAmountPaid;
    if (_isPartialPayment) {
      final amountPaidStr = _amountPaidController.text.replaceAll(',', '').replaceAll('₦', '').trim();
      parsedAmountPaid = double.tryParse(amountPaidStr);
      if (parsedAmountPaid == null || parsedAmountPaid <= 0 || parsedAmountPaid >= _amount) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter a valid partial amount')),
        );
        return;
      }
      if (_promiseDate == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select a promise date')),
        );
        return;
      }
    }

    setState(() => _isSubmitting = true);

    final bytes = await _pickedImage!.readAsBytes();
    final base64Str = base64Encode(bytes);

    await widget.onSubmit(
      _selectedLeaseId,
      _amount,
      base64Str,
      _noteController.text.isNotEmpty ? _noteController.text : null,
      _isPartialPayment ? parsedAmountPaid : null,
      _isPartialPayment && _promiseDate != null ? _promiseDate!.toIso8601String() : null,
    );

    if (mounted) setState(() => _isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Title
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.textPrimary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.receipt_long, color: AppTheme.textPrimary, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Submit Proof of Payment',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                      ),
                      Text(
                        'Upload your payment receipt for verification',
                        style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 28),

            // Lease selector (if multiple leases)
            if (widget.leases.length > 1) ...[
              const Text(
                'SELECT LEASE',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.borderColor),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedLeaseId,
                    items: widget.leases.map<DropdownMenuItem<String>>((lease) {
                      return DropdownMenuItem(
                        value: lease.id as String,
                        child: Text(
                          '${lease.property?.name ?? 'Property'} — ₦${NumberFormat('#,##0').format(lease.yearlyRent)}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        final lease = widget.leases.firstWhere((l) => l.id == val);
                        setState(() {
                          _selectedLeaseId = val;
                          _amount = lease.yearlyRent;
                        });
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Amount display
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.textPrimary,
                    AppTheme.textPrimary.withAlpha(216),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  const Icon(Icons.account_balance_wallet, color: Colors.white54, size: 28),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'RENT AMOUNT',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Colors.white54),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        NumberFormat.currency(symbol: '₦ ', decimalDigits: 0).format(_amount),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (widget.allowPartialPayments) ...[
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'PARTIAL PAYMENT',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary),
                  ),
                  Switch(
                    value: _isPartialPayment,
                    activeColor: AppTheme.textPrimary,
                    onChanged: (val) {
                      setState(() => _isPartialPayment = val);
                    },
                  ),
                ],
              ),
              if (_isPartialPayment) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amountPaidController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Amount Paid (₦)',
                    hintText: 'e.g. 500000',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().add(const Duration(days: 7)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setState(() => _promiseDate = picked);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.borderColor),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _promiseDate == null
                              ? 'Select Promise Date'
                              : 'Promise Date: ${DateFormat.yMMMd().format(_promiseDate!)}',
                          style: TextStyle(
                            fontSize: 14,
                            color: _promiseDate == null ? AppTheme.textSecondary : AppTheme.textPrimary,
                          ),
                        ),
                        const Icon(Icons.calendar_today, size: 20, color: AppTheme.textSecondary),
                      ],
                    ),
                  ),
                ),
              ],
            ],

            const SizedBox(height: 24),

            // Image picker
            const Text(
              'PROOF OF PAYMENT',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (_pickedImage != null)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(
                      File(_pickedImage!.path),
                      height: 200,
                      width: double.infinity,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() => _pickedImage = null),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(153),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, color: Colors.white, size: 18),
                      ),
                    ),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: _ImagePickerButton(
                      icon: Icons.photo_library_outlined,
                      label: 'Gallery',
                      onTap: _pickImage,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ImagePickerButton(
                      icon: Icons.camera_alt_outlined,
                      label: 'Camera',
                      onTap: _takePhoto,
                    ),
                  ),
                ],
              ),

            const SizedBox(height: 20),

            // Note field
            const Text(
              'NOTE (OPTIONAL)',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _noteController,
              maxLines: 2,
              decoration: const InputDecoration(
                hintText: 'e.g. Bank transfer reference #12345',
                hintStyle: TextStyle(fontSize: 13),
              ),
            ),

            const SizedBox(height: 28),

            // Submit button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.textPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.send_rounded, size: 20),
                          SizedBox(width: 10),
                          Text('Submit for Verification', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ImagePickerButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ImagePickerButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.symmetric(vertical: 32),
          decoration: BoxDecoration(
            border: Border.all(color: AppTheme.borderColor, width: 1.5),
            borderRadius: BorderRadius.circular(14),
            color: AppTheme.backgroundColor,
          ),
          child: Column(
            children: [
              Icon(icon, size: 32, color: AppTheme.textSecondary),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
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

  Future<void> _submitProofOfPayment() async {
    final homeState = ref.read(homeStateProvider);
    final tenant = homeState.valueOrNull;
    final allowPartial = (tenant?.allowPartialPayments ?? false) && widget.payment.status != 'PARTIALLY_PAID';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SubmitExistingProofSheet(
        payment: widget.payment,
        allowPartialPayments: allowPartial,
        onSubmit: (base64Image, note, amountPaid, promiseDate) async {
          Navigator.of(ctx).pop();
          if (!mounted) return;
          setState(() => _isLoading = true);
          try {
            await ref.read(paymentsProvider.notifier).submitProof(
                  widget.payment.id,
                  base64Image,
                  note: note,
                  amountPaid: amountPaid,
                  promiseDate: promiseDate,
                );
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Proof submitted and is pending review.'),
                  backgroundColor: Colors.green.shade600,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            }
          } catch (e) {
            debugPrint('Caught error: $e');
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
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final payment = widget.payment;
    final isPaid = payment.status == 'PAID' || payment.status == 'COMPLETED';
    final isUnderReview = payment.status == 'UNDER_REVIEW';
    final isPartial = payment.status == 'PARTIALLY_PAID';
    final isOverdue = (!isPaid && !isUnderReview && !isPartial) && payment.dueDate.isBefore(DateTime.now());

    final hasPartialAmount = (payment.amountPaid ?? 0) > 0;
    final isPartialState = isPartial || (isUnderReview && hasPartialAmount);

    Color statusColor;
    IconData statusIcon;
    if (isPaid) {
      statusColor = Colors.green.shade600;
      statusIcon = Icons.check_circle_outline;
    } else if (isUnderReview) {
      statusColor = Colors.blue.shade500;
      statusIcon = Icons.hourglass_top;
    } else if (isPartial) {
      statusColor = Colors.orange.shade700;
      statusIcon = Icons.pie_chart_outline;
    } else if (isOverdue) {
      statusColor = Colors.red.shade500;
      statusIcon = Icons.warning_amber_rounded;
    } else {
      statusColor = Colors.orange.shade500;
      statusIcon = Icons.pending_actions_outlined;
    }

    final displayAmount = isPartialState 
        ? (payment.amount - (payment.amountPaid ?? 0))
        : payment.amount;

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
                    color: statusColor.withAlpha(25),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(statusIcon, color: statusColor, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(displayAmount),
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: -0.5),
                          ),
                          if (isPartialState) ...[
                            const SizedBox(width: 4),
                            Text(
                              'Bal',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange.shade700),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isPartialState && payment.promiseDate != null
                            ? 'Promised by: ${DateFormat.yMMMd().format(payment.promiseDate!)}'
                            : 'Due: ${DateFormat.yMMMd().format(payment.dueDate)}',
                        style: TextStyle(
                            color: isPartialState && payment.promiseDate != null && payment.promiseDate!.isBefore(DateTime.now()) 
                                ? Colors.red.shade600 
                                : Colors.grey.shade600, 
                            fontSize: 13, 
                            fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(25),
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

            // Receipt ID for paid payments
            if (isPaid && payment.receiptId != null) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: () => _showReceiptDialog(context, payment),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade100),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.receipt_outlined, color: Colors.green.shade700, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Payment Receipt Issued',
                              style: TextStyle(color: Colors.green.shade900, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'ID: ${payment.receiptId}',
                              style: TextStyle(color: Colors.green.shade700, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.arrow_forward_ios, color: Colors.green.shade300, size: 12),
                    ],
                  ),
                ),
              ),
            ],

            // Under review notice
            if (isUnderReview) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        hasPartialAmount 
                            ? 'Your partial payment of ${NumberFormat.currency(symbol: '₦ ', decimalDigits: 0).format(payment.amountPaid)} is being reviewed'
                            : 'Your proof is being reviewed by management',
                        style: TextStyle(color: Colors.blue.shade800, fontSize: 13, height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Rejection reason
            if (!isPaid && !isUnderReview && payment.rejectionReason != null) ...[
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

            // Action buttons — show only for PENDING, REJECTED, or OVERDUE
            if (!isPaid && !isUnderReview) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showInvoiceDialog(context, payment),
                      icon: const Icon(Icons.receipt_long),
                      label: const Text('Invoice'),
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
                    child: ElevatedButton.icon(
                      onPressed: _isLoading ? null : _submitProofOfPayment,
                      icon: _isLoading
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.upload_file),
                      label: Text(payment.rejectionReason != null ? 'Re-upload' : 'Pay / Proof'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
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

  void _showInvoiceDialog(BuildContext context, Payment payment) {
    final homeState = ref.read(homeStateProvider);
    final tenant = homeState.valueOrNull;
    
    // Find the property name/address from the lease
    String propertyName = 'N/A';
    dynamic paymentInfo;

    if (tenant != null && tenant.leases != null) {
      final lease = tenant.leases!.firstWhere(
        (l) => l.id == payment.leaseId,
        orElse: () => tenant.leases!.first,
      );
      final property = lease.property;
      propertyName = property?.name ?? 'Property';
      paymentInfo = lease.paymentInfo;
    }

    final isPartial = payment.status == 'PARTIALLY_PAID';
    final amountDue = isPartial ? (payment.amount - (payment.amountPaid ?? 0)) : payment.amount;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: Colors.orange.shade600,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long, color: Colors.white, size: 48),
                      SizedBox(height: 12),
                      Text(
                        'INVOICE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                    Text(
                      NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(amountDue),
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.orange.shade200),
                      ),
                      child: Text(
                        'DUE: ${DateFormat.yMMMd().format(payment.dueDate)}',
                        style: TextStyle(color: Colors.orange.shade800, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 32),
                    _ReceiptRow(label: 'Property', value: propertyName),
                    const SizedBox(height: 16),
                    _ReceiptRow(label: 'Invoice ID', value: payment.id.substring(0, 8).toUpperCase()),
                    const SizedBox(height: 16),
                    _ReceiptRow(label: 'Date Issued', value: DateFormat.yMMMd().format(payment.dueDate)),
                    const SizedBox(height: 32),
                    const Divider(),
                    const SizedBox(height: 16),
                    const Text('PAYMENT DETAILS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.grey)),
                    const SizedBox(height: 16),
                    if (paymentInfo != null) ...[
                      _ReceiptRow(label: 'Bank Name', value: NigerianBanks.getBankName(paymentInfo.bankCode)),
                      const SizedBox(height: 12),
                      _ReceiptRow(label: 'Account Name', value: paymentInfo.accountName ?? 'N/A'),
                      const SizedBox(height: 12),
                      _ReceiptRow(label: 'Account No.', value: paymentInfo.accountNumber ?? 'N/A'),
                    ] else ...[
                      const Text('No payment information available.', style: TextStyle(fontSize: 14, color: Colors.grey)),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey.shade200,
                          foregroundColor: Colors.black87,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('Close', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    ),
  );
}

  void _showReceiptDialog(BuildContext context, Payment payment) {
    final homeState = ref.read(homeStateProvider);
    final tenant = homeState.valueOrNull;
    
    // Find the property name/address from the lease
    String propertyName = 'N/A';
    Property? property;

    if (tenant != null && tenant.leases != null) {
      final lease = tenant.leases!.firstWhere(
        (l) => l.id == payment.leaseId,
        orElse: () => tenant.leases!.first, // Fallback to first if not found (should not happen)
      );
      property = lease.property;
      propertyName = property?.name ?? 'Property';
    }

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: const BoxDecoration(
                  color: AppTheme.textPrimary,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green, size: 48),
                      SizedBox(height: 12),
                      Text(
                        'PAYMENT RECEIPT',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Content
              Flexible(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                    const Text(
                      'TOTAL AMOUNT PAID',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.textSecondary, letterSpacing: 1),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(payment.amount),
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1),
                    ),
                    const SizedBox(height: 32),
                    
                    _ReceiptRow(label: 'TENANT', value: tenant?.name ?? 'N/A'),
                    _ReceiptRow(label: 'DATE', value: DateFormat.yMMMMd().format(payment.paidDate ?? payment.dueDate)),
                    _ReceiptRow(label: 'PROPERTY', value: propertyName),
                    _ReceiptRow(label: 'REFERENCE', value: payment.note ?? 'Rent Payment'),
                    
                    if (payment.transactions.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'PAYMENT BREAKDOWN',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.textSecondary, letterSpacing: 1),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.grey[50],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Column(
                          children: payment.transactions.map((t) => Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      DateFormat.yMMMMd().format(t.createdAt),
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                    ),
                                    Text(
                                      t.note ?? 'Payment',
                                      style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),
                                Text(
                                  NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(t.amount),
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
                                ),
                              ],
                            ),
                          )).toList(),
                        ),
                      ),
                    ],
                    
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Row(
                        children: [
                          Expanded(child: Divider(color: AppTheme.borderColor, thickness: 2)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Icon(Icons.qr_code_2, color: AppTheme.textSecondary, size: 32),
                          ),
                          Expanded(child: Divider(color: AppTheme.borderColor, thickness: 2)),
                        ],
                      ),
                    ),
                    
                    const Text(
                      'RECEIPT NUMBER',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.textSecondary, letterSpacing: 1),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      payment.receiptId ?? 'N/A',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, fontFamily: 'monospace'),
                    ),
                  ],
                ),
              ),
              ),
              ),

              // Actions
              Padding(
                padding: const EdgeInsets.only(left: 32, right: 32, bottom: 32),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Close', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          if (tenant == null || property == null) return;
                          
                          try {
                            // Show loading
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Generating official receipt PDF...')),
                            );

                            final pdfBytes = await ReceiptService.generateReceipt(
                              payment: payment,
                              tenant: tenant,
                              property: property,
                            );

                            await Printing.sharePdf(
                              bytes: pdfBytes,
                              filename: 'Receipt-${payment.receiptId ?? payment.id}.pdf',
                            );
                          } catch (e) {
      debugPrint('Caught error: $e');
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to share receipt: $e')),
                              );
                            }
                          }
                        },
                        icon: const Icon(Icons.share_rounded, size: 18),
                        label: const Text('Share'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.textPrimary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SubmitExistingProofSheet extends StatefulWidget {
  final dynamic payment;
  final bool allowPartialPayments;
  final Future<void> Function(String base64Image, String? note, double? amountPaid, String? promiseDate) onSubmit;

  const _SubmitExistingProofSheet({required this.payment, required this.allowPartialPayments, required this.onSubmit});

  @override
  State<_SubmitExistingProofSheet> createState() => _SubmitExistingProofSheetState();
}

class _SubmitExistingProofSheetState extends State<_SubmitExistingProofSheet> {
  final _noteController = TextEditingController();
  final _amountPaidController = TextEditingController();
  DateTime? _promiseDate;
  bool _isPartialPayment = false;
  XFile? _pickedImage;

  @override
  void dispose() {
    _noteController.dispose();
    _amountPaidController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (image != null && mounted) setState(() => _pickedImage = image);
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (image != null && mounted) setState(() => _pickedImage = image);
  }

  Future<void> _submit() async {
    if (_pickedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a proof of payment image')));
      return;
    }

    double? parsedAmountPaid;
    if (_isPartialPayment) {
      final amountPaidStr = _amountPaidController.text.replaceAll(',', '').replaceAll('₦', '').trim();
      parsedAmountPaid = double.tryParse(amountPaidStr);
      final remainingBalance = widget.payment.amount - (widget.payment.amountPaid ?? 0);
      if (parsedAmountPaid == null || parsedAmountPaid <= 0 || parsedAmountPaid >= remainingBalance) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid partial amount')));
        return;
      }
      if (_promiseDate == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a promise date')));
        return;
      }
    }

    final bytes = await _pickedImage!.readAsBytes();
    final base64Str = base64Encode(bytes);

    await widget.onSubmit(base64Str, _noteController.text.isEmpty ? null : _noteController.text, parsedAmountPaid, _promiseDate?.toIso8601String());
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 12),
      child: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 48, height: 5, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)))),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pay Existing Invoice', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
                  if (widget.payment.status == 'PARTIALLY_PAID') ...[
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('BALANCE DUE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary)),
                        const SizedBox(height: 2),
                        Text(
                          NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(widget.payment.amount - (widget.payment.amountPaid ?? 0)),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.primaryColor),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 32),
              
              if (widget.allowPartialPayments) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('PARTIAL PAYMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary)),
                    Switch(
                      value: _isPartialPayment,
                      activeColor: AppTheme.textPrimary,
                      onChanged: (val) => setState(() => _isPartialPayment = val),
                    ),
                  ],
                ),
                if (_isPartialPayment) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _amountPaidController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: 'Amount Paid (₦)', hintText: 'e.g. 500000', border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))),
                  ),
                  const SizedBox(height: 16),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 7)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                      if (picked != null) setState(() => _promiseDate = picked);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(border: Border.all(color: AppTheme.borderColor), borderRadius: BorderRadius.circular(14)),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_promiseDate == null ? 'Select Promise Date' : 'Promise Date: ${DateFormat.yMMMd().format(_promiseDate!)}', style: TextStyle(fontSize: 14, color: _promiseDate == null ? AppTheme.textSecondary : AppTheme.textPrimary)),
                          const Icon(Icons.calendar_today, size: 20, color: AppTheme.textSecondary),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ],

              const Text('PROOF OF PAYMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary)),
              const SizedBox(height: 12),
              if (_pickedImage != null)
                Container(height: 140, width: double.infinity, decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor), image: DecorationImage(image: FileImage(File(_pickedImage!.path)), fit: BoxFit.cover)))
              else
                Row(
                  children: [
                    Expanded(child: InkWell(onTap: _pickImage, child: Container(height: 100, decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)), child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.photo_library_outlined, color: AppTheme.textPrimary, size: 32), SizedBox(height: 8), Text('Gallery', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))])))),
                    const SizedBox(width: 16),
                    Expanded(child: InkWell(onTap: _takePhoto, child: Container(height: 100, decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppTheme.borderColor)), child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.camera_alt_outlined, color: AppTheme.textPrimary, size: 32), SizedBox(height: 8), Text('Camera', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))])))),
                  ],
                ),

              const SizedBox(height: 24),
              const Text('NOTE (OPTIONAL)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppTheme.textSecondary)),
              const SizedBox(height: 8),
              TextField(controller: _noteController, maxLines: 2, decoration: const InputDecoration(hintText: 'e.g. Bank transfer reference #12345', hintStyle: TextStyle(fontSize: 13))),

              const SizedBox(height: 28),
              SizedBox(width: double.infinity, height: 56, child: ElevatedButton(onPressed: _submit, style: ElevatedButton.styleFrom(backgroundColor: AppTheme.textPrimary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 0), child: const Text('Submit Proof', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)))),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  final String label;
  final String value;

  const _ReceiptRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _PaymentAccountCard extends StatelessWidget {
  final dynamic paymentInfo;

  const _PaymentAccountCard({required this.paymentInfo});

  @override
  Widget build(BuildContext context) {
    final isDirect = paymentInfo.payoutStrategy == 'DIRECT_TO_LANDLORD';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor, // Light blue
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.account_balance_rounded, color: AppTheme.primaryColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PAYMENT ACCOUNT',
                      style: TextStyle(
                        color: AppTheme.primaryColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                      ),
                    ),
                    Text(
                      paymentInfo.accountName ?? 'Account Name N/A',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.accentColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: AppTheme.borderColor, height: 1),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Account Number', style: TextStyle(color: AppTheme.primaryColor, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    paymentInfo.accountNumber ?? 'N/A',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'monospace', color: AppTheme.accentColor),
                  ),
                ],
              ),
              if (paymentInfo.bankCode != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Bank', style: TextStyle(color: AppTheme.primaryColor, fontSize: 11)),
                    const SizedBox(height: 2),
                    Text(
                      NigerianBanks.getBankName(paymentInfo.bankCode),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.accentColor),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(127),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isDirect ? Icons.person_pin_rounded : Icons.business_center_rounded,
                  size: 14,
                  color: AppTheme.primaryColor,
                ),
                const SizedBox(width: 6),
                Text(
                  isDirect ? 'Pay directly to landlord' : 'Pay to property manager',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
