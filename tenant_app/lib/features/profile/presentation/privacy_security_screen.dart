import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/biometric_service.dart';

class PrivacySecurityScreen extends StatefulWidget {
  const PrivacySecurityScreen({super.key});

  @override
  State<PrivacySecurityScreen> createState() => _PrivacySecurityScreenState();
}

class _PrivacySecurityScreenState extends State<PrivacySecurityScreen> {
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
      // To enable, we require a successful biometric scan to prove identity
      // However, we don't have the user's password here. 
      // The secure storage requires the password to auto-login.
      // We will show a dialog telling them to enable it during next login.
      _showBiometricInfoDialog();
    } else {
      // Disable it
      await bio.disableBiometric();
      setState(() {
        _biometricEnabled = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Biometric login disabled.')),
        );
      }
    }
  }

  void _showBiometricInfoDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enable Biometric Login'),
        content: const Text(
          'For security reasons, to enable biometric login, please log out and sign in manually using your email and password. '
          'You will be prompted to enable fingerprint/FaceID during the login process.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: const Text('Privacy & Security'),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF18181B)),
        titleTextStyle: theme.textTheme.titleLarge?.copyWith(
          color: const Color(0xFF18181B),
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
              leading: const Icon(Icons.password_rounded, color: Color(0xFF18181B)),
              title: const Text(
                'Change Password',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              subtitle: const Text('Update your login password securely.', style: TextStyle(color: Color(0xFF71717A))),
              trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFFA1A1AA)),
            ),
            const Divider(height: 32, color: Color(0xFFE4E4E7)),
            if (_isLoadingBiometric)
              const Center(child: CircularProgressIndicator())
            else if (_biometricAvailable)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'Biometric Login',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                subtitle: const Text('Use fingerprint or FaceID to sign in.', style: TextStyle(color: Color(0xFF71717A))),
                value: _biometricEnabled,
                onChanged: _toggleBiometric,
                activeColor: const Color(0xFF18181B),
                secondary: const Icon(Icons.fingerprint_rounded, color: Color(0xFF18181B)),
              ),
            if (_biometricAvailable) const SizedBox(height: 32),
            _buildSectionHeader('Privacy'),
            ListTile(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Opening Privacy Policy...')),
                );
              },
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.policy_outlined, color: Color(0xFF18181B)),
              title: const Text(
                'Privacy Policy',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              subtitle: const Text('Review how we handle your data.', style: TextStyle(color: Color(0xFF71717A))),
              trailing: const Icon(Icons.open_in_new_rounded, color: Color(0xFFA1A1AA)),
            ),
            const Divider(height: 32, color: Color(0xFFE4E4E7)),
            ListTile(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Opening Terms of Service...')),
                );
              },
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined, color: Color(0xFF18181B)),
              title: const Text(
                'Terms of Service',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
              ),
              trailing: const Icon(Icons.open_in_new_rounded, color: Color(0xFFA1A1AA)),
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
          color: Color(0xFFA1A1AA),
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}
