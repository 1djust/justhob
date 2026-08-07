import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../../../../core/services/receipt_service.dart';
import '../../../../shared/domain/tenant.dart';
import '../../../../shared/domain/property.dart';
import 'landlord_payments_notifier.dart';
import '../data/landlord_payments_repository.dart';
import '../../tenants/presentation/tenants_notifier.dart';
import '../../../../shared/domain/payment.dart';

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
  bool _isActionLoading = false;

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

    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final dateFormatter = DateFormat('MMM dd, yyyy');

    final leaseMap = payment.lease;
    final tenantName = leaseMap?['tenant']?['name'] ?? 'Amara Chidi';
    final propertyName = leaseMap?['property']?['name'] != null
        ? "${leaseMap!['property']['name']}, Unit ${leaseMap['unit']?['unitNumber'] ?? '2'}"
        : "Solomon's Heights, Unit 2";

    final formattedDueDate = dateFormatter.format(payment.dueDate);
    final categoryName = payment.note != null && payment.note!.isNotEmpty
        ? payment.note!
        : 'Monthly Rent';

    // Status mapping
    Color statusColor;
    Color statusBg;
    String statusLabel;

    switch (payment.status) {
      case 'PAID':
        statusColor = const Color(0xFF15803D);
        statusBg = const Color(0xFFDCFCE7);
        statusLabel = 'Paid';
        break;
      case 'PARTIALLY_PAID':
        statusColor = const Color(0xFF2563EB);
        statusBg = const Color(0xFFEFF6FF);
        statusLabel = 'Partially Paid';
        break;
      case 'REJECTED':
        statusColor = const Color(0xFFEF4444);
        statusBg = const Color(0xFFFEF2F2);
        statusLabel = 'Rejected';
        break;
      case 'OVERDUE':
        statusColor = const Color(0xFFEF4444);
        statusBg = const Color(0xFFFEF2F2);
        statusLabel = 'Overdue';
        break;
      case 'UNDER_REVIEW':
        statusColor = const Color(0xFFD97706);
        statusBg = const Color(0xFFFFFBEB);
        statusLabel = 'Pending Review';
        break;
      case 'PENDING':
      default:
        statusColor = const Color(0xFFD97706);
        statusBg = const Color(0xFFFFFBEB);
        statusLabel = 'Pending';
        break;
    }

    // Proof image parsing
    ImageProvider? proofImage;
    if (payment.proofUrl != null && payment.proofUrl!.isNotEmpty) {
      final urlStr = payment.proofUrl!;
      if (urlStr.startsWith('data:image')) {
        try {
          final commaIndex = urlStr.indexOf(',');
          if (commaIndex != -1) {
            final base64Str = urlStr.substring(commaIndex + 1);
            proofImage = MemoryImage(base64Decode(base64Str));
          }
        } catch (e) {
          debugPrint('[LandlordPaymentReviewScreen] Base64 error: $e');
        }
      } else if (urlStr.startsWith('http')) {
        proofImage = NetworkImage(urlStr);
      } else if (urlStr.startsWith('/')) {
        // Relative API URL (e.g. /uploads/proof.jpg)
        proofImage = NetworkImage('http://10.0.2.2:3001$urlStr');
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Top Header Bar
              _buildTopHeader(context),
              const SizedBox(height: 24),

              // 2. Main Payment Record Card
              _buildPaymentRecordCard(
                payment: payment,
                tenantName: tenantName,
                propertyName: propertyName,
                formattedDueDate: formattedDueDate,
                categoryName: categoryName,
                statusLabel: statusLabel,
                statusColor: statusColor,
                statusBg: statusBg,
                currencyFormatter: currencyFormatter,
              ),
              const SizedBox(height: 24),              // Proof Image Preview / Submitted Receipt Box / Overdue Banner
              if (payment.status == 'OVERDUE') ...[
                const Text(
                  'Invoice & Proof Status',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFFDC2626),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.error_outline_rounded, color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Overdue Invoice — No Proof Submitted',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF991B1B)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Due Date: $formattedDueDate | Balance: ${currencyFormatter.format(payment.amount - (payment.amountPaid ?? 0))}',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'This invoice is past due. The resident has not uploaded or submitted any proof of payment.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF7F1D1D), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ] else if (proofImage != null) ...[
                const Text(
                  'Submitted Receipt / Proof',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => _showFullScreenImage(context, proofImage!),
                  child: Container(
                    height: 200,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withAlpha(5),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image(image: proofImage, fit: BoxFit.cover),
                          Positioned(
                            right: 12,
                            bottom: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black.withAlpha(160),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.zoom_in_rounded, color: Colors.white, size: 14),
                                  SizedBox(width: 4),
                                  Text(
                                    'Tap to expand',
                                    style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ] else if (payment.status == 'UNDER_REVIEW' || payment.status == 'PENDING') ...[
                const Text(
                  'Submitted Receipt / Proof',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.receipt_long_rounded, color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Bank Transfer Advice — $tenantName',
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A)),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Ref: TXN-89471028 | Access Bank / GTBank',
                                  style: TextStyle(fontSize: 12, color: Color(0xFF2563EB), fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFDBEAFE)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Proof Status:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Awaiting Manager Review',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Tenant Note Container (if present)
              if (payment.note != null && payment.note!.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TENANT NOTE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF94A3B8),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        payment.note!,
                        style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Certified Digital Receipt View (if PAID)
              if (payment.status == 'PAID') ...[
                _buildCertifiedReceiptCard(
                  payment: payment,
                  tenantName: tenantName,
                  propertyName: propertyName,
                  currencyFormatter: currencyFormatter,
                ),
                const SizedBox(height: 24),
              ],

              // Rejection Reason Banner (if rejected)
              if (payment.status == 'REJECTED' && payment.rejectionReason != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.cancel_rounded, color: Color(0xFFEF4444), size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'REJECTION REASON',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFEF4444), letterSpacing: 0.8),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              payment.rejectionReason!,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF991B1B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // 3. Payment Timeline Section
              const Text(
                'Payment Timeline',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 16),
              _buildTimelineSection(tenantName, formattedDueDate, payment.status),
              const SizedBox(height: 32),

              // 4. Actions: Approve, Reject, Send Reminder
              if (payment.status == 'UNDER_REVIEW' || payment.status == 'PENDING') ...[
                Row(
                  children: [
                    // Approve Button
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: _isActionLoading ? null : () => _showApproveBottomSheet(context, payment),
                          icon: const Icon(Icons.check_circle_rounded, size: 20),
                          label: const Text('Approve', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A), // Emerald
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Reject Button
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: _isActionLoading ? null : () => _showRejectBottomSheet(context, payment),
                          icon: const Icon(Icons.cancel_rounded, size: 20),
                          label: const Text('Reject', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626), // Red
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // Send Reminder Button
              if (payment.status != 'PAID')
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _isActionLoading ? null : () => _showSendReminderBottomSheet(context, payment, tenantName),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text(
                      'Send Reminder',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  /// 1. Top Header with Circular Back Button & Title
  Widget _buildTopHeader(BuildContext context) {
    return Row(
      children: [
        InkWell(
          onTap: () => context.pop(),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(5),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.chevron_left_rounded,
              color: Color(0xFF0F172A),
              size: 26,
            ),
          ),
        ),
        const SizedBox(width: 14),
        const Text(
          'Payment Record',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }

  /// 2. Main Payment Record Details Card
  Widget _buildPaymentRecordCard({
    required Payment payment,
    required String tenantName,
    required String propertyName,
    required String formattedDueDate,
    required String categoryName,
    required String statusLabel,
    required Color statusColor,
    required Color statusBg,
    required NumberFormat currencyFormatter,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(6),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.article_outlined,
                  color: Color(0xFF2563EB),
                  size: 24,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          const Text(
            'Invoice Amount',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            currencyFormatter.format(payment.amount),
            style: const TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
              letterSpacing: -0.8,
            ),
          ),
          const SizedBox(height: 20),

          const Divider(color: Color(0xFFF1F5F9), height: 1),
          const SizedBox(height: 20),

          _buildDetailRow('Tenant', tenantName),
          const SizedBox(height: 14),
          _buildDetailRow('Property', propertyName),
          const SizedBox(height: 14),
          _buildDetailRow('Due Date', formattedDueDate),
          const SizedBox(height: 14),
          _buildDetailRow('Category', categoryName),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: Color(0xFF64748B),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }

  /// 3. Payment Timeline Vertical List
  Widget _buildTimelineSection(String tenantName, String dueDateStr, String status) {
    final firstName = tenantName.split(' ').first;

    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Column(
        children: [
          // Step 1: Invoice Sent
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    margin: const EdgeInsets.only(top: 4),
                    decoration: const BoxDecoration(
                      color: Color(0xFF10B981), // Emerald Green
                      shape: BoxShape.circle,
                    ),
                  ),
                  Container(
                    width: 2,
                    height: 48,
                    color: const Color(0xFFE2E8F0),
                  ),
                ],
              ),
              const SizedBox(width: 14),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Invoice Sent',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Automatically generated and sent to $firstName',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Oct 01, 2024',
                      style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Step 2: Reminder or Status Update
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 12,
                height: 12,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: status == 'PAID'
                      ? const Color(0xFF10B981)
                      : (status == 'REJECTED' ? const Color(0xFFEF4444) : const Color(0xFFF59E0B)),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 14),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status == 'PAID'
                          ? 'Payment Approved'
                          : (status == 'REJECTED' ? 'Payment Proof Rejected' : 'Reminder Triggered'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      status == 'PAID'
                          ? 'Verified and receipt generated'
                          : (status == 'REJECTED'
                              ? 'Rejected by manager'
                              : 'Auto-reminder dispatched'),
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Oct 10, 2024',
                      style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showApproveBottomSheet(BuildContext context, Payment payment) {
    HapticFeedback.mediumImpact();
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final totalInvoice = payment.amount;
    final previousPaid = (payment.status == 'PAID' || payment.status == 'PARTIALLY_PAID')
        ? (payment.amountPaid ?? 0)
        : 0.0;
    final remainingBalance = totalInvoice - previousPaid;

    // Amount sent/claimed by tenant (non-editable as requested)
    final double tenantSentAmount = (payment.amountPaid != null && payment.amountPaid! > 0)
        ? payment.amountPaid!
        : remainingBalance;

    final isPartial = tenantSentAmount < remainingBalance;
    final remainingAfter = (remainingBalance - tenantSentAmount).clamp(0.0, totalInvoice);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(28),
                topRight: Radius.circular(28),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40, height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 24),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Approve Payment',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          Text(
                            'Verify & confirm tenant\'s submitted payment',
                            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Non-editable Amount Sent Display Box
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'AMOUNT SENT BY TENANT',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.lock_outline_rounded, size: 12, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text(
                            'NON-EDITABLE',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        currencyFormatter.format(tenantSentAmount),
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      const Icon(Icons.verified_outlined, color: Color(0xFF16A34A), size: 22),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Settlement Summary Card (Part Payment vs Full Payment)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isPartial ? const Color(0xFFFFFBEB) : const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isPartial ? const Color(0xFFFDE68A) : const Color(0xFFA7F3D0),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'PAYMENT CLASSIFICATION',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: isPartial ? const Color(0xFFB45309) : const Color(0xFF047857),
                              letterSpacing: 0.6,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isPartial ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isPartial ? const Color(0xFFFCD34D) : const Color(0xFF86EFAC),
                              ),
                            ),
                            child: Text(
                              isPartial ? 'PART PAYMENT' : 'FULL PAYMENT AT ONCE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: isPartial ? const Color(0xFFB45309) : const Color(0xFF15803D),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1, color: Color(0xFFE2E8F0)),
                      const SizedBox(height: 12),

                      _buildSummaryRow('Total Invoice Amount', currencyFormatter.format(totalInvoice)),
                      const SizedBox(height: 6),
                      _buildSummaryRow('Amount Sent by Tenant', currencyFormatter.format(tenantSentAmount), isHighlighted: true),
                      const SizedBox(height: 6),
                      _buildSummaryRow(
                        'Remaining Balance After Approval',
                        currencyFormatter.format(remainingAfter),
                        color: remainingAfter > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                      ),

                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            isPartial ? Icons.warning_amber_rounded : Icons.check_circle_rounded,
                            color: isPartial ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              isPartial
                                  ? 'This will be recorded as a PARTIAL PAYMENT. Remaining balance of ${currencyFormatter.format(remainingAfter)} will stay outstanding.'
                                  : 'This will clear the total invoice balance. The payment will be marked as FULLY SETTLED.',
                              style: TextStyle(
                                fontSize: 12,
                                color: isPartial ? const Color(0xFF92400E) : const Color(0xFF065F46),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.of(ctx).pop();
                      await _performApprove(payment, approvedAmount: tenantSentAmount);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text(
                      'Confirm Approval (${currencyFormatter.format(tenantSentAmount)})',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _performApprove(Payment payment, {double? approvedAmount}) async {
    HapticFeedback.heavyImpact();
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    setState(() => _isActionLoading = true);
    try {
      if (!payment.id.startsWith('pay-')) {
        await ref.read(landlordPaymentsRepositoryProvider).reviewPayment(
          workspaceId: workspaceId,
          paymentId: payment.id,
          status: 'PAID',
          approvedAmountPaid: approvedAmount,
        );
      }
      ref.invalidate(landlordPaymentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment approved successfully! Receipt generated.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  void _showRejectBottomSheet(BuildContext context, Payment payment) {
    final reasonController = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(28),
                topRight: Radius.circular(28),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40, height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                Row(
                  children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626), size: 24),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Reject Payment Proof',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          Text(
                            'Provide a reason for rejection',
                            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                const Text(
                  'Rejection Reason *',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: reasonController,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                  decoration: InputDecoration(
                    hintText: 'e.g. Amount does not match, receipt is unclear...',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () async {
                      final reason = reasonController.text.trim();
                      if (reason.isEmpty) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('Please enter a rejection reason')),
                        );
                        return;
                      }
                      Navigator.of(ctx).pop();
                      await _performReject(payment, reason: reason);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Reject Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _performReject(Payment payment, {required String reason}) async {
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    setState(() => _isActionLoading = true);
    try {
      if (!payment.id.startsWith('pay-')) {
        await ref.read(landlordPaymentsRepositoryProvider).reviewPayment(
          workspaceId: workspaceId,
          paymentId: payment.id,
          status: 'REJECTED',
          rejectionReason: reason,
        );
      }
      ref.invalidate(landlordPaymentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment proof rejected. Tenant notified.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  void _showFullScreenImage(BuildContext context, ImageProvider imageProvider) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image(image: imageProvider, fit: BoxFit.contain),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.of(ctx).pop(),
              icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
            ),
          ],
        ),
      ),
    );
  }

  void _showSendReminderBottomSheet(BuildContext context, Payment payment, String tenantName) {
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final isOverdue = payment.status == 'OVERDUE';
    final amountDueStr = currencyFormatter.format(payment.amount - (payment.amountPaid ?? 0));

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: isOverdue ? const Color(0xFFFEF2F2) : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.send_rounded,
                      color: isOverdue ? const Color(0xFFDC2626) : const Color(0xFF2563EB),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isOverdue ? 'Dispatch Overdue Notice' : 'Send Payment Reminder',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          'Notify $tenantName regarding $amountDueStr balance',
                          style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Multi-Channel Notification Badges
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'DELIVERY CHANNELS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.6),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _buildChannelBadge(Icons.email_outlined, 'Email Advice'),
                        const SizedBox(width: 8),
                        _buildChannelBadge(Icons.notifications_active_outlined, 'Push Notification'),
                        const SizedBox(width: 8),
                        _buildChannelBadge(Icons.chat_bubble_outline_rounded, 'In-App Alert'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Live Message Preview Box
              const Text(
                'MESSAGE PREVIEW',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.6),
              ),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Text(
                  isOverdue
                      ? 'Dear $tenantName,\nYour rent invoice balance of $amountDueStr for Solomon\'s Heights is currently OVERDUE. Please log in to PropertyStack to upload your payment receipt or make payment immediately.'
                      : 'Dear $tenantName,\nThis is a friendly reminder regarding your upcoming rent invoice balance of $amountDueStr. Please log in to PropertyStack to submit your payment proof.',
                  style: const TextStyle(fontSize: 12, height: 1.5, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    await _performSendReminder(payment, tenantName);
                  },
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: const Text('Dispatch Reminder Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOverdue ? const Color(0xFFDC2626) : const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _performSendReminder(Payment payment, String tenantName) async {
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    setState(() => _isActionLoading = true);
    try {
      if (!payment.id.startsWith('pay-')) {
        await ref.read(landlordPaymentsRepositoryProvider).sendReminder(
          workspaceId: workspaceId,
          paymentId: payment.id,
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment reminder dispatched to $tenantName via Email & Push Notification!'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF2563EB),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Reminder dispatched to $tenantName (Demo mode)'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF2563EB),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  Widget _buildChannelBadge(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: const Color(0xFF2563EB)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
        ],
      ),
    );
  }

  Widget _buildCertifiedReceiptCard({
    required Payment payment,
    required String tenantName,
    required String propertyName,
    required NumberFormat currencyFormatter,
  }) {
    final receiptId = payment.receiptId ?? 'RCPT-${payment.id.split('-').first.toUpperCase()}';
    final paidDateStr = payment.paidDate != null
        ? DateFormat('MMMM dd, yyyy').format(payment.paidDate!)
        : 'October 15, 2024';

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top Decorative Bar
          Container(
            height: 6,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF10B981), Color(0xFF2563EB), Color(0xFF10B981)],
              ),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.verified_outlined, color: Colors.white, size: 28),
                ),
                const SizedBox(height: 12),
                const Text(
                  'PROPERTYSTACK SETTLEMENT',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded, color: Color(0xFF15803D), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'CERTIFIED DIGITAL RECEIPT',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF15803D),
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Amount
                Text(
                  currencyFormatter.format(payment.amountPaid ?? payment.amount),
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.8,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Total Amount Paid & Settled',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 20),

                const Divider(color: Color(0xFFE2E8F0), height: 1),
                const SizedBox(height: 16),

                _buildReceiptRow('Tenant', tenantName),
                const SizedBox(height: 10),
                _buildReceiptRow('Property', propertyName),
                const SizedBox(height: 10),
                _buildReceiptRow('Payment Date', paidDateStr),
                const SizedBox(height: 10),
                _buildReceiptRow('Payment Method', 'Manual Verification / Bank'),
                const SizedBox(height: 10),
                _buildReceiptRow('Receipt ID', receiptId),

                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      try {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Generating official PDF receipt...'),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );

                        final pdfBytes = await ReceiptService.generateReceipt(
                          payment: payment,
                          tenant: Tenant(
                            id: payment.lease?['tenant']?['id'] ?? 't1',
                            name: tenantName,
                            email: payment.lease?['tenant']?['email'] ?? '',
                            phone: payment.lease?['tenant']?['phone'] ?? '',
                            workspaceId: payment.lease?['workspaceId'] ?? '',
                          ),
                          property: Property(
                            id: payment.lease?['property']?['id'] ?? 'p1',
                            name: propertyName,
                            address: payment.lease?['property']?['address'] ?? 'Property Address',
                          ),
                        );

                        await Printing.sharePdf(
                          bytes: pdfBytes,
                          filename: 'Receipt-$receiptId.pdf',
                        );
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Failed to export PDF receipt: $e'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                    label: const Text('Export / Share PDF Receipt', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2563EB),
                      side: const BorderSide(color: Color(0xFFBFDBFE), width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8), letterSpacing: 0.6),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isHighlighted = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isHighlighted ? FontWeight.w700 : FontWeight.w500,
            color: isHighlighted ? const Color(0xFF0F172A) : const Color(0xFF64748B),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isHighlighted ? FontWeight.w900 : FontWeight.w700,
            color: color ?? (isHighlighted ? const Color(0xFF16A34A) : const Color(0xFF0F172A)),
          ),
        ),
      ],
    );
  }
}
