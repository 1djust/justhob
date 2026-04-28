import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'auth_notifier.dart';
import '../../../core/services/update_service.dart';
import '../../../core/services/biometric_service.dart';
import '../../../core/widgets/app_update_dialog.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  int _shakeCounter = 0;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkForUpdates();
    _checkBiometric();
  }

  Future<void> _checkForUpdates() async {
    final updateService = UpdateService();
    final updateInfo = await updateService.checkForUpdate();
    if (updateInfo != null && mounted) {
      AppUpdateDialog.show(context, updateInfo);
    }
  }

  Future<void> _checkBiometric() async {
    final bio = BiometricService();
    final supported = await bio.isDeviceSupported();
    final enabled = await bio.isBiometricEnabled();
    if (mounted) {
      setState(() {
        _biometricAvailable = supported;
        _biometricEnabled = enabled;
      });
      // Auto-prompt fingerprint if enabled and user has a session
      if (supported && enabled) {
        _handleBiometricLogin();
      }
    }
  }

  Future<void> _handleBiometricLogin() async {
    final bio = BiometricService();
    final success = await bio.authenticate();
    if (success && mounted) {
      // Biometric passed — check if we have a valid session
      final authState = ref.read(authStateProvider);
      if (authState.hasValue && authState.value != null) {
        context.go('/');
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _errorMessage = null;
        _isSubmitting = true;
      });

      await ref.read(authStateProvider.notifier).login(
            _emailController.text,
            _passwordController.text,
          );
      
      final authState = ref.read(authStateProvider);
      if (authState.hasValue && authState.value != null) {
        if (mounted) context.go('/');
      } else if (authState.hasError) {
        if (mounted) {
          // Extract the actual error message instead of showing a generic one
          String errorMsg = 'Login failed. Please try again.';
          final error = authState.error;
          if (error is Exception) {
            errorMsg = error.toString().replaceFirst('Exception: ', '');
          } else if (error != null) {
            errorMsg = error.toString();
          }
          setState(() {
            _isSubmitting = false;
            _errorMessage = errorMsg;
            _shakeCounter++;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _isSubmitting = false;
          });
        }
      }

      // After successful login, offer to enable biometric if device supports it
      final postLoginState = ref.read(authStateProvider);
      if (postLoginState.hasValue && postLoginState.value != null && _biometricAvailable && !_biometricEnabled) {
        _showEnableBiometricDialog();
      }
    }
  }

  void _showEnableBiometricDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.fingerprint, color: Theme.of(context).colorScheme.primary, size: 28),
            const SizedBox(width: 12),
            const Text('Enable Fingerprint?'),
          ],
        ),
        content: const Text(
          'Would you like to use your fingerprint to quickly unlock the app next time?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Not Now'),
          ),
          ElevatedButton(
            onPressed: () async {
              await BiometricService().enableBiometric();
              setState(() => _biometricEnabled = true);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Enable'),
          ),
        ],
      ),
    );
  }

  void _onInputChanged(String _) {
    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }
  }

  Widget _buildErrorBanner(ThemeData theme) {
    if (_errorMessage == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, color: Colors.red.shade700, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _errorMessage!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: Colors.red.shade900,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Watch auth state for navigation redirect, but use local _isSubmitting for UI
    ref.watch(authStateProvider);
    final isLoading = _isSubmitting;
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
          child: TweenAnimationBuilder<double>(
            key: ValueKey(_shakeCounter),
            duration: const Duration(milliseconds: 400),
            curve: Curves.elasticIn,
            tween: Tween(begin: 0.0, end: _shakeCounter > 0 ? 8.0 : 0.0),
            builder: (context, value, child) {
              return Transform.translate(
                offset: Offset(value * (value % 2 == 0 ? 1 : -1), 0),
                child: child,
              );
            },
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  Icon(
                    Icons.apartment_rounded,
                    size: 80,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 32),
                  Text(
                    'Welcome Back',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.primary,
                      letterSpacing: -0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to your tenant portal',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: Colors.grey.shade600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  _buildErrorBanner(theme),
                  TextFormField(
                    controller: _emailController,
                    enabled: !isLoading,
                    onChanged: _onInputChanged,
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) =>
                        value?.isEmpty ?? true ? 'Email is required' : null,
                  ),
                  const SizedBox(height: 20),
                  TextFormField(
                    controller: _passwordController,
                    enabled: !isLoading,
                    onChanged: _onInputChanged,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                        onPressed: isLoading
                            ? null
                            : () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                      ),
                    ),
                    obscureText: _obscurePassword,
                    validator: (value) =>
                        value?.isEmpty ?? true ? 'Password is required' : null,
                  ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => _showForgotPasswordDialog(context),
                    child: const Text('Forgot Password?'),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: isLoading ? null : _handleLogin,
                  child: isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Sign In'),
                ),
                // Fingerprint button
                if (_biometricAvailable && _biometricEnabled) ...[
                  const SizedBox(height: 20),
                  Center(
                    child: Column(
                      children: [
                        const Text(
                          'or use biometrics',
                          style: TextStyle(color: Colors.grey, fontSize: 13),
                        ),
                        const SizedBox(height: 12),
                        InkWell(
                          onTap: _handleBiometricLogin,
                          borderRadius: BorderRadius.circular(40),
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: theme.colorScheme.primary.withOpacity(0.1),
                              border: Border.all(
                                color: theme.colorScheme.primary.withOpacity(0.3),
                                width: 2,
                              ),
                            ),
                            child: Icon(
                              Icons.fingerprint,
                              size: 36,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Need an account?', style: TextStyle(color: Colors.grey.shade600)),
                    TextButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Request an invite from your landlord.')),
                        );
                      },
                      child: const Text('Contact Manager'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
  void _showForgotPasswordDialog(BuildContext context) {
    final controller = TextEditingController();
    showAdaptiveDialog(
      context: context,
      builder: (context) => AlertDialog.adaptive(
        title: const Text('Reset Password'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter your email address to receive a password reset link.'),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final email = controller.text.trim();
              if (email.isEmpty) return;

              Navigator.pop(context);
              try {
                await ref.read(authStateProvider.notifier).resetPassword(email);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('If an account exists, a reset link has been sent.'),
                    backgroundColor: Colors.green,
                  ),
                );
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Error: ${e.toString()}'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            },
            child: const Text('Send Reset Link'),
          ),
        ],
      ),
    );
  }
}
