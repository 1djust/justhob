import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../auth/presentation/auth_notifier.dart';
import 'notification_settings_screen.dart';
import 'privacy_security_screen.dart';
import '../../../core/widgets/app_loading_indicator.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String _selectedLanguage = 'English';
  String _selectedAppearance = 'Light Mode';
  String _selectedCurrency = 'NGN ₦';
  final bool _biometricsEnabled = true;
  File? _profileImageFile;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickProfileImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );
      if (pickedFile != null) {
        setState(() {
          _profileImageFile = File(pickedFile.path);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile picture updated successfully!'),
              backgroundColor: Color(0xFF16A34A),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick image: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  void _showProfileImagePickerModal() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Change Profile Picture',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6FF),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.photo_camera_rounded, color: Color(0xFF2563EB)),
              ),
              title: const Text('Take Photo', style: TextStyle(fontWeight: FontWeight.w700)),
              onTap: () {
                Navigator.pop(context);
                _pickProfileImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6FF),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.photo_library_rounded, color: Color(0xFF2563EB)),
              ),
              title: const Text('Choose from Gallery', style: TextStyle(fontWeight: FontWeight.w700)),
              onTap: () {
                Navigator.pop(context);
                _pickProfileImage(ImageSource.gallery);
              },
            ),
            if (_profileImageFile != null)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444)),
                ),
                title: const Text('Remove Photo', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEF4444))),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    _profileImageFile = null;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Profile picture removed.')),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showEditPersonalInfoModal(String currentName) {
    final nameController = TextEditingController(text: currentName);
    final phoneController = TextEditingController(text: '+234 812 345 6789');
    final companyController = TextEditingController(text: 'Solomon Real Estate Ltd');
    bool isSaving = false;

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
                'Edit Personal & Business Info',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
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
                controller: phoneController,
                decoration: InputDecoration(
                  labelText: 'Phone Number',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: companyController,
                decoration: InputDecoration(
                  labelText: 'Company / Brand Name',
                  prefixIcon: const Icon(Icons.business_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSaving
                      ? null
                      : () async {
                          final newName = nameController.text.trim();
                          if (newName.isEmpty) return;
                          setModalState(() => isSaving = true);
                          final success = await ref
                              .read(authStateProvider.notifier)
                              .updateProfile(name: newName);
                          setModalState(() => isSaving = false);
                          if (mounted && success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Personal info updated successfully!'),
                                backgroundColor: Color(0xFF16A34A),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Save Changes',
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

  void _showPayoutBankModal() {
    final bankController = TextEditingController(text: 'Guaranty Trust Bank (GTB)');
    final accNumController = TextEditingController(text: '0123456789');
    final accNameController = TextEditingController(text: 'SOLOMON RUTH MANAGEMENT');
    bool isSaving = false;

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
                'Payout Bank Details',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Direct bank account for automated tenant rent deposits.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: bankController,
                decoration: InputDecoration(
                  labelText: 'Bank Name / Code',
                  prefixIcon: const Icon(Icons.account_balance_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accNumController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Account Number',
                  prefixIcon: const Icon(Icons.pin_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accNameController,
                decoration: InputDecoration(
                  labelText: 'Account Holder Name',
                  prefixIcon: const Icon(Icons.badge_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSaving
                      ? null
                      : () async {
                          setModalState(() => isSaving = true);
                          final success = await ref.read(authStateProvider.notifier).updateProfile(
                                bankCode: bankController.text,
                                accountNumber: accNumController.text,
                                accountName: accNameController.text,
                              );
                          setModalState(() => isSaving = false);
                          if (mounted && success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Payout bank account saved successfully!'),
                                backgroundColor: Color(0xFF16A34A),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Save Payout Details',
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

  void _showChangePasswordModal() {
    final newPassController = TextEditingController();
    final confirmPassController = TextEditingController();
    bool isSaving = false;

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
                'Change Password',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: newPassController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'New Password',
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPassController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Confirm New Password',
                  prefixIcon: const Icon(Icons.lock_reset_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSaving
                      ? null
                      : () async {
                          final pass = newPassController.text;
                          if (pass.length < 8) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Password must be at least 8 characters long.')),
                            );
                            return;
                          }
                          if (pass != confirmPassController.text) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Passwords do not match.')),
                            );
                            return;
                          }
                          setModalState(() => isSaving = true);
                          final success = await ref
                              .read(authStateProvider.notifier)
                              .changePassword(pass);
                          setModalState(() => isSaving = false);
                          if (mounted && success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Password updated successfully!'),
                                backgroundColor: Color(0xFF16A34A),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Update Password',
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

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final user = authState.value;

    final userName = user?.name?.isNotEmpty == true ? user!.name! : 'Solomon';
    final userEmail = user?.email.isNotEmpty == true ? user!.email : 'solomon@propertystack.co';
    const userPlan = 'Free Plan';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: user == null && authState.isLoading
            ? const AppLoadingIndicator()
            : SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Bar with Back Button if pushed
                    Row(
                      children: [
                        if (Navigator.canPop(context)) ...[
                          IconButton(
                            onPressed: () {
                              if (context.canPop()) {
                                context.pop();
                              } else {
                                context.go('/landlord');
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
                          const SizedBox(width: 8),
                        ],
                        const Text(
                          'Account Settings',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.8,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // User Profile Header Card
                    Container(
                      padding: const EdgeInsets.all(16.0),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          // Avatar with Camera Icon Overlay & Interactive Picker
                          InkWell(
                            onTap: _showProfileImagePickerModal,
                            borderRadius: BorderRadius.circular(34),
                            child: Stack(
                              children: [
                                Container(
                                  width: 68,
                                  height: 68,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(34),
                                    child: _profileImageFile != null
                                        ? Image.file(
                                            _profileImageFile!,
                                            width: 68,
                                            height: 68,
                                            fit: BoxFit.cover,
                                          )
                                        : Image.network(
                                            'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => Container(
                                              color: const Color(0xFF0F172A),
                                              child: const Icon(
                                                Icons.person_rounded,
                                                size: 40,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 22,
                                    height: 22,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF2563EB),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white, width: 2),
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt_rounded,
                                      size: 11,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),

                          // Name, Email, and Plan Badge
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  userName,
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.4,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  userEmail,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF64748B),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Text(
                                    userPlan,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // PERSONAL & BUSINESS SECTION
                    _buildSectionHeader('PERSONAL & BUSINESS'),
                    const SizedBox(height: 8),
                    _buildSettingsCard([
                      _SettingsRow(
                        icon: Icons.person_outline_rounded,
                        title: 'Edit Personal Details',
                        onTap: () => _showEditPersonalInfoModal(userName),
                      ),
                      _SettingsRow(
                        icon: Icons.account_balance_outlined,
                        title: 'Payout Bank Account',
                        trailingText: 'GTBank • 0123',
                        isLast: true,
                        onTap: _showPayoutBankModal,
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // PREFERENCES SECTION
                    _buildSectionHeader('PREFERENCES'),
                    const SizedBox(height: 8),
                    _buildSettingsCard([
                      _SettingsRow(
                        icon: Icons.notifications_none_rounded,
                        title: 'Notification Settings',
                        trailingText: 'Enabled',
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const NotificationSettingsScreen()),
                          );
                        },
                      ),
                      _SettingsRow(
                        icon: Icons.remove_red_eye_outlined,
                        title: 'Appearance',
                        trailingText: _selectedAppearance,
                        onTap: _showAppearancePicker,
                      ),
                      _SettingsRow(
                        icon: Icons.language_rounded,
                        title: 'Language',
                        trailingText: _selectedLanguage,
                        onTap: _showLanguagePicker,
                      ),
                      _SettingsRow(
                        icon: Icons.credit_card_rounded,
                        title: 'Currency',
                        trailingText: _selectedCurrency,
                        isLast: true,
                        onTap: _showCurrencyPicker,
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // ACCOUNT & SECURITY SECTION
                    _buildSectionHeader('ACCOUNT & SECURITY'),
                    const SizedBox(height: 8),
                    _buildSettingsCard([
                      _SettingsRow(
                        icon: Icons.lock_outline_rounded,
                        title: 'Change Password',
                        onTap: _showChangePasswordModal,
                      ),
                      _SettingsRow(
                        icon: Icons.shield_outlined,
                        title: 'Security & Biometrics',
                        trailingText: _biometricsEnabled ? 'FaceID On' : 'Off',
                        isLast: true,
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const PrivacySecurityScreen()),
                          );
                        },
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // DATA SECTION
                    _buildSectionHeader('DATA & GOVERNANCE'),
                    const SizedBox(height: 8),
                    _buildSettingsCard([
                      _SettingsRow(
                        icon: Icons.download_rounded,
                        title: 'Export Account Data',
                        onTap: _exportUserData,
                      ),
                      _SettingsRow(
                        icon: Icons.delete_outline_rounded,
                        iconColor: const Color(0xFFEF4444),
                        title: 'Delete Account',
                        titleColor: const Color(0xFFEF4444),
                        trailingColor: const Color(0xFFEF4444),
                        isLast: true,
                        onTap: _confirmDeleteAccount,
                      ),
                    ]),
                    const SizedBox(height: 20),

                    // Version Footer
                    const Center(
                      child: Text(
                        'PropertyStack v1.0.2',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4.0),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: Color(0xFF94A3B8),
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  void _showAppearancePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Appearance',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 16),
            ...['Light Mode', 'Dark Mode', 'System Default'].map(
              (mode) => RadioListTile<String>(
                title: Text(mode, style: const TextStyle(fontWeight: FontWeight.w600)),
                value: mode,
                groupValue: _selectedAppearance,
                activeColor: const Color(0xFF2563EB),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedAppearance = val);
                    Navigator.pop(context);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLanguagePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Language',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 16),
            ...['English', 'French', 'Spanish'].map(
              (lang) => RadioListTile<String>(
                title: Text(lang, style: const TextStyle(fontWeight: FontWeight.w600)),
                value: lang,
                groupValue: _selectedLanguage,
                activeColor: const Color(0xFF2563EB),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedLanguage = val);
                    Navigator.pop(context);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCurrencyPicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Currency',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 16),
            ...['NGN ₦', 'USD \$', 'GBP £', 'EUR €'].map(
              (curr) => RadioListTile<String>(
                title: Text(curr, style: const TextStyle(fontWeight: FontWeight.w600)),
                value: curr,
                groupValue: _selectedCurrency,
                activeColor: const Color(0xFF2563EB),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedCurrency = val);
                    Navigator.pop(context);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }



  void _exportUserData() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Preparing account data export (CSV/PDF)... Check your email shortly.'),
        backgroundColor: Color(0xFF2563EB),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _confirmDeleteAccount() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Account?', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text(
          'This action is permanent and cannot be undone. All your properties, tenant records, and payment histories will be permanently deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authStateProvider.notifier).logout();
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


}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final String? trailingText;
  final Color? trailingColor;
  final bool isLast;
  final VoidCallback onTap;

  const _SettingsRow({
    required this.icon,
    this.iconColor,
    required this.title,
    this.titleColor,
    this.trailingText,
    this.trailingColor,
    this.isLast = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
            child: Row(
              children: [
                Icon(icon, color: iconColor ?? const Color(0xFF475569), size: 22),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: titleColor ?? const Color(0xFF0F172A),
                    ),
                  ),
                ),
                if (trailingText != null)
                  Text(
                    trailingText!,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: trailingColor ?? const Color(0xFF64748B),
                    ),
                  ),
                const SizedBox(width: 6),
                Icon(
                  Icons.chevron_right_rounded,
                  color: trailingColor ?? const Color(0xFF94A3B8),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
        if (!isLast)
          const Divider(
            height: 1,
            thickness: 1,
            indent: 52,
            endIndent: 16,
            color: Color(0xFFF1F5F9),
          ),
      ],
    );
  }
}
