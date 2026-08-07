import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/widgets/add_tenant_bottom_sheet.dart';
import '../../../../core/widgets/tenant_filter_bottom_sheet.dart';
import '../../../../core/widgets/create_lease_bottom_sheet.dart';
import '../../../../core/widgets/landlord_bottom_nav_bar.dart';
import '../../../../core/widgets/header_action_icons.dart';
import '../data/tenants_repository.dart';
import '../domain/tenant_model.dart';
import 'tenants_notifier.dart';

class TenantsScreen extends ConsumerStatefulWidget {
  const TenantsScreen({super.key});

  @override
  ConsumerState<TenantsScreen> createState() => _TenantsScreenState();
}

class _TenantsScreenState extends ConsumerState<TenantsScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedTypeFilter = 'All Types';
  String _selectedLocationFilter = 'All';



  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tenantsAsync = ref.watch(tenantsProvider);
    final globalPartialAsync = ref.watch(workspacePartialPaymentsProvider);
    final globalPartialPayments = globalPartialAsync.valueOrNull ?? true;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(tenantsProvider);
            ref.invalidate(workspacePartialPaymentsProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Header Bar
                _buildHeader(context),
                const SizedBox(height: 20),

                // 2. Search & Filter Bar
                _buildSearchAndFilterBar(context),
                const SizedBox(height: 16),

                // 3. Global Partial Payments Toggle
                _buildGlobalPartialPaymentsCard(globalPartialPayments),
                const SizedBox(height: 20),

                // 4. Tenants List
                tenantsAsync.when(
                  data: (tenantsList) {
                    final filteredList = _filterTenants(tenantsList);

                    if (filteredList.isEmpty) {
                      return _buildEmptyState();
                    }

                    return ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filteredList.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        return _buildTenantCard(context, filteredList[index], globalPartialPayments);
                      },
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
                  ),
                  error: (err, stack) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text(
                        'Failed to load tenants. Swipe down to refresh.',
                        style: const TextStyle(color: Color(0xFFEF4444), fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: const LandlordBottomNavBar(currentIndex: 2),
    );
  }

  List<TenantModel> _filterTenants(List<TenantModel> list) {
    return list.where((t) {
      final matchesSearch = _searchQuery.isEmpty ||
          t.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          t.locationSubtitle.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          t.email.toLowerCase().contains(_searchQuery.toLowerCase());

      bool matchesType = true;
      if (_selectedTypeFilter == 'New Tenants') {
        matchesType = t.status.toLowerCase() == 'active';
      } else if (_selectedTypeFilter == 'Renewals') {
        matchesType = t.status.toLowerCase() == 'expiring' || t.leaseStatus == 'PENDING_RENEWAL';
      } else if (_selectedTypeFilter == 'Past Tenants') {
        matchesType = t.status.toLowerCase() == 'overdue';
      }

      bool matchesLocation = true;
      if (_selectedLocationFilter != 'All') {
        matchesLocation = t.propertyName.toLowerCase().contains(_selectedLocationFilter.toLowerCase()) ||
            t.locationSubtitle.toLowerCase().contains(_selectedLocationFilter.toLowerCase());
      }

      return matchesSearch && matchesType && matchesLocation;
    }).toList();
  }

  /// 1. Header Bar with Title, + Add Tenant Button, & Top Right Icons
  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Tenants',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: 4),
              Text(
                'Manage property occupancies',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF64748B),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // + Add Tenant button
            Material(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _showAddTenantSheet(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add_rounded, color: Colors.white, size: 18),
                      SizedBox(width: 4),
                      Text(
                        'Add',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            const HeaderActionIcons(),
          ],
        ),
      ],
    );
  }

  void _showAddTenantSheet(BuildContext context) async {
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    final repository = ref.read(tenantsRepositoryProvider);

    final created = await AddTenantBottomSheet.show(
      context,
      onSubmit: (name, email, phone) async {
        return repository.createTenant(workspaceId, name: name, email: email, phone: phone);
      },
    );

    if (created == true && mounted) {
      ref.invalidate(tenantsProvider);
    }
  }

  /// 2. Search & Filter Bar
  Widget _buildSearchAndFilterBar(BuildContext context) {
    return Row(
      children: [
        // Search Input
        Expanded(
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(5),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
              style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
              decoration: const InputDecoration(
                hintText: 'Search tenants...',
                hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Square Filter Button
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(5),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: IconButton(
            onPressed: () async {
              final result = await TenantFilterBottomSheet.show(
                context,
                selectedType: _selectedTypeFilter,
                selectedLocation: _selectedLocationFilter,
              );
              if (result != null) {
                setState(() {
                  _selectedTypeFilter = result.type;
                  _selectedLocationFilter = result.location;
                });
              }
            },
            icon: Icon(
              Icons.tune_rounded,
              color: (_selectedTypeFilter != 'All Types' || _selectedLocationFilter != 'All')
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF0F172A),
              size: 20,
            ),
          ),
        ),
      ],
    );
  }

  /// 3. Global Partial Payments Toggle Card
  Widget _buildGlobalPartialPaymentsCard(bool isEnabled) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(6),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Shield icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.shield_outlined,
              color: Color(0xFF2563EB),
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          // Label & description
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Global Partial Payments',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Enable or disable partial payments for all tenants by default.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Toggle switch
          Switch.adaptive(
            value: isEnabled,
            onChanged: (val) => _toggleGlobalPartialPayments(val),
            activeColor: const Color(0xFF2563EB),
            activeTrackColor: const Color(0xFFBFDBFE),
            inactiveThumbColor: const Color(0xFF94A3B8),
            inactiveTrackColor: const Color(0xFFE2E8F0),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleGlobalPartialPayments(bool value) async {
    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    final repository = ref.read(tenantsRepositoryProvider);
    try {
      await repository.updateWorkspacePartialPayments(workspaceId, allowPartialPayments: value);
      ref.invalidate(workspacePartialPaymentsProvider);
      ref.invalidate(tenantsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Global partial payments ${value ? 'enabled' : 'disabled'}'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  /// 4. Tenant Card Widget with all web parity features
  Widget _buildTenantCard(BuildContext context, TenantModel tenant, bool globalPartialPayments) {
    return Container(
      padding: const EdgeInsets.all(18),
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
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar Image
              ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: SizedBox(
                  width: 56,
                  height: 56,
                  child: tenant.avatarUrl != null && tenant.avatarUrl!.isNotEmpty
                      ? Image.network(
                          tenant.avatarUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => _buildAvatarFallback(tenant.name),
                        )
                      : _buildAvatarFallback(tenant.name),
                ),
              ),
              const SizedBox(width: 14),

              // Name, Property Unit Subtitle, and Status
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Row: Tenant Name + Status Badge + Actions Menu
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            tenant.name,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.4,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Status Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: tenant.statusBackgroundColor,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            tenant.displayLeaseStatus,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: tenant.statusTextColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        // ⋮ Actions Menu Button
                        _buildActionsMenuButton(context, tenant),
                      ],
                    ),
                    const SizedBox(height: 4),

                    // Property & Unit Subtitle
                    Text(
                      tenant.locationSubtitle,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF64748B),
                      ),
                    ),

                    // Tenant Short ID
                    const SizedBox(height: 2),
                    Text(
                      'ID: ${tenant.shortId}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Action Buttons (Call, Message, Assign Lease, Attachment)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        // Call Button
                        _buildActionChip(
                          icon: Icons.call_rounded,
                          label: 'Call',
                          onTap: () => _makePhoneCall(tenant.phone),
                        ),

                        // Message Button
                        _buildActionChip(
                          icon: Icons.chat_bubble_outline_rounded,
                          label: 'Message',
                          onTap: () => _sendMessage(tenant.phone),
                        ),

                        // Assign Lease Button
                        _buildActionChip(
                          icon: Icons.assignment_add,
                          label: tenant.propertyName == 'No Property Assigned' ? 'Assign Lease' : 'New Lease',
                          onTap: () {
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (context) => CreateLeaseBottomSheet(
                                tenantId: tenant.id,
                                tenantName: tenant.name,
                              ),
                            );
                          },
                        ),

                        // Attachment Button (if available)
                        if (tenant.hasAttachment)
                          _buildActionChip(
                            icon: Icons.attach_file_rounded,
                            label: tenant.attachmentName,
                            onTap: () => _viewAttachment(tenant),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Rejection Reason Banner (if rejected)
          if (tenant.leaseStatus == 'REJECTED' && tenant.rejectionReason != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'REJECTION REASON',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFEF4444),
                            letterSpacing: 0.8,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          tenant.rejectionReason!,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFFB91C1C),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Per-Tenant Partial Payment Toggle
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Allow Partial Payment',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF334155),
                  ),
                ),
                SizedBox(
                  height: 28,
                  child: Switch.adaptive(
                    value: globalPartialPayments || tenant.allowPartialPayments == true,
                    onChanged: globalPartialPayments
                        ? null // Disabled when global is ON
                        : (val) => _toggleTenantPartialPayments(tenant, val),
                    activeColor: const Color(0xFF2563EB),
                    activeTrackColor: const Color(0xFFBFDBFE),
                    inactiveThumbColor: const Color(0xFF94A3B8),
                    inactiveTrackColor: const Color(0xFFE2E8F0),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionChip({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFF2563EB), size: 14),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2563EB),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Actions Menu (⋮) Button
  Widget _buildActionsMenuButton(BuildContext context, TenantModel tenant) {
    return SizedBox(
      width: 28,
      height: 28,
      child: PopupMenuButton<String>(
        icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF64748B)),
        padding: EdgeInsets.zero,
        splashRadius: 18,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        color: Colors.white,
        elevation: 8,
        onSelected: (value) => _handleMenuAction(context, tenant, value),
        itemBuilder: (context) => [
          _buildMenuItem(
            value: 'payment_settings',
            icon: Icons.shield_outlined,
            label: 'Payment Settings',
          ),
          if (tenant.leaseStatus == 'ACTIVE')
            _buildMenuItem(
              value: 'end_tenancy',
              icon: Icons.block_rounded,
              label: 'End Tenancy',
              isDestructive: true,
            ),
          _buildMenuItem(
            value: 'delete',
            icon: Icons.delete_outline_rounded,
            label: 'Delete Tenant',
            isDestructive: true,
          ),
        ],
      ),
    );
  }

  PopupMenuItem<String> _buildMenuItem({
    required String value,
    required IconData icon,
    required String label,
    bool isDestructive = false,
  }) {
    return PopupMenuItem<String>(
      value: value,
      height: 44,
      child: Row(
        children: [
          Icon(
            icon,
            size: 18,
            color: isDestructive ? const Color(0xFFEF4444) : const Color(0xFF334155),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDestructive ? const Color(0xFFEF4444) : const Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }

  void _handleMenuAction(BuildContext context, TenantModel tenant, String action) {
    switch (action) {
      case 'payment_settings':
        _showPaymentSettingsSheet(context, tenant);
        break;
      case 'end_tenancy':
        _showEndTenancyDialog(context, tenant);
        break;
      case 'delete':
        _showDeleteDialog(context, tenant);
        break;
    }
  }

  void _showPaymentSettingsSheet(BuildContext context, TenantModel tenant) {
    final globalPartialAsync = ref.read(workspacePartialPaymentsProvider);
    final isGlobalEnabled = globalPartialAsync.valueOrNull ?? true;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        bool localValue = isGlobalEnabled || tenant.allowPartialPayments == true;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle
                  Center(
                    child: Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // Title
                  Row(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.shield_outlined, color: Color(0xFF2563EB), size: 22),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Payment Settings',
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              tenant.name,
                              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Partial Payment Toggle
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Allow Partial Payments',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isGlobalEnabled
                                    ? 'Inherited from workspace settings (globally enabled).'
                                    : 'Override workspace settings for this tenant.',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        Switch.adaptive(
                          value: localValue,
                          onChanged: isGlobalEnabled
                              ? null
                              : (val) {
                                  setSheetState(() => localValue = val);
                                },
                          activeColor: const Color(0xFF2563EB),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Save Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: isGlobalEnabled
                          ? null
                          : () async {
                              await _toggleTenantPartialPayments(tenant, localValue);
                              if (ctx.mounted) Navigator.of(ctx).pop();
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        disabledBackgroundColor: const Color(0xFFCBD5E1),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.save_rounded, size: 18),
                          SizedBox(width: 8),
                          Text('Save Settings', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showEndTenancyDialog(BuildContext context, TenantModel tenant) {
    String selectedReason = 'VOLUNTARY';
    final reasons = ['VOLUNTARY', 'EVICTION', 'LEASE_EXPIRED', 'OTHER'];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
                  Center(
                    child: Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const Text(
                    'End Tenancy',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'End tenancy for ${tenant.name}',
                    style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Select Reason',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 10),
                  ...reasons.map((reason) => GestureDetector(
                        onTap: () => setSheetState(() => selectedReason = reason),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: selectedReason == reason
                                ? const Color(0xFFEFF6FF)
                                : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selectedReason == reason
                                  ? const Color(0xFF2563EB)
                                  : const Color(0xFFE2E8F0),
                              width: selectedReason == reason ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                selectedReason == reason
                                    ? Icons.radio_button_checked_rounded
                                    : Icons.radio_button_off_rounded,
                                color: selectedReason == reason
                                    ? const Color(0xFF2563EB)
                                    : const Color(0xFF94A3B8),
                                size: 20,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                reason.replaceAll('_', ' '),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: selectedReason == reason ? FontWeight.w700 : FontWeight.w500,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.of(ctx).pop();
                        await _performEndTenancy(tenant, selectedReason);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text(
                        'End Tenancy',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _performEndTenancy(TenantModel tenant, String reason) async {

    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    final repository = ref.read(tenantsRepositoryProvider);
    try {
      await repository.endTenancy(workspaceId, tenant.id, reason: reason);
      ref.invalidate(tenantsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tenancy ended successfully'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  void _showDeleteDialog(BuildContext context, TenantModel tenant) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Delete Tenant',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        content: Text(
          'Are you sure you want to remove ${tenant.name}? This will archive their profile.',
          style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await _performDelete(tenant);
            },
            child: const Text(
              'Delete',
              style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _performDelete(TenantModel tenant) async {

    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    final repository = ref.read(tenantsRepositoryProvider);
    try {
      await repository.deleteTenant(workspaceId, tenant.id);
      ref.invalidate(tenantsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tenant removed successfully'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _toggleTenantPartialPayments(TenantModel tenant, bool value) async {

    final workspaceId = ref.read(activeWorkspaceIdProvider);
    if (workspaceId == null) return;

    final repository = ref.read(tenantsRepositoryProvider);
    try {
      await repository.updateTenant(
        workspaceId,
        tenant.id,
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        allowPartialPayments: value,
      );
      ref.invalidate(tenantsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Partial payments for ${tenant.name} ${value ? 'enabled' : 'disabled'}'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  void _viewAttachment(TenantModel tenant) async {
    if (tenant.legalDocUrl != null && tenant.legalDocUrl!.startsWith('http')) {
      final uri = Uri.parse(tenant.legalDocUrl!);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Document viewer coming soon'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Widget _buildAvatarFallback(String name) {
    final initials = name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'T';
    return Container(
      color: const Color(0xFF2563EB),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(Icons.people_outline_rounded, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          const Text(
            'No tenants found',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Get started by adding your first tenant',
            style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  void _makePhoneCall(String phoneNumber) async {
    final Uri url = Uri.parse('tel:$phoneNumber');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Calling $phoneNumber')),
        );
      }
    }
  }

  void _sendMessage(String phoneNumber) async {
    final Uri url = Uri.parse('sms:$phoneNumber');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Messaging $phoneNumber')),
        );
      }
    }
  }

}
