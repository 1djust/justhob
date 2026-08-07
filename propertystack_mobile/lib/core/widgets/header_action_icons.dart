import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HeaderActionIcons extends StatelessWidget {
  final bool hasUnreadNotifications;

  const HeaderActionIcons({
    super.key,
    this.hasUnreadNotifications = true,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. Help Center Icon
        InkWell(
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Opening Help Center...')),
            );
          },
          borderRadius: BorderRadius.circular(20),
          child: const Padding(
            padding: EdgeInsets.all(5.0),
            child: Icon(
              Icons.help_outline_rounded,
              color: Color(0xFF475569),
              size: 22,
            ),
          ),
        ),
        const SizedBox(width: 2),

        // 2. Notifications Icon with Red Badge Dot
        InkWell(
          onTap: () => context.push('/notifications'),
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(5.0),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(
                  Icons.notifications_none_rounded,
                  color: Color(0xFF475569),
                  size: 22,
                ),
                if (hasUnreadNotifications)
                  Positioned(
                    top: 1,
                    right: 2,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 1),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 2),

        // 3. User Profile Icon
        InkWell(
          onTap: () => context.push('/profile'),
          borderRadius: BorderRadius.circular(20),
          child: const Padding(
            padding: EdgeInsets.all(5.0),
            child: Icon(
              Icons.person_outline_rounded,
              color: Color(0xFF475569),
              size: 22,
            ),
          ),
        ),
      ],
    );
  }
}
