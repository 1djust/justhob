import 'package:flutter/material.dart';
import 'package:tenant_app/core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'home_notifier.dart';
import 'notifications_notifier.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../payments/presentation/payments_notifier.dart';
import 'package:intl/intl.dart';
import '../../../shared/domain/payment_info.dart';
import '../../../shared/domain/lease_renewal_offer.dart';
import '../../../core/utils/nigerian_banks.dart';
import '../../../core/services/update_service.dart';
import '../../../core/widgets/app_update_dialog.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    final updateService = UpdateService();
    final updateInfo = await updateService.checkForUpdate();
    if (updateInfo != null && mounted) {
      AppUpdateDialog.show(context, updateInfo);
    }
  }

  @override
  Widget build(BuildContext context) {
    final homeState = ref.watch(homeStateProvider);
    final theme = Theme.of(context);

    // --- LAYER 3: BULLETPROOF NULL-SAFE DATA EXTRACTION ---
    // Use ?. and ?? [] at every step so a null/missing list can never
    // reach a .map() or .expand() call inside build() and cause a blank screen.
    final paymentsList = ref.watch(paymentsProvider).valueOrNull ?? [];
    final today = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);

    final overduePayments = paymentsList
            .where((p) => 
                p.status == 'OVERDUE' || 
                p.status == 'PARTIALLY_PAID' || 
                (p.status == 'PENDING' && p.dueDate.isBefore(today)))
            .toList();

    final upcomingPayments = paymentsList
            .where((p) => 
                p.status == 'PENDING' && 
                !p.dueDate.isBefore(today) && 
                p.dueDate.isBefore(today.add(const Duration(days: 14))))
            .toList();

    final pendingRenewals = homeState
            .valueOrNull
            ?.leases
            ?.expand((l) => l.renewalOffers ?? <LeaseRenewalOffer>[])
            .where((o) => o.status == 'PENDING')
            .toList() ??
        [];

    final isRestricted = overduePayments.any((p) => p.dueDate.difference(DateTime.now()).inDays <= -14);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            onPressed: () => context.push('/notifications'),
            icon: Stack(
              children: [
                const Icon(Icons.notifications_outlined),
                ref.watch(notificationsProvider).maybeWhen(
                  data: (notifications) {
                    final unreadCount = notifications.where((n) => !n.isRead).length;
                    if (unreadCount > 0) {
                      return Positioned(
                        right: 0,
                        top: 0,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 12,
                            minHeight: 12,
                          ),
                          child: Text(
                            '$unreadCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                  orElse: () => const SizedBox.shrink(),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: homeState.when(
        data: (tenant) {
          if (tenant == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.person_off_outlined, size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text('No tenant profile found', style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                ],
              ),
            );
          }
          
          final lease = tenant.leases?.isNotEmpty == true ? tenant.leases!.first : null;
          final property = lease?.property;

          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(homeStateProvider.notifier).refresh();
              await ref.read(notificationsProvider.notifier).fetchNotifications();
              ref.invalidate(paymentsProvider);
            },
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Welcome,',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    tenant.name,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: theme.colorScheme.primary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Lease Renewal Banner — only shown when offers exist and is null-safe
                  if (pendingRenewals.isNotEmpty) ...[
                    _LeaseRenewalBanner(offers: pendingRenewals),
                    const SizedBox(height: 24),
                  ],

                  // Overdue Rent Banner — only shown when data exists and is null-safe
                  if (overduePayments.isNotEmpty) ...[
                    _OverdueBanner(payments: overduePayments),
                    const SizedBox(height: 24),
                  ],

                  // Upcoming Payment Banner
                  if (overduePayments.isEmpty && upcomingPayments.isNotEmpty) ...[
                    _UpcomingPaymentBanner(payments: upcomingPayments),
                    const SizedBox(height: 24),
                  ],

                  // Active Lease Card
                  _LeaseCard(property: property, lease: lease),
                  
                  if (lease?.paymentInfo != null) ...[
                    const SizedBox(height: 24),
                    _DashboardPaymentAccountCard(paymentInfo: lease!.paymentInfo!),
                  ],
                  
                  const SizedBox(height: 32),
                  
                  // Quick Actions
                  Text(
                    'Quick Actions',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _QuickAction(
                        icon: Icons.handyman_outlined,
                        label: 'Maintenance',
                        color: isRestricted ? Colors.grey : Colors.orange.shade600,
                        onTap: () {
                          if (isRestricted) {
                            showDialog(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('Feature Restricted'),
                                content: const Text('Please settle your overdue rent of 14+ days to access platform benefits like Maintenance.'),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(context),
                                    child: const Text('Close'),
                                  ),
                                ],
                              ),
                            );
                          } else {
                            context.push('/maintenance');
                          }
                        },
                      ),
                      const SizedBox(width: 16),
                      _QuickAction(
                        icon: Icons.account_balance_wallet_outlined,
                        label: 'Payments',
                        color: theme.colorScheme.secondary,
                        onTap: () => context.push('/payments'),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Recent Maintenance
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Recent Requests',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.2,
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/maintenance'),
                        style: TextButton.styleFrom(
                          minimumSize: Size.zero,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('View All'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (tenant.maintenanceRequests?.isEmpty ?? true)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Center(
                        child: Text(
                          'No recent maintenance requests.',
                          style: TextStyle(color: Colors.grey.shade500),
                        ),
                      ),
                    )
                  else
                    ...tenant.maintenanceRequests!.take(3).map((req) => _MaintenanceItem(request: req)),
                ],
              ),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) {
          final isAuthError = err.toString().contains('401');
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    isAuthError 
                      ? 'Session Expired' 
                      : 'Unable to Load Dashboard',
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isAuthError
                      ? 'Your security token is no longer valid. Please log in again.'
                      : 'Please check your connection and try again.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 32),
                  if (isAuthError)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          ref.read(authStateProvider.notifier).logout();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    )
                  else
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => ref.refresh(homeStateProvider),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LeaseCard extends StatelessWidget {
  final dynamic property;
  final dynamic lease;

  const _LeaseCard({this.property, this.lease});

  @override
  Widget build(BuildContext context) {
    if (lease == null) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Text('No Active Lease', style: TextStyle(color: Colors.white)),
      );
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            AppTheme.textPrimary, // Slate 800
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withAlpha(63),
            blurRadius: 20,
            offset: const Offset(0, 8),
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
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(38),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'ACTIVE LEASE',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.greenAccent.withAlpha(51),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.circle, size: 8, color: Colors.greenAccent),
                    const SizedBox(width: 6),
                    Text(
                      'Verified',
                      style: TextStyle(color: Colors.greenAccent.shade100, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            property?.name ?? 'Assigned Property',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.location_on_outlined, size: 14, color: Colors.grey.shade400),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  property?.address ?? 'No address available',
                  style: TextStyle(color: Colors.grey.shade300, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          
          // Expiry Date Section
          if (lease?.endDate != null) ...[
            _ExpiryBadge(endDate: lease!.endDate!),
            const SizedBox(height: 16),
          ],

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Yearly Rent', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    NumberFormat.currency(symbol: '₦ ', decimalDigits: 0).format(lease?.yearlyRent ?? 0),
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ExpiryBadge extends StatelessWidget {
  final DateTime endDate;

  const _ExpiryBadge({required this.endDate});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final difference = endDate.difference(now).inDays;
    
    Color color;
    String label;
    if (difference < 0) {
      color = Colors.red.shade400;
      label = 'Expired';
    } else if (difference <= 30) {
      color = Colors.red.shade400;
      label = '$difference days left';
    } else if (difference <= 90) {
      color = Colors.orange.shade400;
      label = '$difference days left';
    } else {
      color = Colors.greenAccent;
      label = '$difference days left';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withAlpha(25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withAlpha(25),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.event_available, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LEASE EXPIRES',
                  style: TextStyle(
                    color: Colors.grey.shade400,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('dd MMMM yyyy').format(endDate),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withAlpha(38),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: color.withAlpha(51)),
            ),
            child: Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Ink(
            padding: const EdgeInsets.symmetric(vertical: 24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withAlpha(25),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: color, size: 30),
                ),
                const SizedBox(height: 12),
                Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MaintenanceItem extends StatelessWidget {
  final dynamic request;

  const _MaintenanceItem({required this.request});

  @override
  Widget build(BuildContext context) {
    final status = request.status.toString().toUpperCase();
    Color statusColor;
    if (status == 'RESOLVED' || status == 'COMPLETED') {
      statusColor = Colors.green;
    } else if (status == 'IN_PROGRESS') {
      statusColor = Colors.blue;
    } else {
      statusColor = Colors.orange;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Future: Navigate to request details
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Icon(Icons.build_outlined, color: Colors.grey.shade600, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.description,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat.yMMMd().format(request.createdAt),
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardPaymentAccountCard extends StatelessWidget {
  final PaymentInfo paymentInfo;

  const _DashboardPaymentAccountCard({required this.paymentInfo});

  @override
  Widget build(BuildContext context) {
    final isDirect = paymentInfo.payoutStrategy == 'DIRECT_TO_LANDLORD';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(12),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.account_balance_wallet, color: AppTheme.primaryColor, size: 22),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'RENT PAYMENT ACCOUNT',
                      style: TextStyle(
                        color: AppTheme.primaryColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    Text(
                      'Transfer your rent here',
                      style: TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.backgroundColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Column(
              children: [
                _AccountRow(label: 'Account Name', value: paymentInfo.accountName ?? 'N/A'),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: AppTheme.borderColor),
                ),
                _AccountRow(label: 'Account Number', value: paymentInfo.accountNumber ?? 'N/A', isCopyable: true),
                if (paymentInfo.bankCode != null) ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Divider(height: 1, color: AppTheme.borderColor),
                  ),
                  _AccountRow(label: 'Bank', value: NigerianBanks.getBankName(paymentInfo.bankCode)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDirect ? Colors.teal.withAlpha(25) : Colors.amber.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isDirect ? Icons.person_pin_rounded : Icons.business_center_rounded,
                  size: 16,
                  color: isDirect ? Colors.teal.shade700 : Colors.amber.shade700,
                ),
                const SizedBox(width: 8),
                Text(
                  isDirect ? 'Pay directly to Landlord' : 'Pay to Property Manager',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isDirect ? Colors.teal.shade800 : Colors.amber.shade800,
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

class _AccountRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isCopyable;

  const _AccountRow({required this.label, required this.value, this.isCopyable = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
        ),
        Row(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (isCopyable) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Account number copied to clipboard')),
                  );
                },
                child: Icon(Icons.copy_rounded, size: 14, color: Colors.blue.shade600),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _OverdueBanner
// Displays a warning strip when the tenant has overdue or partially-paid rent.
// Fully null-safe: only rendered when overduePayments.isNotEmpty is confirmed.
// ─────────────────────────────────────────────────────────────────────────────
class _OverdueBanner extends StatelessWidget {
  final List<dynamic> payments;

  const _OverdueBanner({required this.payments});

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.red.shade600, size: 20),
              const SizedBox(width: 8),
              Text(
                'Rent Overdue',
                style: TextStyle(
                  color: Colors.red.shade700,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...payments.map((p) {
            final balance = ((p.amount as num?)?.toDouble() ?? 0) -
                ((p.amountPaid as num?)?.toDouble() ?? 0);
            
            final daysOverdue = DateTime.now().difference(p.dueDate).inDays;
            final isPartial = p.status == 'PARTIALLY_PAID' || ((p.amountPaid as num?)?.toDouble() ?? 0) > 0;
            
            String rowLabel;
            if (isPartial) {
              rowLabel = 'Balance (due ${DateFormat('MMM d').format(p.dueDate)})';
            } else if (daysOverdue > 0) {
              rowLabel = 'Overdue (${daysOverdue}d) — ${DateFormat('MMM d').format(p.dueDate)}';
            } else {
              rowLabel = 'Due ${DateFormat('MMM d').format(p.dueDate)}';
            }
            
            return Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    rowLabel,
                    style: TextStyle(color: Colors.red.shade600, fontSize: 13),
                  ),
                  Text(
                    formatter.format(balance),
                    style: TextStyle(
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          Divider(color: Colors.red.shade200, height: 1),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => context.push('/payments'),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Pay Now',
                  style: TextStyle(
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.red.shade700),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _UpcomingPaymentBanner
// Displays an info strip when the tenant has an upcoming pending payment due soon.
class _UpcomingPaymentBanner extends StatelessWidget {
  final List<dynamic> payments;

  const _UpcomingPaymentBanner({required this.payments});

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline_rounded, color: Colors.amber.shade700, size: 20),
              const SizedBox(width: 8),
              Text(
                'Upcoming Payment',
                style: TextStyle(
                  color: Colors.amber.shade800,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...payments.map((p) {
            final balance = ((p.amount as num?)?.toDouble() ?? 0) -
                ((p.amountPaid as num?)?.toDouble() ?? 0);
            
            final daysUntilDue = p.dueDate.difference(DateTime.now()).inDays;
            final dueText = daysUntilDue <= 0 
                ? 'Due today' 
                : 'Due in $daysUntilDue ${daysUntilDue == 1 ? "day" : "days"}';
                
            return Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    dueText,
                    style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                  ),
                  Text(
                    formatter.format(balance),
                    style: TextStyle(
                      color: Colors.amber.shade900,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          Divider(color: Colors.amber.shade200, height: 1),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => context.push('/payments'),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Pay Now',
                  style: TextStyle(
                    color: Colors.amber.shade900,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.amber.shade900),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _LeaseRenewalBanner
// Displays a highlighted card when the tenant has a pending renewal offer.
// Fully null-safe: only rendered when pendingRenewals.isNotEmpty is confirmed.
// ─────────────────────────────────────────────────────────────────────────────
class _LeaseRenewalBanner extends ConsumerWidget {
  final List<LeaseRenewalOffer> offers;

  const _LeaseRenewalBanner({required this.offers});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final offer = offers.first;

    return GestureDetector(
      onTap: () => _showRenewalSheet(context, offer, ref),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.blue.shade600, Colors.blue.shade800],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.blue.shade200,
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.description_outlined, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Lease Renewal Offer',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'New rent: ${formatter.format(offer.newRent)} / year — Tap to review',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  void _showRenewalSheet(BuildContext context, LeaseRenewalOffer offer, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RenewalOfferSheet(offer: offer, ref: ref),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _RenewalOfferSheet — bottom sheet to accept or reject a renewal offer.
// ─────────────────────────────────────────────────────────────────────────────
class _RenewalOfferSheet extends StatefulWidget {
  final LeaseRenewalOffer offer;
  final WidgetRef ref;

  const _RenewalOfferSheet({required this.offer, required this.ref});

  @override
  State<_RenewalOfferSheet> createState() => _RenewalOfferSheetState();
}

class _RenewalOfferSheetState extends State<_RenewalOfferSheet> {
  bool _isLoading = false;

  Future<void> _respond(bool accept) async {
    setState(() => _isLoading = true);
    try {
      await widget.ref.read(homeStateProvider.notifier).respondToRenewalOffer(
            widget.offer.leaseId,
            widget.offer.id,
            accept,
          );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(accept ? 'Renewal offer accepted!' : 'Renewal offer declined.'),
            backgroundColor: accept ? Colors.green : Colors.grey.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final dateFormat = DateFormat('MMM d, yyyy');

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Lease Renewal Offer',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            _row('New Rent', '${formatter.format(widget.offer.newRent)} / year'),
            const SizedBox(height: 10),
            _row('Start Date', dateFormat.format(widget.offer.newStartDate)),
            const SizedBox(height: 10),
            _row('End Date', dateFormat.format(widget.offer.newEndDate)),
            if (widget.offer.terms?.isNotEmpty ?? false) ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              Text('Terms', style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(widget.offer.terms!),
            ],
            const SizedBox(height: 28),
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _respond(false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _respond(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue.shade700,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Accept', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey.shade600)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    );
  }
}
