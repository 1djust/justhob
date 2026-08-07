import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/auth_notifier.dart';

void showMoreOptionsOverlay(BuildContext context, WidgetRef ref) {
  HapticFeedback.mediumImpact();
  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    backgroundColor: Colors.white,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'More Options',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 16),

            // Grid of overlay items (Owners, Occupancy, Maintenance)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildOverlayItem(
                  context,
                  icon: Icons.people_outline_rounded,
                  label: 'Owners',
                  color: const Color(0xFF2563EB),
                  bgColor: const Color(0xFFEFF6FF),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/landlord/owners');
                  },
                ),
                _buildOverlayItem(
                  context,
                  icon: Icons.pie_chart_outline_rounded,
                  label: 'Occupancy',
                  color: const Color(0xFF16A34A),
                  bgColor: const Color(0xFFF0FDF4),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/landlord/occupancy');
                  },
                ),
                _buildOverlayItem(
                  context,
                  icon: Icons.build_outlined,
                  label: 'Maintenance',
                  color: const Color(0xFFD97706),
                  bgColor: const Color(0xFFFEFCE8),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/landlord/maintenance');
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Profile & Settings row
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildOverlayTextItem(
                    icon: Icons.person_outline_rounded,
                    label: 'Profile',
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/profile');
                    },
                  ),
                ),
                Expanded(
                  child: _buildOverlayTextItem(
                    icon: Icons.help_outline_rounded,
                    label: 'Help Center',
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Opening PropertyStack Support...')),
                      );
                    },
                  ),
                ),
                Expanded(
                  child: _buildOverlayTextItem(
                    icon: Icons.logout_rounded,
                    label: 'Sign Out',
                    color: const Color(0xFFEF4444),
                    onTap: () {
                      Navigator.pop(context);
                      ref.read(authStateProvider.notifier).logout();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _buildOverlayItem(
  BuildContext context, {
  required IconData icon,
  required String label,
  required Color color,
  required Color bgColor,
  required VoidCallback onTap,
}) {
  return InkWell(
    onTap: () {
      HapticFeedback.selectionClick();
      onTap();
    },
    borderRadius: BorderRadius.circular(16),
    child: Container(
      width: 96,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

Widget _buildOverlayTextItem({
  required IconData icon,
  required String label,
  required VoidCallback onTap,
  Color color = const Color(0xFF475569),
}) {
  return InkWell(
    onTap: () {
      HapticFeedback.selectionClick();
      onTap();
    },
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    ),
  );
}
