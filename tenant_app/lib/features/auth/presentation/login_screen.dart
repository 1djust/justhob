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

class _LoginScreenState extends ConsumerState<LoginScreen> with WidgetsBindingObserver {
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
    WidgetsBinding.instance.addObserver(this);
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

      // Auto-trigger biometric prompt if enabled for seamless re-entry
      if (enabled) {
        _handleBiometricLogin();
      }
    }
  }

  Future<void> _handleBiometricLogin() async {
    final bio = BiometricService();
    final success = await bio.authenticate();
    if (success && mounted) {
      // Biometric passed — retrieve stored credentials and login
      final credentials = await bio.getStoredCredentials();
      if (credentials != null) {
        setState(() => _isSubmitting = true);
        await ref.read(authStateProvider.notifier).login(
              credentials['email']!,
              credentials['password']!,
            );
        final authState = ref.read(authStateProvider);
        if (authState.hasValue && authState.value != null && mounted) {
          context.go('/');
        } else if (mounted) {
          setState(() {
            _isSubmitting = false;
            _errorMessage = 'Biometric login failed. Please sign in manually.';
          });
        }
      } else if (mounted) {
        setState(() {
          _errorMessage = 'No saved credentials. Please sign in manually.';
        });
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _biometricEnabled && !_isSubmitting) {
      _handleBiometricLogin();
    }
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _errorMessage = null;
        _isSubmitting = true;
      });

      try {
        final authRepo = ref.read(authRepositoryProvider);
        final user = await authRepo.login(
          _emailController.text,
          _passwordController.text,
        );

        // Login succeeded, valid credentials!
        // Show dialog BEFORE updating the global auth provider
        if (_biometricAvailable && !_biometricEnabled && mounted) {
          setState(() => _isSubmitting = false);
          await _showEnableBiometricDialog();
        }

        // NOW update the global auth provider.
        // This will instantly trigger the app_router to redirect to '/'
        if (mounted) {
          ref.read(authStateProvider.notifier).setUser(user);
        }
      } catch (e) {
        if (mounted) {
          String errorMsg = 'Login failed. Please try again.';
          if (e is Exception) {
            errorMsg = e.toString().replaceFirst('Exception: ', '');
          } else {
            errorMsg = e.toString();
          }
          setState(() {
            _isSubmitting = false;
            _errorMessage = errorMsg;
            _shakeCounter++;
          });
        }
      }
    }
  }

  Future<void> _showEnableBiometricDialog() {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.fingerprint, color: Theme.of(context).colorScheme.primary, size: 28),
            const SizedBox(width: 12),
            const Expanded(child: Text('Enable Fingerprint?')),
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
              await BiometricService().enableBiometric(
                _emailController.text,
                _passwordController.text,
              );
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
    ref.watch(authStateProvider);
    final isLoading = _isSubmitting;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 40.0),
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
                  const SizedBox(height: 48),
                  // Logo
                  Center(
                    child: Icon(
                      Icons.apartment_rounded,
                      size: 72,
                      color: const Color(0xFF18181B),
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Welcome text
                  Text(
                    'Welcome Back',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF18181B),
                      letterSpacing: -0.5,
                      fontSize: 28,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to your tenant portal',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: const Color(0xFF71717A),
                      fontSize: 15,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  _buildErrorBanner(theme),
                  // Email field
                  TextFormField(
                    controller: _emailController,
                    enabled: !isLoading,
                    onChanged: _onInputChanged,
                    style: const TextStyle(color: Color(0xFF18181B), fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Email Address',
                      hintStyle: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 15),
                      prefixIcon: const Icon(Icons.mail_outline_rounded, color: Color(0xFFA1A1AA), size: 22),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE4E4E7)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE4E4E7)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF18181B), width: 1.5),
                      ),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) =>
                        value?.isEmpty ?? true ? 'Email is required' : null,
                  ),
                  const SizedBox(height: 16),
                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    enabled: !isLoading,
                    onChanged: _onInputChanged,
                    style: const TextStyle(color: Color(0xFF18181B), fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Password',
                      hintStyle: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 15),
                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFFA1A1AA), size: 22),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: const Color(0xFFA1A1AA),
                          size: 22,
                        ),
                        onPressed: isLoading
                            ? null
                            : () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE4E4E7)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE4E4E7)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF18181B), width: 1.5),
                      ),
                    ),
                    obscureText: _obscurePassword,
                    validator: (value) =>
                        value?.isEmpty ?? true ? 'Password is required' : null,
                  ),
                  // Forgot Password
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => _showForgotPasswordDialog(context),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF18181B),
                        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      child: const Text('Forgot Password?'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Sign In button
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF18181B),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFF18181B).withAlpha(150),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      child: isLoading
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Sign In'),
                    ),
                  ),
                  const SizedBox(height: 28),
                  // Need an account?
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 4,
                    children: [
                      Text(
                        'Need an account?',
                        style: TextStyle(
                          color: const Color(0xFF71717A),
                          fontSize: 14,
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Request an invite from your landlord.')),
                          );
                        },
                        child: const Text(
                          'Contact Manager',
                          style: TextStyle(
                            color: Color(0xFF18181B),
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  // Fingerprint icon at the bottom
                  if (_biometricAvailable && _biometricEnabled) ...[
                    const SizedBox(height: 40),
                    Center(
                      child: GestureDetector(
                        onTap: _handleBiometricLogin,
                        child: Icon(
                          Icons.fingerprint,
                          size: 44,
                          color: const Color(0xFF71717A),
                        ),
                      ),
                    ),
                  ],
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
                debugPrint('Caught error: $e');
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


