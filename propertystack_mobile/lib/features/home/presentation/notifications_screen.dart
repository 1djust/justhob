import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'notifications_notifier.dart';
import '../../../shared/domain/notification.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    // Trigger a fresh fetch when this screen opens
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(notificationsProvider.notifier).fetchNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            Expanded(
              child: notificationsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Center(
                    child: Text(
                      'Failed to load notifications. Swipe down to retry.',
                      style: const TextStyle(color: Color(0xFFEF4444), fontSize: 14),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                data: (items) => _buildList(items),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 12),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/landlord');
              }
            },
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: Color(0xFF0F172A),
              size: 20,
            ),
          ),
          const SizedBox(width: 4),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Notifications',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  'Stay on top of every update',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () =>
                ref.read(notificationsProvider.notifier).markAllAsRead(),
            child: const Text(
              'Mark all read',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2563EB),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<NotificationItem> items) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Color(0xFFEFF6FF),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.notifications_off_outlined,
                size: 48,
                color: Color(0xFF2563EB),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No notifications yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                'You\'ll be alerted here when payments, maintenance, or lease events happen.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final todayItems = items
        .where((n) => now.difference(n.createdAt).inDays == 0)
        .toList();
    final earlierItems = items
        .where((n) => now.difference(n.createdAt).inDays > 0)
        .toList();

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(notificationsProvider.notifier).fetchNotifications(),
      color: const Color(0xFF2563EB),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          if (todayItems.isNotEmpty) ...[
            _sectionLabel('TODAY'),
            const SizedBox(height: 8),
            ...todayItems.map((n) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _NotificationCard(
                    item: n,
                    onTap: () => _handleCardTap(n),
                  ),
                )),
            const SizedBox(height: 8),
          ],
          if (earlierItems.isNotEmpty) ...[
            _sectionLabel('EARLIER'),
            const SizedBox(height: 8),
            ...earlierItems.map((n) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _NotificationCard(
                    item: n,
                    onTap: () => _handleCardTap(n),
                  ),
                )),
          ],
          // Show all items if neither group has content (fallback)
          if (todayItems.isEmpty && earlierItems.isEmpty)
            ...items.map((n) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _NotificationCard(
                    item: n,
                    onTap: () => _handleCardTap(n),
                  ),
                )),
        ],
      ),
    );
  }

  void _handleCardTap(NotificationItem item) {
    if (!item.isRead) {
      ref.read(notificationsProvider.notifier).markAsRead(item.id);
    }
    final type = item.type.toUpperCase();
    if (type.contains('PAYMENT') || type.contains('OVERDUE') || type.contains('RENT')) {
      context.push('/landlord/payments');
    } else if (type.contains('MAINTENANCE') || type.contains('PLUMBING') || type.contains('REPAIR')) {
      context.push('/maintenance');
    } else if (type.contains('TENANT') || type.contains('LEASE') || type.contains('APPLICATION')) {
      context.push('/landlord/tenants');
    }
  }

  Widget _sectionLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: Color(0xFF94A3B8),
        letterSpacing: 1.2,
      ),
    );
  }
}

// --------------- _NotificationCard ---------------

class _NotificationCard extends StatelessWidget {
  final NotificationItem item;
  final VoidCallback onTap;

  const _NotificationCard({
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final config = _configFor(item.type);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: item.isRead
                  ? const Color(0xFFF1F5F9)
                  : const Color(0xFFBFDBFE),
              width: item.isRead ? 1 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(6),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: config.bgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(config.icon, color: config.iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              // Text content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: item.isRead
                                  ? FontWeight.w600
                                  : FontWeight.w800,
                              color: const Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          _timeAgo(item.createdAt),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.message,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF64748B),
                        height: 1.35,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (!item.isRead) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(
                    color: Color(0xFF2563EB),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return DateFormat('MMM d').format(dt);
  }

  _NotifConfig _configFor(String type) {
    switch (type.toUpperCase()) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_APPROVED':
        return _NotifConfig(
          bgColor: const Color(0xFFDCFCE7),
          iconColor: const Color(0xFF16A34A),
          icon: Icons.payments_rounded,
        );
      case 'RENT_OVERDUE':
      case 'OVERDUE':
        return _NotifConfig(
          bgColor: const Color(0xFFFEE2E2),
          iconColor: const Color(0xFFDC2626),
          icon: Icons.warning_amber_rounded,
        );
      case 'LEASE_EXPIRING':
      case 'LEASE_EXPIRING_SOON':
        return _NotifConfig(
          bgColor: const Color(0xFFFEF3C7),
          iconColor: const Color(0xFFD97706),
          icon: Icons.schedule_rounded,
        );
      case 'MAINTENANCE_LOGGED':
      case 'MAINTENANCE_COMPLETED':
      case 'PLUMBING_REQUEST':
        return _NotifConfig(
          bgColor: const Color(0xFFF0F9FF),
          iconColor: const Color(0xFF0284C7),
          icon: Icons.home_repair_service_rounded,
        );
      case 'TENANT_APPLICATION':
      case 'NEW_TENANT_APPLICATION':
        return _NotifConfig(
          bgColor: const Color(0xFFEDE9FE),
          iconColor: const Color(0xFF7C3AED),
          icon: Icons.person_add_rounded,
        );
      default:
        return _NotifConfig(
          bgColor: const Color(0xFFF1F5F9),
          iconColor: const Color(0xFF64748B),
          icon: Icons.notifications_rounded,
        );
    }
  }
}

class _NotifConfig {
  final Color bgColor;
  final Color iconColor;
  final IconData icon;
  _NotifConfig({
    required this.bgColor,
    required this.iconColor,
    required this.icon,
  });
}
