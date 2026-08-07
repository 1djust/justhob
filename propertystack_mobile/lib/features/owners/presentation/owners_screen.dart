import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/widgets/landlord_bottom_nav_bar.dart';
import '../../../../core/widgets/header_action_icons.dart';
import '../domain/owner_model.dart';
import 'owners_notifier.dart';

class OwnersScreen extends ConsumerStatefulWidget {
  const OwnersScreen({super.key});

  @override
  ConsumerState<OwnersScreen> createState() => _OwnersScreenState();
}

class _OwnersScreenState extends ConsumerState<OwnersScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }



  @override
  Widget build(BuildContext context) {
    final ownersState = ref.watch(ownersProvider);
    final filteredOwners = ownersState.filteredOwners;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Bar Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Landlords',
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.8,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Manage property owners and payouts',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        const HeaderActionIcons(),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Search Bar
                    Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (value) {
                          ref.read(ownersProvider.notifier).setSearchQuery(value);
                        },
                        decoration: const InputDecoration(
                          hintText: 'Search owners...',
                          hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                          prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF94A3B8)),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Stats Cards Row
                    Row(
                      children: [
                        // Card 1: Total Owners
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Total Owners',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${ownersState.totalOwners}',
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Card 2: Pending Setup
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(16.0),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      'Pending Setup',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFFD97706),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${ownersState.pendingSetupCount}',
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Owner Cards List
                    if (ownersState.isLoading && filteredOwners.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 60.0),
                        child: Center(
                          child: CircularProgressIndicator(color: Color(0xFF2563EB)),
                        ),
                      )
                    else if (ownersState.error != null && filteredOwners.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40.0),
                        child: Center(
                          child: Column(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 40),
                              const SizedBox(height: 12),
                              Text(
                                ownersState.error!,
                                style: const TextStyle(fontSize: 14, color: Color(0xFFEF4444)),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              TextButton.icon(
                                onPressed: () => ref.read(ownersProvider.notifier).loadOwners(),
                                icon: const Icon(Icons.refresh_rounded),
                                label: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      )
                    else if (filteredOwners.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40.0),
                        child: Center(
                          child: Text(
                            'No owners found.',
                            style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
                          ),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: filteredOwners.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final owner = filteredOwners[index];
                          return _buildOwnerCard(context, owner);
                        },
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const LandlordBottomNavBar(currentIndex: 4),

      // Floating Action Button
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/landlord/owners/new'),
        backgroundColor: const Color(0xFF2563EB),
        elevation: 4,
        shape: const CircleBorder(),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }

  Widget _buildOwnerCard(BuildContext context, OwnerModel owner) {
    final initialLetter = owner.name.isNotEmpty ? owner.name[0].toUpperCase() : 'O';
    final isConfigured = owner.setupStatus == 'Configured';

    Color avatarBg;
    Color avatarText;
    if (initialLetter == 'S') {
      avatarBg = const Color(0xFFEFF6FF);
      avatarText = const Color(0xFF2563EB);
    } else if (initialLetter == 'J') {
      avatarBg = const Color(0xFFFEF3C7);
      avatarText = const Color(0xFFD97706);
    } else {
      avatarBg = const Color(0xFFFEF9C3);
      avatarText = const Color(0xFFCA8A04);
    }

    return InkWell(
      onTap: () {
        context.push('/landlord/owners/detail', extra: owner);
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.015),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Initial Avatar Circle
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: avatarBg,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                initialLetter,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: avatarText,
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Name & Email
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    owner.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    owner.email,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Payout Status Badge & Sub-label
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isConfigured ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    owner.setupStatus,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: isConfigured ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  owner.accountStatus,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isConfigured ? const Color(0xFF15803D) : const Color(0xFFB45309),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 6),

            // Chevron Icon
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
