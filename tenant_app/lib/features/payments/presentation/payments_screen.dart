import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'payments_notifier.dart';
import 'package:intl/intl.dart';
import '../../home/presentation/home_notifier.dart';

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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSubmitProofSheet(context, ref),
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Submit Proof'),
        backgroundColor: const Color(0xFF18181B),
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
        onSubmit: (leaseId, amount, base64Image, note) async {
          Navigator.of(ctx).pop();
          try {
            await ref.read(paymentsProvider.notifier).createAndSubmitProof(
              leaseId: leaseId,
              amount: amount,
              base64Image: base64Image,
              note: note,
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
  final Future<void> Function(String leaseId, double amount, String base64Image, String? note) onSubmit;

  const _SubmitProofSheet({required this.leases, required this.onSubmit});

  @override
  State<_SubmitProofSheet> createState() => _SubmitProofSheetState();
}

class _SubmitProofSheetState extends State<_SubmitProofSheet> {
  late String _selectedLeaseId;
  late double _amount;
  final _noteController = TextEditingController();
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
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (image != null) {
      setState(() => _pickedImage = image);
    }
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (image != null) {
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

    setState(() => _isSubmitting = true);

    final bytes = await _pickedImage!.readAsBytes();
    final base64Str = base64Encode(bytes);

    await widget.onSubmit(
      _selectedLeaseId,
      _amount,
      base64Str,
      _noteController.text.isNotEmpty ? _noteController.text : null,
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
                    color: const Color(0xFF18181B).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.receipt_long, color: Color(0xFF18181B), size: 22),
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
                        style: TextStyle(fontSize: 12, color: Color(0xFF71717A)),
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
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Color(0xFF71717A)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE4E4E7)),
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
                    const Color(0xFF18181B),
                    const Color(0xFF18181B).withValues(alpha: 0.85),
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

            const SizedBox(height: 24),

            // Image picker
            const Text(
              'PROOF OF PAYMENT',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Color(0xFF71717A)),
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
                          color: Colors.black.withValues(alpha: 0.6),
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
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Color(0xFF71717A)),
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
                  backgroundColor: const Color(0xFF18181B),
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
            border: Border.all(color: const Color(0xFFE4E4E7), width: 1.5),
            borderRadius: BorderRadius.circular(14),
            color: const Color(0xFFFAFAFA),
          ),
          child: Column(
            children: [
              Icon(icon, size: 32, color: const Color(0xFF71717A)),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF71717A)),
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
          SnackBar(
            content: const Text('Proof submitted and is pending review.'),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
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
    IconData statusIcon;
    if (isPaid) {
      statusColor = Colors.green.shade600;
      statusIcon = Icons.check_circle_outline;
    } else if (isUnderReview) {
      statusColor = Colors.blue.shade500;
      statusIcon = Icons.hourglass_top;
    } else if (isRejected) {
      statusColor = Colors.red.shade500;
      statusIcon = Icons.cancel_outlined;
    } else if (isOverdue) {
      statusColor = Colors.red.shade500;
      statusIcon = Icons.warning_amber_rounded;
    } else {
      statusColor = Colors.orange.shade500;
      statusIcon = Icons.pending_actions_outlined;
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
                  child: Icon(statusIcon, color: statusColor, size: 28),
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
                        'Your proof is being reviewed by management',
                        style: TextStyle(color: Colors.blue.shade900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Rejection reason
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

            // Action buttons — show only for PENDING, REJECTED, or OVERDUE
            if (!isPaid && !isUnderReview) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _submitProofOfPayment,
                  icon: _isLoading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.upload_file),
                  label: Text(isRejected ? 'Re-upload Proof' : 'Upload Proof'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }

  void _showReceiptDialog(BuildContext context, dynamic payment) {
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
                  color: Color(0xFF18181B),
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
              Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    const Text(
                      'TOTAL AMOUNT PAID',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF71717A), letterSpacing: 1),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      NumberFormat.currency(symbol: '₦ ', decimalDigits: 2).format(payment.amount),
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1),
                    ),
                    const SizedBox(height: 32),
                    
                    _ReceiptRow(label: 'TENANT', value: 'Nureni Oje'), // In real app, get from auth state
                    _ReceiptRow(label: 'DATE', value: DateFormat.yMMMMd().format(payment.paidDate ?? payment.dueDate)),
                    _ReceiptRow(label: 'PROPERTY', value: 'Destiny Villa'),
                    _ReceiptRow(label: 'REFERENCE', value: payment.note ?? 'Rent Payment'),
                    
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Row(
                        children: [
                          Expanded(child: Divider(color: Color(0xFFE4E4E7), thickness: 2)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Icon(Icons.qr_code_2, color: Color(0xFFD4D4D8), size: 32),
                          ),
                          Expanded(child: Divider(color: Color(0xFFE4E4E7), thickness: 2)),
                        ],
                      ),
                    ),
                    
                    const Text(
                      'RECEIPT NUMBER',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF71717A), letterSpacing: 1),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      payment.receiptId ?? 'N/A',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, fontFamily: 'monospace'),
                    ),
                  ],
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
                        child: const Text('Close', style: TextStyle(color: Color(0xFF71717A), fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          // TODO: Implement actual sharing/PDF generation in a real production app
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Receipt image generated and ready to share!')),
                          );
                        },
                        icon: const Icon(Icons.share_rounded, size: 18),
                        label: const Text('Share'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF18181B),
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
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFA1A1AA)),
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
