import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'landlord_payments_notifier.dart';
import '../../../../core/widgets/landlord_bottom_nav_bar.dart';
import '../../../../core/widgets/header_action_icons.dart';
import '../data/landlord_payments_repository.dart';
import '../../tenants/presentation/tenants_notifier.dart';
import '../../../../shared/domain/payment.dart';

class LandlordPaymentsScreen extends ConsumerStatefulWidget {
  const LandlordPaymentsScreen({super.key});

  @override
  ConsumerState<LandlordPaymentsScreen> createState() => _LandlordPaymentsScreenState();
}

class _LandlordPaymentsScreenState extends ConsumerState<LandlordPaymentsScreen> {


  @override
  Widget build(BuildContext context) {
    final paymentsState = ref.watch(landlordPaymentsProvider);
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await ref.read(landlordPaymentsProvider.notifier).fetchPayments();
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Header Bar
                _buildHeader(context),
                const SizedBox(height: 20),

                // 2. Hero Total Collected Card
                paymentsState.when(
                  data: (payments) {
                    double totalCollected = 0.0;
                    double paidRatio = 0.0;
                    double pendingRatio = 0.0;
                    double overdueRatio = 0.0;

                    if (payments.isNotEmpty) {
                      final totalAmount = payments.fold<double>(0, (sum, p) => sum + p.amount);
                      final paidAmount = payments
                          .where((p) => p.status == 'PAID' || p.status == 'PARTIALLY_PAID')
                          .fold<double>(0, (sum, p) => sum + (p.amountPaid ?? p.amount));
                      final pendingAmount = payments
                          .where((p) => p.status == 'UNDER_REVIEW' || p.status == 'PENDING')
                          .fold<double>(0, (sum, p) => sum + p.amount);
                      final overdueAmount = payments
                          .where((p) => p.status == 'OVERDUE')
                          .fold<double>(0, (sum, p) => sum + p.amount);

                      if (totalAmount > 0) {
                        totalCollected = paidAmount;
                        paidRatio = (paidAmount / totalAmount).clamp(0.0, 1.0);
                        pendingRatio = (pendingAmount / totalAmount).clamp(0.0, 1.0);
                        overdueRatio = (overdueAmount / totalAmount).clamp(0.0, 1.0);
                      }
                    }

                    final underReviewList = payments.where((p) => p.status == 'UNDER_REVIEW').toList();

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildHeroCollectedCard(
                          currencyFormatter.format(totalCollected),
                          paidRatio: paidRatio,
                          pendingRatio: pendingRatio,
                          overdueRatio: overdueRatio,
                        ),
                        if (underReviewList.isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _buildPendingVerificationInbox(context, underReviewList),
                        ],
                      ],
                    );
                  },
                  loading: () => _buildHeroCollectedCard('₦0', paidRatio: 0, pendingRatio: 0, overdueRatio: 0),
                  error: (_, __) => _buildHeroCollectedCard('₦0', paidRatio: 0, pendingRatio: 0, overdueRatio: 0),
                ),
                const SizedBox(height: 16),

                // Status Filter Chips
                _buildFilterChips(),
                const SizedBox(height: 16),

                // 3. Recent Transactions Title & + Record Payment Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Recent Transactions',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.4,
                      ),
                    ),
                    Row(
                      children: [
                        InkWell(
                          onTap: () => _showRecordOfflinePaymentBottomSheet(context),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.add_rounded, size: 16, color: Color(0xFF2563EB)),
                                SizedBox(width: 4),
                                Text(
                                  'Record Pay',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF2563EB),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () => _showAllTransactionsModal(context),
                          borderRadius: BorderRadius.circular(8),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            child: Text(
                              'View All',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 4. Transactions List
                paymentsState.when(
                  data: (payments) {
                    final filteredReal = _selectedStatusFilter == 'ALL'
                        ? payments
                        : payments.where((p) => p.status == _selectedStatusFilter).toList();

                    if (filteredReal.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 30),
                        child: Center(
                          child: Text(
                            'No payment transactions found.',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                          ),
                        ),
                      );
                    }

                    return ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredReal.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        return _buildRealPaymentCard(context, filteredReal[index]);
                      },
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
                  ),
                  error: (err, stack) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text(
                        'Failed to load payments. Swipe down to refresh.',
                        style: const TextStyle(color: Color(0xFFEF4444), fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: const LandlordBottomNavBar(currentIndex: 3),
    );
  }

  /// 1. Header Bar with Title & Top Right Icons
  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Payments',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: 4),
              Text(
                'Track cashflow and rental invoices',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF64748B),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        const HeaderActionIcons(),
      ],
    );
  }

  /// 2. Hero Blue Total Collected Card
  Widget _buildHeroCollectedCard(
    String totalCollectedAmount, {
    double paidRatio = 0.0,
    double pendingRatio = 0.0,
    double overdueRatio = 0.0,
  }) {
    final paidPct = (paidRatio * 100).round();
    final pendingPct = (pendingRatio * 100).round();
    final overduePct = (overdueRatio * 100).round();
    final hasMetrics = paidRatio > 0 || pendingRatio > 0 || overdueRatio > 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB), // Vibrant Royal Blue
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withAlpha(80),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Upper Label
          Text(
            'TOTAL COLLECTED (THIS MONTH)',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white.withAlpha(210),
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 10),

          // Total Amount
          Text(
            totalCollectedAmount,
            style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.8,
            ),
          ),
          const SizedBox(height: 20),

          // Segmented Multi-Color Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 8,
              width: double.infinity,
              child: hasMetrics
                  ? Row(
                      children: [
                        if (paidPct > 0)
                          Expanded(
                            flex: paidPct.clamp(1, 100),
                            child: Container(color: const Color(0xFF22C55E)), // Emerald Green
                          ),
                        if (paidPct > 0 && (pendingPct > 0 || overduePct > 0)) const SizedBox(width: 2),
                        if (pendingPct > 0)
                          Expanded(
                            flex: pendingPct.clamp(1, 100),
                            child: Container(color: const Color(0xFFF59E0B)), // Amber
                          ),
                        if (pendingPct > 0 && overduePct > 0) const SizedBox(width: 2),
                        if (overduePct > 0)
                          Expanded(
                            flex: overduePct.clamp(1, 100),
                            child: Container(color: const Color(0xFFEF4444)), // Red
                          ),
                      ],
                    )
                  : Container(color: Colors.white.withAlpha(40)),
            ),
          ),
          const SizedBox(height: 14),

          // Legend Text Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Paid ($paidPct%)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withAlpha(230),
                ),
              ),
              Text(
                'Pending ($pendingPct%)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withAlpha(230),
                ),
              ),
              Text(
                'Overdue ($overduePct%)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withAlpha(230),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Pending Verification Inbox Banner (Smart Approval Inbox)
  Widget _buildPendingVerificationInbox(BuildContext context, List<Payment> list) {
    if (list.isEmpty) return const SizedBox.shrink();

    final count = list.length;
    final first = list.first;
    final tenantName = first.lease?['tenant']?['name'] ?? 'A tenant';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF), // Soft Blue
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_user_rounded, color: Color(0xFF2563EB), size: 20),
              const SizedBox(width: 8),
              const Text(
                'Pending Verification',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E40AF),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '$tenantName submitted payment proof. Review and confirm to update tenant ledger.',
            style: const TextStyle(fontSize: 13, color: Color(0xFF1E3A8A)),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton.icon(
              onPressed: () {
                context.push('/landlord/payments/review', extra: first);
              },
              icon: const Icon(Icons.thumb_up_alt_rounded, size: 16),
              label: const Text('Review Proof & Approve', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _selectedStatusFilter = 'ALL';

  /// Status Filter Chips (All, Pending, Under Review, Paid, Overdue)
  Widget _buildFilterChips() {
    final filters = [
      {'id': 'ALL', 'label': 'All'},
      {'id': 'PENDING', 'label': 'Pending'},
      {'id': 'UNDER_REVIEW', 'label': 'Under Review'},
      {'id': 'PAID', 'label': 'Paid'},
      {'id': 'OVERDUE', 'label': 'Overdue'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isSelected = _selectedStatusFilter == f['id'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(
                f['label']!,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                ),
              ),
              selected: isSelected,
              selectedColor: const Color(0xFF2563EB),
              backgroundColor: Colors.white,
              side: BorderSide(
                color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
              ),
              onSelected: (selected) {
                if (selected) {
                  setState(() {
                    _selectedStatusFilter = f['id']!;
                  });
                }
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  /// Bottom Sheet Modal to Record an Offline Payment
  void _showRecordOfflinePaymentBottomSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    final tenants = ref.read(tenantsProvider).valueOrNull ?? [];

    String? selectedLeaseId;
    String status = 'PAID';
    final amountController = TextEditingController();
    final noteController = TextEditingController();
    DateTime dueDate = DateTime.now();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
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
                child: SingleChildScrollView(
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
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.credit_card_rounded, color: Color(0xFF2563EB), size: 24),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Record Offline Payment',
                                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                ),
                                Text(
                                  'Capture manual rent payment or cash deposit',
                                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Tenant Picker
                      const Text(
                        'Select Active Tenant Lease *',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            hint: Text(
                              tenants.isEmpty ? 'No active tenants available' : 'Choose tenant lease...',
                              style: const TextStyle(color: Color(0xFF94A3B8)),
                            ),
                            value: selectedLeaseId,
                            items: tenants.isEmpty
                                ? []
                                : tenants.map((t) {
                                    return DropdownMenuItem<String>(
                                      value: t.leaseId ?? t.id,
                                      child: Text('${t.name} — ${t.propertyName} (Unit ${t.unitNumber})'),
                                    );
                                  }).toList(),
                            onChanged: tenants.isEmpty
                                ? null
                                : (val) {
                                    setSheetState(() {
                                      selectedLeaseId = val;
                                    });
                                  },
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Payment Amount
                      const Text(
                        'Payment Amount (₦) *',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: amountController,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        decoration: InputDecoration(
                          hintText: 'e.g. 500000',
                          prefixText: '₦ ',
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
                            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Status Selector
                      const Text(
                        'Status *',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            value: status,
                            items: const [
                              DropdownMenuItem(value: 'PAID', child: Text('PAID (Settled)')),
                              DropdownMenuItem(value: 'PENDING', child: Text('PENDING (Invoice)')),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setSheetState(() => status = val);
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Note / Reference
                      const Text(
                        'Reference / Note',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: noteController,
                        style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                        decoration: InputDecoration(
                          hintText: 'e.g. Annual Rent Cash Deposit',
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
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
                            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: () async {
                            if (selectedLeaseId == null) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                const SnackBar(content: Text('Please select an active tenant lease.')),
                              );
                              return;
                            }
                            final parsedAmount = double.tryParse(amountController.text.trim());
                            if (parsedAmount == null || parsedAmount <= 0) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                const SnackBar(content: Text('Please enter a valid payment amount.')),
                              );
                              return;
                            }
                            final note = noteController.text.trim();
                            Navigator.of(ctx).pop();
                            await _performRecordOfflinePayment(
                              leaseId: selectedLeaseId!,
                              amount: parsedAmount,
                              dueDate: DateFormat('yyyy-MM-dd').format(dueDate),
                              status: status,
                              note: note.isNotEmpty ? note : null,
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Text('Record Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _performRecordOfflinePayment({
    required String leaseId,
    required double amount,
    required String dueDate,
    required String status,
    String? note,
  }) async {
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    final repository = ref.read(landlordPaymentsRepositoryProvider);

    try {
      if (workspaceId != null) {
        await repository.recordOfflinePayment(
          workspaceId: workspaceId,
          leaseId: leaseId,
          amount: amount,
          dueDate: dueDate,
          status: status,
          note: note,
        );
      }

      ref.invalidate(landlordPaymentsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Offline payment of ₦${amount.toStringAsFixed(0)} recorded successfully!'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF15803D),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to record payment: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }



  /// Real Payment Card from API
  Widget _buildRealPaymentCard(BuildContext context, Payment payment) {
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final dateFormatter = DateFormat('MMM dd, yyyy');

    final leaseMap = payment.lease;
    final tenantName = leaseMap?['tenant']?['name'] ?? 'Tenant';
    final dateStr = dateFormatter.format(payment.dueDate);

    Color statusColor;
    Color statusBg;
    String statusText;

    switch (payment.status) {
      case 'PAID':
        statusColor = const Color(0xFF15803D);
        statusBg = const Color(0xFFDCFCE7);
        statusText = 'Paid';
        break;
      case 'PARTIALLY_PAID':
        statusColor = const Color(0xFF2563EB);
        statusBg = const Color(0xFFEFF6FF);
        statusText = 'Partial';
        break;
      case 'UNDER_REVIEW':
      case 'PENDING':
        statusColor = const Color(0xFFD97706);
        statusBg = const Color(0xFFFFFBEB);
        statusText = 'Pending';
        break;
      case 'OVERDUE':
        statusColor = const Color(0xFFEF4444);
        statusBg = const Color(0xFFFEF2F2);
        statusText = 'Overdue';
        break;
      default:
        statusColor = const Color(0xFF64748B);
        statusBg = const Color(0xFFF1F5F9);
        statusText = payment.status;
    }

    return InkWell(
      onTap: () {
        context.push('/landlord/payments/review', extra: payment);
      },
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(5),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            // Credit Card Square Icon Container
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.credit_card_rounded,
                color: Color(0xFF2563EB),
                size: 22,
              ),
            ),
            const SizedBox(width: 14),

            // Tenant Name & Date
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tenantName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    dateStr,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),

            // Amount & Status Badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  currencyFormatter.format(payment.amount),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showAllTransactionsModal(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.85,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'All Transactions',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: Builder(
                  builder: (context) {
                    final payments = ref.watch(landlordPaymentsProvider).valueOrNull ?? [];
                    if (payments.isEmpty) {
                      return const Center(
                        child: Text(
                          'No transaction records found.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                        ),
                      );
                    }
                    return ListView.separated(
                      itemCount: payments.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        return _buildRealPaymentCard(context, payments[index]);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}
