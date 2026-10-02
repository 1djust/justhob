import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../auth/domain/user.dart';
import '../../../../core/utils/nigerian_banks.dart';
import '../../../../core/widgets/timeframe_bottom_sheet.dart';
import '../../../../core/widgets/landlord_bottom_nav_bar.dart';
import '../../../../core/widgets/header_action_icons.dart';
import '../data/landlord_stats.dart';
import 'landlord_home_notifier.dart';

class LandlordHomeScreen extends ConsumerStatefulWidget {
  const LandlordHomeScreen({super.key});

  @override
  ConsumerState<LandlordHomeScreen> createState() => _LandlordHomeScreenState();
}

class _LandlordHomeScreenState extends ConsumerState<LandlordHomeScreen> {
  String _selectedTimeframe = 'This Month';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final statsState = ref.watch(landlordStatsProvider);

    final user = authState.valueOrNull;
    final isManager = user?.role == 'PROPERTY_MANAGER' ||
        user?.globalRole == 'PROPERTY_MANAGER' ||
        (user?.workspaces.any((m) => m.role == 'PROPERTY_MANAGER') ?? false);
    final userName = user?.name?.isNotEmpty == true ? user!.name!.split(' ').first : user?.email ?? 'User';
    final stats = statsState.valueOrNull;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: RefreshIndicator(
                onRefresh: () async {
                  await ref.read(authStateProvider.notifier).checkAuth();
                  ref.invalidate(landlordStatsProvider);
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Top Header Bar
                      _buildHeader(context, userName: userName, isManager: isManager),
                      const SizedBox(height: 20),

                      // 2. Timeframe Filter Dropdown
                      _buildTimeframeDropdown(context),
                      const SizedBox(height: 24),

                      // 3. Metrics Summary Grid (2x2)
                      _buildMetricsGrid(context, stats: stats, isManager: isManager),
                      const SizedBox(height: 24),

                      // 4. Next Payout & Cashflow Pipeline Card
                      _buildPayoutPipelineCard(context, stats: stats, user: user),
                      const SizedBox(height: 28),

                      // 5. Action Needed Section
                      _buildActionNeededSection(context, userName: userName, stats: stats, isManager: isManager),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
      ),

      // 6. Bottom Navigation Bar
      bottomNavigationBar: const LandlordBottomNavBar(currentIndex: 0),
    );
  }

  /// Top Header with Welcome Message & Action Icons (Help, Notifications, Profile)
  Widget _buildHeader(BuildContext context, {required String userName, required bool isManager}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome back, $userName',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                isManager
                    ? "Here's your operations and portfolio summary today."
                    : "Here's your investment and earnings summary today.",
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
        const HeaderActionIcons(),
      ],
    );
  }

  /// Timeframe Pill Dropdown
  Widget _buildTimeframeDropdown(BuildContext context) {
    return InkWell(
      onTap: () async {
        final result = await TimeframeBottomSheet.show(
          context,
          selectedTimeframe: _selectedTimeframe,
        );
        if (result != null) {
          setState(() {
            _selectedTimeframe = result;
          });
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset(
              'assets/icon/calendar.svg',
              width: 18,
              height: 18,
              colorFilter: const ColorFilter.mode(Color(0xFF2563EB), BlendMode.srcIn),
            ),
            const SizedBox(width: 8),
            Text(
              _selectedTimeframe,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(width: 8),
            SvgPicture.asset(
              'assets/icon/chevron-down.svg',
              width: 16,
              height: 16,
              colorFilter: const ColorFilter.mode(Color(0xFF64748B), BlendMode.srcIn),
            ),
          ],
        ),
      ),
    );
  }

  /// 2x2 Grid of Metrics (Total Properties, Total Tenants, Rent Collected, Pending Fixes)
  Widget _buildMetricsGrid(BuildContext context, {LandlordStats? stats, required bool isManager}) {
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final rentFormatted = currencyFormatter.format(stats?.rentCollected ?? 0.0);

    final totalProperties = stats?.totalProperties ?? 0;
    final totalTenants = stats?.totalTenants ?? 0;
    final rentCollected = stats?.rentCollected ?? 0.0;
    final pendingFixes = stats?.pendingMaintenance ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 14,
      mainAxisSpacing: 14,
      childAspectRatio: 1.35,
      children: [
        _buildMetricCard(
          title: isManager ? 'Total Properties' : 'My Properties',
          value: '$totalProperties',
          subtitle: totalProperties > 0 ? '$totalProperties Active' : '0 Active',
        ),
        _buildMetricCard(
          title: isManager ? 'Total Tenants' : 'My Tenants',
          value: '$totalTenants',
          subtitle: totalTenants > 0 ? '$totalTenants Active' : '0 Active',
        ),
        _buildMetricCard(
          title: isManager ? 'Rent Collected' : 'Gross Rent',
          value: rentFormatted,
          subtitle: rentCollected > 0 ? 'This Month' : 'No collections yet',
          isCurrency: true,
        ),
        _buildMetricCard(
          title: 'Pending Fixes',
          value: '$pendingFixes',
          subtitle: pendingFixes > 0 ? 'Requires attention' : 'All clear',
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    bool isCurrency = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(6),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: isCurrency ? 22 : 26,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }

  /// Next Payout & Cashflow Pipeline Card (Concept 1)
  Widget _buildPayoutPipelineCard(BuildContext context, {LandlordStats? stats, User? user}) {
    final currencyFormatter = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    final grossRent = stats?.rentCollected ?? 0.0;
    // Typical property management commission is 10%
    final mgmtFee = grossRent > 0 ? (grossRent * 0.10) : 0.0;
    final netPayout = (grossRent - mgmtFee).clamp(0.0, double.infinity);

    final bankCode = user?.bankCode;
    final accNum = user?.accountNumber;
    final hasBank = accNum != null && accNum.trim().isNotEmpty;
    final bankName = NigerianBanks.getBankName(bankCode);
    final bankDisplay = hasBank
        ? '${bankName != "N/A" ? bankName.split(" ").first : "Bank"} ••••${accNum.length >= 4 ? accNum.substring(accNum.length - 4) : accNum}'
        : null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(6),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.account_balance_wallet_rounded,
                      color: Color(0xFF2563EB),
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Payout Pipeline',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: hasBank ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: hasBank ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      hasBank ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                      size: 12,
                      color: hasBank ? const Color(0xFF047857) : const Color(0xFFB45309),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      hasBank ? 'Auto-Disbursement' : 'Bank Not Linked',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: hasBank ? const Color(0xFF047857) : const Color(0xFFB45309),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Payout Amount Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF8FAFC), Color(0xFFEFF6FF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
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
                      'ESTIMATED NET PAYOUT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.8,
                      ),
                    ),
                    Text(
                      grossRent > 0 ? 'Active Cycle' : 'Cleared',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: grossRent > 0 ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    currencyFormatter.format(netPayout),
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.8,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(
                      hasBank ? Icons.account_balance_rounded : Icons.add_circle_outline_rounded,
                      size: 14,
                      color: hasBank ? const Color(0xFF047857) : const Color(0xFF2563EB),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        hasBank
                            ? 'Payout to: $bankDisplay (${user?.accountName?.split(" ").first ?? "Landlord"})'
                            : 'Link your bank account to receive automatic rent payouts',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: hasBank ? const Color(0xFF334155) : const Color(0xFF2563EB),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Cashflow Pipeline Breakdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFAFAFA),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Column(
              children: [
                _buildPipelineRow(
                  title: 'Gross Rent Collected',
                  amount: currencyFormatter.format(grossRent),
                  amountColor: const Color(0xFF0F172A),
                  prefixIcon: Icons.add_rounded,
                  prefixColor: const Color(0xFF16A34A),
                ),
                const SizedBox(height: 10),
                _buildPipelineRow(
                  title: 'Agency Commission (10%)',
                  amount: '- ${currencyFormatter.format(mgmtFee)}',
                  amountColor: const Color(0xFF64748B),
                  prefixIcon: Icons.remove_rounded,
                  prefixColor: const Color(0xFF94A3B8),
                ),
                const SizedBox(height: 10),
                _buildPipelineRow(
                  title: 'Maintenance Deductions',
                  amount: '- ₦0.00',
                  amountColor: const Color(0xFF64748B),
                  prefixIcon: Icons.remove_rounded,
                  prefixColor: const Color(0xFF94A3B8),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                ),
                _buildPipelineRow(
                  title: 'Net Cashflow',
                  amount: currencyFormatter.format(netPayout),
                  amountColor: const Color(0xFF047857),
                  isBold: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Action Button
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: () {
                if (hasBank) {
                  context.go('/landlord/payments');
                } else {
                  context.push('/profile');
                }
              },
              icon: Icon(
                hasBank ? Icons.receipt_long_rounded : Icons.account_balance_rounded,
                color: Colors.white,
                size: 18,
              ),
              label: Text(
                hasBank ? 'View Disbursement Ledger' : 'Configure Payout Bank Account',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPipelineRow({
    required String title,
    required String amount,
    required Color amountColor,
    IconData? prefixIcon,
    Color? prefixColor,
    bool isBold = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            if (prefixIcon != null) ...[
              Icon(prefixIcon, size: 14, color: prefixColor ?? const Color(0xFF94A3B8)),
              const SizedBox(width: 6),
            ],
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
                color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
        Text(
          amount,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: amountColor,
          ),
        ),
      ],
    );
  }

  /// Action Needed Section (Overdue Payments, Expiring Leases, All Caught Up)
  Widget _buildActionNeededSection(BuildContext context, {required String userName, LandlordStats? stats, required bool isManager}) {
    final overdueCount = stats?.overduePaymentsCount ?? 0;
    final expiringCount = stats?.expiringLeasesCount ?? 0;
    final hasActions = overdueCount > 0 || expiringCount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Action Needed',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 14),

        if (hasActions) ...[
          if (overdueCount > 0) ...[
            _buildOverduePaymentsCard(context, overdueCount: overdueCount),
            if (expiringCount > 0) const SizedBox(height: 12),
          ],
          if (expiringCount > 0) ...[
            _buildExpiringLeasesCard(context, expiringCount: expiringCount),
          ],
        ] else ...[
          _buildAllCaughtUpCard(
            context,
            hasProperties: (stats?.totalProperties ?? 0) > 0,
            isManager: isManager,
          ),
        ],
      ],
    );
  }

  Widget _buildAllCaughtUpCard(BuildContext context, {required bool hasProperties, required bool isManager}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: Color(0xFFECFDF5),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.check_circle_outline_rounded,
              color: Color(0xFF10B981),
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'All caught up',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hasProperties
                      ? 'No overdue payments or expiring leases right now.'
                      : (isManager
                          ? 'No actions needed. Add properties and tenants to start tracking payments.'
                          : 'Your portfolio is up to date. You will be notified of new rent deposits or approvals.'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Clear',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF059669),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverduePaymentsCard(BuildContext context, {required int overdueCount}) {
    return InkWell(
      onTap: () {
        context.push('/landlord/payments');
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(5),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: Color(0xFFFEF2F2),
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(11),
              child: SvgPicture.asset(
                'assets/icon/alert-triangle.svg',
                colorFilter: const ColorFilter.mode(Color(0xFFEF4444), BlendMode.srcIn),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Overdue Payments',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$overdueCount invoice${overdueCount == 1 ? ' is' : 's are'} past due',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Overdue',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFEF4444),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpiringLeasesCard(BuildContext context, {required int expiringCount}) {
    return InkWell(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lease renewal management coming soon!'),
            duration: Duration(seconds: 2),
          ),
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(5),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: Color(0xFFFFFBEB),
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(11),
              child: SvgPicture.asset(
                'assets/icon/clock.svg',
                colorFilter: const ColorFilter.mode(Color(0xFFF59E0B), BlendMode.srcIn),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Expiring Leases',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$expiringCount lease${expiringCount == 1 ? ' is' : 's are'} expiring in the next 30 days',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Expiring',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFD97706),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
