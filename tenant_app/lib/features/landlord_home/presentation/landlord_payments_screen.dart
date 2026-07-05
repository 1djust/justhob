import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'landlord_payments_notifier.dart';
import '../../../../shared/domain/payment.dart';
import '../../../../core/theme/app_theme.dart';

class LandlordPaymentsScreen extends ConsumerStatefulWidget {
  const LandlordPaymentsScreen({super.key});

  @override
  ConsumerState<LandlordPaymentsScreen> createState() => _LandlordPaymentsScreenState();
}

class _LandlordPaymentsScreenState extends ConsumerState<LandlordPaymentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final paymentsState = ref.watch(landlordPaymentsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rent Transactions'),
        bottom: TabBar(
          controller: _tabController,
          labelStyle: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
          unselectedLabelStyle: theme.textTheme.labelMedium,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Review'),
            Tab(text: 'Paid'),
            Tab(text: 'Overdue'),
          ],
        ),
      ),
      body: paymentsState.when(
        data: (payments) {
          if (payments.isEmpty) {
            return const Center(child: Text('No rent transactions recorded.'));
          }

          // Calculate stats
          final totalCollected = payments
              .where((p) => p.status == 'PAID' || p.status == 'PARTIALLY_PAID')
              .fold<double>(0, (sum, p) => sum + (p.amountPaid ?? p.amount));

          final pendingVerify = payments.where((p) => p.status == 'UNDER_REVIEW').length;
          final totalOverdue = payments.where((p) => p.status == 'OVERDUE').length;

          return Column(
            children: [
              // Stats Banner
              _buildStatsHeader(context, totalCollected, pendingVerify, totalOverdue),
              
              // Tab Views
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildPaymentsList(context, payments), // All
                    _buildPaymentsList(context, payments.where((p) => p.status == 'UNDER_REVIEW').toList()), // Review
                    _buildPaymentsList(context, payments.where((p) => p.status == 'PAID' || p.status == 'PARTIALLY_PAID').toList()), // Paid
                    _buildPaymentsList(context, payments.where((p) => p.status == 'OVERDUE').toList()), // Overdue
                  ],
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error loading transactions: $err')),
      ),
    );
  }

  Widget _buildStatsHeader(
    BuildContext context,
    double totalCollected,
    int pendingVerify,
    int totalOverdue,
  ) {
    final theme = Theme.of(context);
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Container(
      padding: const EdgeInsets.all(16.0),
      color: theme.colorScheme.surface,
      child: Row(
        children: [
          Expanded(
            child: _buildStatCard(
              context,
              title: 'COLLECTED',
              value: currencyFormatter.format(totalCollected),
              color: const Color(0xFF10B981),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildStatCard(
              context,
              title: 'PENDING',
              value: '$pendingVerify',
              color: Colors.orange,
              isBadge: true,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildStatCard(
              context,
              title: 'OVERDUE',
              value: '$totalOverdue',
              color: Colors.red,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(
    BuildContext context, {
    required String title,
    required String value,
    required Color color,
    bool isBadge = false,
  }) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 8.0),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentsList(BuildContext context, List<Payment> list) {
    if (list.isEmpty) {
      return const Center(child: Text('No transactions in this category.'));
    }

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(landlordPaymentsProvider.notifier).fetchPayments();
      },
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        itemCount: list.length,
        itemBuilder: (context, index) {
          final payment = list[index];
          return _buildPaymentCard(context, payment);
        },
      ),
    );
  }

  Widget _buildPaymentCard(BuildContext context, Payment payment) {
    final theme = Theme.of(context);
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final dateFormatter = DateFormat('MMM d, yyyy');

    // Parse tenant and property details from nested lease object safely
    final leaseMap = payment.lease;
    final tenantName = leaseMap?['tenant']?['name'] ?? 'Unknown Tenant';
    final propertyName = leaseMap?['property']?['name'] ?? 'Unknown Property';

    Color statusColor;
    String statusLabel;

    switch (payment.status) {
      case 'PAID':
        statusColor = const Color(0xFF10B981);
        statusLabel = 'PAID';
        break;
      case 'PARTIALLY_PAID':
        statusColor = Colors.blue;
        statusLabel = 'PARTIAL';
        break;
      case 'UNDER_REVIEW':
        statusColor = Colors.orange;
        statusLabel = 'REVIEW';
        break;
      case 'OVERDUE':
        statusColor = Colors.red;
        statusLabel = 'OVERDUE';
        break;
      default:
        statusColor = AppTheme.textSecondary;
        statusLabel = 'PENDING';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      child: InkWell(
        onTap: () {
          context.push('/landlord/payments/review', extra: payment);
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      tenantName,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withAlpha(26),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      statusLabel,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                propertyName,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Method: ${payment.proofUrl != null ? 'Bank Transfer' : (payment.status == 'PAID' ? 'Online Payment' : 'TBD')}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  Text(
                    'ID: ${payment.id.split('-').first.toUpperCase()}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppTheme.textSecondary,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AMOUNT DUE',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        currencyFormatter.format(payment.amount),
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'DUE DATE',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dateFormatter.format(payment.dueDate),
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (payment.status == 'UNDER_REVIEW') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(8.0),
                  decoration: BoxDecoration(
                    color: Colors.orange.withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.withAlpha(30)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.rate_review_outlined, color: Colors.orange, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Tenant submitted proof of payment. Tap to verify.',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.orange, size: 16),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
