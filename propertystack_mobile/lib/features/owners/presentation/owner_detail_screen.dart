import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/owner_model.dart';
import 'owners_notifier.dart';

class OwnerDetailScreen extends ConsumerStatefulWidget {
  final OwnerModel owner;

  const OwnerDetailScreen({super.key, required this.owner});

  @override
  ConsumerState<OwnerDetailScreen> createState() => _OwnerDetailScreenState();
}

class _OwnerDetailScreenState extends ConsumerState<OwnerDetailScreen> {
  late OwnerModel _owner;

  @override
  void initState() {
    super.initState();
    _owner = widget.owner;
  }

  void _showEditProfileModal() {
    final nameController = TextEditingController(text: _owner.name);
    final emailController = TextEditingController(text: _owner.email);
    final phoneController = TextEditingController(text: _owner.phone ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Edit Owner Profile',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: nameController,
              decoration: InputDecoration(
                labelText: 'Full Name',
                prefixIcon: const Icon(Icons.person_outline_rounded),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email Address',
                prefixIcon: const Icon(Icons.mail_outline_rounded),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Phone Number',
                prefixIcon: const Icon(Icons.phone_outlined),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  final newName = nameController.text.trim();
                  final newEmail = emailController.text.trim();
                  if (newName.isEmpty || newEmail.isEmpty) return;

                  final updated = _owner.copyWith(
                    name: newName,
                    email: newEmail,
                    phone: phoneController.text.trim(),
                  );
                  setState(() => _owner = updated);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Owner details updated successfully!'),
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text(
                  'Save Profile',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showConfigurePayoutModal() {
    String? selectedBankCode = _owner.bankCode;
    String selectedStrategy = _owner.payoutStrategy ?? 'DIRECT_TO_LANDLORD';
    final accNumController = TextEditingController(text: _owner.accountNumber ?? '');
    final accNameController = TextEditingController(text: _owner.accountName ?? '');
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Configure Settlement & Payout',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Set up direct settlement bank for automated tenant rent disbursements.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: selectedStrategy,
                decoration: InputDecoration(
                  labelText: 'Payout Protocol Strategy',
                  prefixIcon: const Icon(Icons.swap_horiz_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'DIRECT_TO_LANDLORD',
                    child: Text('Direct to Landlord (Automated)'),
                  ),
                  DropdownMenuItem(
                    value: 'MANAGER_COLLECTS',
                    child: Text('Manager Collects First (Manual)'),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => selectedStrategy = val);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: (selectedBankCode != null && nigerianBankMap.containsKey(selectedBankCode)) ? selectedBankCode : null,
                hint: const Text('Select Settlement Bank'),
                decoration: InputDecoration(
                  labelText: 'Settlement Bank',
                  prefixIcon: const Icon(Icons.account_balance_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                items: nigerianBankMap.entries
                    .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setModalState(() => selectedBankCode = val);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accNumController,
                keyboardType: TextInputType.number,
                maxLength: 10,
                decoration: InputDecoration(
                  labelText: 'NUBAN Account Number',
                  prefixIcon: const Icon(Icons.pin_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accNameController,
                decoration: InputDecoration(
                  labelText: 'Account Holder Name',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final accNum = accNumController.text.trim();
                          final accName = accNameController.text.trim();
                          if (accNum.length != 10 || accName.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter a valid 10-digit account number and account name.')),
                            );
                            return;
                          }

                          setModalState(() => isSubmitting = true);
                          try {
                            await ref.read(ownersProvider.notifier).updateOwnerBankDetails(
                                  ownerId: _owner.id,
                                  payoutStrategy: selectedStrategy,
                                  bankCode: selectedBankCode,
                                  accountNumber: accNum,
                                  accountName: accName,
                                );

                            final bankNameStr = nigerianBankMap[selectedBankCode] ?? selectedBankCode;
                            setState(() {
                              _owner = _owner.copyWith(
                                payoutStrategy: selectedStrategy,
                                bankCode: selectedBankCode,
                                bankName: bankNameStr,
                                accountNumber: accNum,
                                accountName: accName,
                                setupStatus: 'Configured',
                                accountStatus: 'Active',
                                kycStatus: 'Verified',
                              );
                            });

                            if (mounted) Navigator.pop(context);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Settlement strategy updated successfully!'),
                                  backgroundColor: Color(0xFF16A34A),
                                ),
                              );
                            }
                          } catch (e) {
                            setModalState(() => isSubmitting = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'Save Payout Strategy',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAssignPropertyModal() {
    final propNameController = TextEditingController();
    final unitInfoController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Assign Property',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: propNameController,
              decoration: InputDecoration(
                labelText: 'Property Name',
                hintText: 'e.g. Sunrise Apartments',
                prefixIcon: const Icon(Icons.apartment_rounded),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: unitInfoController,
              decoration: InputDecoration(
                labelText: 'Unit Details',
                hintText: 'e.g. Unit 1A, Unit 2B',
                prefixIcon: const Icon(Icons.meeting_room_rounded),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  final propName = propNameController.text.trim();
                  if (propName.isEmpty) return;

                  setState(() => _owner = _owner.copyWith(
                    assignedProperties: [
                      ..._owner.assignedProperties,
                      OwnerPropertyInfo(
                        id: 'prop_${DateTime.now().millisecondsSinceEpoch}',
                        name: propName,
                        unitInfo: unitInfoController.text.trim(),
                      ),
                    ],
                  ));

                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Property assigned successfully!'),
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text(
                  'Assign Property',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteOwnerDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Owner?', style: TextStyle(fontWeight: FontWeight.w800)),
        content: Text(
          'Are you sure you want to delete ${_owner.name}? This will unassign all their properties and remove their payout configurations.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await ref.read(ownersProvider.notifier).deleteOwner(_owner.id);
                if (context.mounted) Navigator.pop(context);
                if (context.mounted) {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/landlord/owners');
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Owner deleted successfully.'),
                      backgroundColor: Color(0xFFEF4444),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
            ),
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Keep local owner updated from global state if needed
    final currentOwnersState = ref.watch(ownersProvider);
    final freshOwner = currentOwnersState.owners.firstWhere(
      (o) => o.id == _owner.id,
      orElse: () => _owner,
    );
    _owner = freshOwner;

    final initialLetter = _owner.name.isNotEmpty ? _owner.name[0].toUpperCase() : 'O';
    final isConfigured = _owner.setupStatus == 'Configured';

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

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Navigation Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/landlord/owners');
                      }
                    },
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Color(0xFF0F172A),
                      size: 20,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  ),
                  const Text(
                    'Owner Details',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  IconButton(
                    onPressed: _showEditProfileModal,
                    icon: const Icon(
                      Icons.circle_outlined,
                      color: Color(0xFF0F172A),
                      size: 22,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // 1. Owner Profile Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.015),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Avatar Circle
                    Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        color: avatarBg,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initialLetter,
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: avatarText,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Owner Name
                    Text(
                      _owner.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),

                    // Email
                    Text(
                      _owner.email,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Edit Profile Button
                    OutlinedButton(
                      onPressed: _showEditProfileModal,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                      ),
                      child: const Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 2. PAYOUT STRATEGY Section
              _buildSectionHeader('PAYOUT STRATEGY'),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Setup Status',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF475569),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isConfigured ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _owner.setupStatus,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: isConfigured ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: OutlinedButton(
                        onPressed: _showConfigurePayoutModal,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          shape: const StadiumBorder(),
                        ),
                        child: const Text(
                          'Configure Payout',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2563EB),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 3. BANK SETTLEMENT Section
              _buildSectionHeader('BANK SETTLEMENT'),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    _buildInfoRow('Bank Name', _owner.bankName ?? '—'),
                    const SizedBox(height: 10),
                    _buildInfoRow('Account Number', _owner.accountNumber ?? '—'),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'KYC Status',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        Text(
                          _owner.kycStatus,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _owner.kycStatus == 'Verified'
                                ? const Color(0xFF16A34A)
                                : const Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: OutlinedButton(
                        onPressed: _showConfigurePayoutModal,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          shape: const StadiumBorder(),
                        ),
                        child: const Text(
                          'Add Bank Details',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2563EB),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 4. ASSIGNED PROPERTIES Section
              _buildSectionHeader('ASSIGNED PROPERTIES'),
              const SizedBox(height: 8),
              if (_owner.assignedProperties.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Center(
                    child: Text(
                      'No properties assigned yet.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                    ),
                  ),
                )
              else
                ..._owner.assignedProperties.map(
                  (prop) => Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.apartment_rounded,
                              color: Color(0xFF2563EB),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  prop.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  prop.unitInfo,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 10),

              // + Assign Property Text Button
              GestureDetector(
                onTap: _showAssignPropertyModal,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Text(
                        '+ Assign Property',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // 5. Bottom Danger Action: Delete Owner
              InkWell(
                onTap: _showDeleteOwnerDialog,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: double.infinity,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    'Delete Owner',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFEF4444),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        color: Color(0xFF64748B),
        letterSpacing: 0.8,
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF64748B),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }
}
