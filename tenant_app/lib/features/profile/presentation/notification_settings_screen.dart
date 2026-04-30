import 'package:flutter/material.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  // Mock state for notification preferences
  bool _pushEnabled = true;
  bool _emailEnabled = true;
  bool _maintenanceUpdates = true;
  bool _paymentReminders = true;
  bool _announcements = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF18181B)),
        titleTextStyle: theme.textTheme.titleLarge?.copyWith(
          color: const Color(0xFF18181B),
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
            const Divider(height: 1, color: Color(0xFFE4E4E7)),
            _buildToggleTile(
              title: 'Email Notifications',
              subtitle: 'Receive updates in your inbox.',
              value: _emailEnabled,
              onChanged: (val) => setState(() => _emailEnabled = val),
            ),
            const SizedBox(height: 32),
            _buildSectionHeader('Notification Types'),
            _buildToggleTile(
              title: 'Maintenance Updates',
              subtitle: 'Status changes on your repair requests.',
              value: _maintenanceUpdates,
              onChanged: (val) => setState(() => _maintenanceUpdates = val),
              enabled: _pushEnabled || _emailEnabled,
            ),
            const Divider(height: 1, color: Color(0xFFE4E4E7)),
            _buildToggleTile(
              title: 'Payment Reminders',
              subtitle: 'Alerts for upcoming and overdue invoices.',
              value: _paymentReminders,
              onChanged: (val) => setState(() => _paymentReminders = val),
              enabled: _pushEnabled || _emailEnabled,
            ),
            const Divider(height: 1, color: Color(0xFFE4E4E7)),
            _buildToggleTile(
              title: 'Announcements',
              subtitle: 'News and updates from your property manager.',
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
          color: Color(0xFFA1A1AA),
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
            color: Color(0xFF18181B),
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(
            fontSize: 14,
            color: Color(0xFF71717A),
          ),
        ),
        value: value,
        onChanged: enabled ? onChanged : null,
        activeColor: const Color(0xFF18181B),
        contentPadding: const EdgeInsets.symmetric(vertical: 8),
      ),
    );
  }
}
