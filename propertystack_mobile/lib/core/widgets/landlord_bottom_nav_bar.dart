import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'more_options_overlay.dart';

class LandlordBottomNavBar extends ConsumerWidget {
  final int currentIndex; // 0: Home, 1: Properties, 2: Tenants, 3: Payments, 4: More

  const LandlordBottomNavBar({
    super.key,
    required this.currentIndex,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
        ),
      ),
      child: BottomNavigationBar(
        currentIndex: currentIndex > 3 ? 4 : currentIndex,
        onTap: (index) {
          HapticFeedback.selectionClick();
          if (index == currentIndex && index != 4) return;
          if (index == 0) {
            context.go('/landlord');
          } else if (index == 1) {
            context.go('/landlord/properties');
          } else if (index == 2) {
            context.go('/landlord/tenants');
          } else if (index == 3) {
            context.go('/landlord/payments');
          } else if (index == 4) {
            showMoreOptionsOverlay(context, ref);
          }
        },
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF2563EB),
        unselectedItemColor: const Color(0xFF94A3B8),
        selectedFontSize: 12,
        unselectedFontSize: 12,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
        elevation: 0,
        items: [
          BottomNavigationBarItem(
            icon: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: SvgPicture.asset(
                'assets/icon/home.svg',
                width: 22,
                height: 22,
                colorFilter: ColorFilter.mode(
                  currentIndex == 0 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  BlendMode.srcIn,
                ),
              ),
            ),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: SvgPicture.asset(
                'assets/icon/building.svg',
                width: 22,
                height: 22,
                colorFilter: ColorFilter.mode(
                  currentIndex == 1 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  BlendMode.srcIn,
                ),
              ),
            ),
            label: 'Properties',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: SvgPicture.asset(
                'assets/icon/users.svg',
                width: 22,
                height: 22,
                colorFilter: ColorFilter.mode(
                  currentIndex == 2 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  BlendMode.srcIn,
                ),
              ),
            ),
            label: 'Tenants',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: SvgPicture.asset(
                'assets/icon/credit-card.svg',
                width: 22,
                height: 22,
                colorFilter: ColorFilter.mode(
                  currentIndex == 3 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  BlendMode.srcIn,
                ),
              ),
            ),
            label: 'Payments',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: SvgPicture.asset(
                'assets/icon/menu.svg',
                width: 22,
                height: 22,
                colorFilter: ColorFilter.mode(
                  currentIndex == 4 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  BlendMode.srcIn,
                ),
              ),
            ),
            label: 'More',
          ),
        ],
      ),
    );
  }
}
