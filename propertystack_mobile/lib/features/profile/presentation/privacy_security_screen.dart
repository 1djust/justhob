import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:propertystack_mobile/core/theme/app_theme.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/biometric_service.dart';
import '../../auth/presentation/auth_notifier.dart';

class PrivacySecurityScreen extends ConsumerStatefulWidget {
  const PrivacySecurityScreen({super.key});

  @override
  ConsumerState<PrivacySecurityScreen> createState() => _PrivacySecurityScreenState();
}

class _PrivacySecurityScreenState extends ConsumerState<PrivacySecurityScreen> {
  bool _isLoadingBiometric = true;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final bio = BiometricService();
    final supported = await bio.isDeviceSupported();
    final enabled = await bio.isBiometricEnabled();

    if (mounted) {
      setState(() {
        _biometricAvailable = supported;
        _biometricEnabled = enabled;
        _isLoadingBiometric = false;
      });
    }
  }

  Future<void> _toggleBiometric(bool enable) async {
    final bio = BiometricService();

    if (enable) {
      _showEnableBiometricSheet();
    } else {
      // Disable biometric authentication cleanly
      await bio.disableBiometric();
      if (!mounted) return;
      setState(() {
        _biometricEnabled = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Biometric authentication turned off. You can now use your login credentials.'),
          backgroundColor: Color(0xFF0F172A),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _showEnableBiometricSheet() {
    final user = ref.read(authStateProvider).value;
    final email = user?.email ?? '';
    final passwordController = TextEditingController();
    bool isVerifying = false;
    String? errorText;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
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
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.fingerprint_rounded, color: Color(0xFF2563EB), size: 26),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Enable Biometrics',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          'Fast & secure login',
                          style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Enter your account password to securely link fingerprint/FaceID on this device.',
                style: TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF475569)),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Current Password',
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  errorText: errorText,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isVerifying
                      ? null
                      : () async {
                          final password = passwordController.text.trim();
                          if (password.isEmpty) {
                            setSheetState(() => errorText = 'Password is required');
                            return;
                          }

                          setSheetState(() {
                            isVerifying = true;
                            errorText = null;
                          });

                          try {
                            // Verify password against API
                            final authRepo = ref.read(authRepositoryProvider);
                            await authRepo.login(email, password);

                            // Perform biometric scan verification
                            final bio = BiometricService();
                            final didAuth = await bio.authenticate();

                            if (didAuth) {
                              await bio.enableBiometric(email, password);
                              if (mounted) {
                                setState(() => _biometricEnabled = true);
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Biometric authentication enabled successfully!'),
                                    backgroundColor: Color(0xFF16A34A),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            } else {
                              setSheetState(() {
                                isVerifying = false;
                                errorText = 'Biometric scan was cancelled.';
                              });
                            }
                          } catch (e) {
                            setSheetState(() {
                              isVerifying = false;
                              errorText = 'Incorrect password. Please try again.';
                            });
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isVerifying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Confirm & Enable',
                          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 15),
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
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Privacy & Security'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.textPrimary),
        titleTextStyle: theme.textTheme.titleLarge?.copyWith(
          color: AppTheme.textPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionHeader('Account Security'),
            ListTile(
              onTap: () => context.push('/change-password'),
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.password_rounded, color: AppTheme.textPrimary),
              title: const Text(
                'Change Password',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              subtitle: const Text('Update your login password securely.', style: TextStyle(color: AppTheme.textSecondary)),
              trailing: const Icon(Icons.chevron_right_rounded, color: AppTheme.textSecondary),
            ),
            const Divider(height: 32, color: AppTheme.borderColor),
            if (_isLoadingBiometric)
              const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
            else if (_biometricAvailable)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'Biometric Authentication',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                subtitle: const Text('Use fingerprint or FaceID for fast & secure sign in.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                value: _biometricEnabled,
                onChanged: _toggleBiometric,
                activeTrackColor: const Color(0xFF2563EB),
                secondary: const Icon(Icons.fingerprint_rounded, color: AppTheme.textPrimary),
              )
            else
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.fingerprint_rounded, color: AppTheme.textSecondary),
                title: const Text(
                  'Biometric Authentication',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                subtitle: const Text(
                  'Biometric authentication is not supported or not configured on this device.',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Not Available',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            const SizedBox(height: 32),
            _buildSectionHeader('Privacy'),
            ListTile(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Opening Privacy Policy...')),
                );
              },
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.policy_outlined, color: AppTheme.textPrimary),
              title: const Text(
                'Privacy Policy',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              subtitle: const Text('Review how we handle your data.', style: TextStyle(color: AppTheme.textSecondary)),
              trailing: const Icon(Icons.open_in_new_rounded, color: AppTheme.textSecondary),
            ),
            const Divider(height: 32, color: AppTheme.borderColor),
            ListTile(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Opening Terms of Service...')),
                );
              },
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined, color: AppTheme.textPrimary),
              title: const Text(
                'Terms of Service',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              trailing: const Icon(Icons.open_in_new_rounded, color: AppTheme.textSecondary),
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
          color: AppTheme.textSecondary,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}
