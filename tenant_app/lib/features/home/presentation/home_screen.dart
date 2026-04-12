import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'home_notifier.dart';
import 'notifications_notifier.dart';
import 'package:intl/intl.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeStateProvider);
    final theme = Theme.of(context);

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
              // Option: ref.read(homeStateProvider.notifier)._init();
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
                  
                  // Active Lease Card
                  _LeaseCard(property: property, lease: lease),
                  
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
                        color: Colors.orange.shade600,
                        onTap: () => context.push('/maintenance'),
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
        error: (err, stack) => Center(child: Text('Error: $err')),
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
            const Color(0xFF1E293B), // Slate 800
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.25),
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
                  color: Colors.white.withValues(alpha: 0.15),
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
                  color: Colors.greenAccent.withValues(alpha: 0.2),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Rent Amount', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
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
                    color: color.withValues(alpha: 0.1),
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
                  color: statusColor.withValues(alpha: 0.1),
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
