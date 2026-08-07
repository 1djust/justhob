import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

void showMoreOptionsSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const MoreOptionsSheet(),
  );
}

class MoreOptionsSheet extends StatelessWidget {
  const MoreOptionsSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle pill
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Sheet Title & Subtitle
          const Text(
            'More Features',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0F172A),
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Management tools not on the main menu',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 20),

          // 1. Owners Option
          _buildMoreOptionTile(
            context,
            title: 'Owners',
            subtitle: 'Manage property owners & payout strategies',
            icon: Icons.supervisor_account_rounded,
            iconBgColor: const Color(0xFFEFF6FF),
            iconColor: const Color(0xFF2563EB),
            onTap: () {
              Navigator.pop(context);
              context.push('/landlord/owners');
            },
          ),
          const SizedBox(height: 12),

          // 2. Occupancy Option
          _buildMoreOptionTile(
            context,
            title: 'Occupancy',
            subtitle: 'View unit occupancy rates & analytics',
            icon: Icons.pie_chart_rounded,
            iconBgColor: const Color(0xFFECFDF5),
            iconColor: const Color(0xFF059669),
            onTap: () {
              Navigator.pop(context);
              context.push('/landlord/occupancy');
            },
          ),
          const SizedBox(height: 12),

          // 3. Maintenance Option
          _buildMoreOptionTile(
            context,
            title: 'Maintenance',
            subtitle: 'Track work orders & tenant requests',
            icon: Icons.handyman_rounded,
            iconBgColor: const Color(0xFFFFFBEB),
            iconColor: const Color(0xFFD97706),
            onTap: () {
              Navigator.pop(context);
              context.push('/landlord/maintenance');
            },
          ),
          const SizedBox(height: 16),

          const Divider(color: Color(0xFFF1F5F9), thickness: 1),
          const SizedBox(height: 8),

          // Profile / Account Settings quick link
          InkWell(
            onTap: () {
              Navigator.pop(context);
              context.push('/profile');
            },
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
              child: Row(
                children: const [
                  Icon(Icons.settings_outlined, color: Color(0xFF64748B), size: 20),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Account Settings & Profile',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMoreOptionTile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF94A3B8),
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}
