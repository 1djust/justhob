import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:propertystack_mobile/core/theme/app_theme.dart';
import '../../auth/presentation/auth_notifier.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  // Notification preferences
  bool _pushEnabled = true;
  bool _emailEnabled = true;
  bool _maintenanceUpdates = true;
  bool _paymentReminders = true;
  bool _announcements = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = ref.watch(authStateProvider).valueOrNull;
    final role = user?.role ?? (user?.workspaces.firstOrNull?.role ?? 'TENANT');
    final isLandlord = role == 'LANDLORD';
    final isManager = role == 'PROPERTY_MANAGER' || role == 'SUPER_ADMIN';

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        titleTextStyle: theme.textTheme.titleLarge?.copyWith(
          color: AppTheme.textPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader('Delivery Methods'),
            _buildToggleTile(
              title: 'Push Notifications',
              subtitle: 'Receive alerts directly on your device.',
              value: _pushEnabled,
              onChanged: (val) => setState(() => _pushEnabled = val),
            ),
            const Divider(height: 1, color: AppTheme.borderColor),
            _buildToggleTile(
              title: 'Email Notifications',
              subtitle: 'Receive updates in your inbox.',
              value: _emailEnabled,
              onChanged: (val) => setState(() => _emailEnabled = val),
            ),
            const SizedBox(height: 32),
            _buildSectionHeader('Notification Types'),
            _buildToggleTile(
              title: isLandlord
                  ? 'Property & Maintenance'
                  : (isManager ? 'Maintenance Requests' : 'Maintenance Updates'),
              subtitle: isLandlord
                  ? 'Notifications on tenant repair requests across your properties.'
                  : (isManager
                      ? 'Alerts when tenants submit or update repair requests.'
                      : 'Status changes on your repair requests.'),
              value: _maintenanceUpdates,
              onChanged: (val) => setState(() => _maintenanceUpdates = val),
              enabled: _pushEnabled || _emailEnabled,
            ),
            const Divider(height: 1, color: AppTheme.borderColor),
            _buildToggleTile(
              title: isLandlord
                  ? 'Rent & Disbursement Alerts'
                  : (isManager ? 'Rent Collections & Due Dates' : 'Payment Reminders'),
              subtitle: isLandlord
                  ? 'Instant notifications when rent is collected or disbursed to your bank.'
                  : (isManager
                      ? 'Alerts for tenant rent payments and overdue balances.'
                      : 'Alerts for upcoming and overdue invoices.'),
              value: _paymentReminders,
              onChanged: (val) => setState(() => _paymentReminders = val),
              enabled: _pushEnabled || _emailEnabled,
            ),
            const Divider(height: 1, color: AppTheme.borderColor),
            _buildToggleTile(
              title: isLandlord
                  ? 'Manager & Portfolio Notices'
                  : (isManager ? 'Team & System Announcements' : 'Announcements'),
              subtitle: isLandlord
                  ? 'Important notices and reports from your property manager.'
                  : (isManager
                      ? 'Broadcast messages and platform updates.'
                      : 'News and updates from your property manager.'),
              value: _announcements,
              onChanged: (val) => setState(() => _announcements = val),
              enabled: _pushEnabled || _emailEnabled,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: AppTheme.textSecondary,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildToggleTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool enabled = true,
  }) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: SwitchListTile(
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(
            fontSize: 14,
            color: AppTheme.textSecondary,
          ),
        ),
        value: value,
        onChanged: enabled ? onChanged : null,
        activeThumbColor: AppTheme.textPrimary,
        contentPadding: const EdgeInsets.symmetric(vertical: 8),
      ),
    );
  }
}
