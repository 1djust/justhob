import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:propertystack_mobile/core/theme/app_theme.dart';
import 'auth_notifier.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  final String? initialEmail;
  final int initialStep;

  const RegisterScreen({
    super.key,
    this.initialEmail,
    this.initialStep = 1,
  });

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  late final TextEditingController _confirmPasswordController;
  late final TextEditingController _otpController;
  final _formKey = GlobalKey<FormState>();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isSubmitting = false;
  bool _isVerifyingOtp = false;
  bool _isResendingOtp = false;
  bool _consent = false;
  String? _errorMessage;
  String? _otpError;
  String? _otpSuccessMessage;
  bool _success = false;
  int _shakeCounter = 0;

  Timer? _countdownTimer;
  int _secondsRemaining = 600; // 10 minutes expiry countdown
  int _resendCooldown = 60; // 60 seconds cooldown for resend button

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();
    _otpController = TextEditingController();
    _success = widget.initialStep == 2;
    if (_success) {
      _startCountdownTimer();
    }
  }

  void _startCountdownTimer() {
    _countdownTimer?.cancel();
    _secondsRemaining = 600;
    _resendCooldown = 60;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_secondsRemaining > 0) {
          _secondsRemaining--;
        }
        if (_resendCooldown > 0) {
          _resendCooldown--;
        }
      });
    });
  }

  String get _formattedTimeRemaining {
    final minutes = (_secondsRemaining / 60).floor();
    final seconds = _secondsRemaining % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  // Password validation criteria
  bool get _hasMinLength => _passwordController.text.length >= 8;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passwordController.text);
  bool get _hasLowercase => RegExp(r'[a-z]').hasMatch(_passwordController.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_passwordController.text);
  bool get _hasSpecial =>
      RegExp(r'[!@#$%^&*()_+\[\]{};\x27:"\\|,.<>/?]').hasMatch(_passwordController.text);
  bool get _isPasswordValid =>
      _hasMinLength &&
      _hasUppercase &&
      _hasLowercase &&
      _hasNumber &&
      _hasSpecial;

  void _onInputChanged(String _) {
    setState(() {
      if (_errorMessage != null) {
        _errorMessage = null;
      }
    });
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (!_isPasswordValid) {
      setState(() {
        _errorMessage = 'Please ensure your password meets all requirements.';
        _shakeCounter++;
      });
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() {
        _errorMessage = 'Passwords do not match.';
        _shakeCounter++;
      });
      return;
    }

    if (!_consent) {
      setState(() {
        _errorMessage = 'You must agree to the Terms and Privacy Policy.';
        _shakeCounter++;
      });
      return;
    }

    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      final authRepo = ref.read(authRepositoryProvider);
      await authRepo.register(
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) return;

      setState(() {
        _isSubmitting = false;
        _success = true;
      });
      _startCountdownTimer();
    } catch (e) {
      if (mounted) {
        String errorMsg = 'Registration failed. Please try again.';
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
          Icon(Icons.error_outline_rounded,
              color: Colors.red.shade700, size: 20),
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

  Future<void> _handleVerifyOtp() async {
    final code = _otpController.text.trim();
    if (code.length < 6) {
      setState(() {
        _otpError = 'Please enter the verification code.';
      });
      return;
    }

    setState(() {
      _isVerifyingOtp = true;
      _otpError = null;
      _otpSuccessMessage = null;
    });

    try {
      final authRepo = ref.read(authRepositoryProvider);
      final email = _emailController.text.trim();
      final success = await authRepo.verifyOtp(
        email: email,
        token: code,
      );

      if (!mounted) return;

      if (success) {
        setState(() {
          _isVerifyingOtp = false;
          _otpSuccessMessage = 'Email verified successfully!';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Email verified! You can now log into your account.'),
            backgroundColor: Color(0xFF166534),
          ),
        );
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (mounted) {
            context.go('/login');
          }
        });
      } else {
        setState(() {
          _isVerifyingOtp = false;
          _otpError = 'Invalid verification code. Please check and try again.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifyingOtp = false;
          _otpError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleResendOtp() async {
    setState(() {
      _isResendingOtp = true;
      _otpError = null;
      _otpSuccessMessage = null;
    });

    try {
      final authRepo = ref.read(authRepositoryProvider);
      final email = _emailController.text.trim();
      await authRepo.resendOtp(email: email);

      if (!mounted) return;

      setState(() {
        _isResendingOtp = false;
        _otpSuccessMessage = 'A fresh verification code has been sent to your email.';
      });
      _startCountdownTimer();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isResendingOtp = false;
          _otpError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Widget _buildSuccessBanner(ThemeData theme) {
    final email = _emailController.text.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF86EFAC)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: Icon(
              Icons.mark_email_read_outlined,
              color: Color(0xFF15803D),
              size: 48,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Enter Verification Code',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Color(0xFF166534),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'We have sent a verification code to $email. Enter it below to activate your account.',
            style: const TextStyle(
              fontSize: 13.5,
              color: Color(0xFF374151),
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),

          // Countdown Timer Pill
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: _secondsRemaining > 60
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _secondsRemaining > 60
                      ? const Color(0xFFBBF7D0)
                      : const Color(0xFFFECACA),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _secondsRemaining > 0
                        ? Icons.timer_outlined
                        : Icons.error_outline_rounded,
                    size: 16,
                    color: _secondsRemaining > 60
                        ? const Color(0xFF15803D)
                        : const Color(0xFFDC2626),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _secondsRemaining > 0
                        ? 'Code expires in $_formattedTimeRemaining'
                        : 'Code expired. Request a new one.',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _secondsRemaining > 60
                          ? const Color(0xFF166534)
                          : const Color(0xFF991B1B),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // OTP Code input (supports 6 to 8 digits)
          TextFormField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 8,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: 6,
              color: AppTheme.textPrimary,
            ),
            decoration: InputDecoration(
              counterText: '',
              hintText: '12345678',
              hintStyle: TextStyle(
                fontSize: 20,
                letterSpacing: 6,
                color: Colors.grey.shade400,
              ),
              filled: true,
              fillColor: const Color(0xFFF9FAFB),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF166534), width: 2),
              ),
            ),
          ),

          if (_otpError != null) ...[
            const SizedBox(height: 12),
            Text(
              _otpError!,
              style: const TextStyle(
                color: Colors.red,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
          ],

          if (_otpSuccessMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              _otpSuccessMessage!,
              style: const TextStyle(
                color: Color(0xFF166534),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          ],

          const SizedBox(height: 20),

          // Verify Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isVerifyingOtp ? null : _handleVerifyOtp,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF166534),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isVerifyingOtp
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Verify Code & Sign In',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
          ),

          const SizedBox(height: 14),

          // Resend Code / Change Email row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_resendCooldown > 0)
                Text(
                  'Resend in ${_resendCooldown}s',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF9CA3AF),
                  ),
                )
              else
                TextButton(
                  onPressed: _isResendingOtp ? null : _handleResendOtp,
                  child: Text(
                    _isResendingOtp ? 'Sending...' : 'Resend Code',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF166534),
                    ),
                  ),
                ),
              TextButton(
                onPressed: () {
                  _countdownTimer?.cancel();
                  setState(() {
                    _success = false;
                    _otpController.clear();
                    _otpError = null;
                    _otpSuccessMessage = null;
                  });
                },
                child: const Text(
                  'Change Email',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRequirementItem(String text, bool isMet) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        children: [
          Icon(
            isMet ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            size: 16,
            color: isMet
                ? const Color(0xFF10B981)
                : AppTheme.textSecondary.withAlpha(120),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.w400,
              color: isMet ? AppTheme.textPrimary : AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLoading = _isSubmitting;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 32.0),
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
                  const SizedBox(height: 20),
                  // Logo
                  Center(
                    child: Image.asset(
                      'assets/icon/app_icon.png',
                      height: 64,
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Title
                  Text(
                    'Create Manager Account',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.5,
                      fontSize: 26,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Register as a Property Manager to set up your portfolio',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppTheme.textSecondary,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  if (_success)
                    _buildSuccessBanner(theme)
                  else ...[
                    _buildErrorBanner(theme),

                    // Full Name field
                    TextFormField(
                      controller: _nameController,
                      enabled: !isLoading,
                      onChanged: _onInputChanged,
                      style: const TextStyle(
                          color: AppTheme.textPrimary, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Full Name',
                        hintStyle: const TextStyle(
                            color: AppTheme.textSecondary, fontSize: 15),
                        prefixIcon: const Icon(Icons.person_outline_rounded,
                            color: AppTheme.textSecondary, size: 22),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                              color: AppTheme.textPrimary, width: 1.5),
                        ),
                      ),
                      textCapitalization: TextCapitalization.words,
                      validator: (value) => value == null || value.trim().isEmpty
                          ? 'Full name is required'
                          : null,
                    ),
                    const SizedBox(height: 16),

                    // Company Email field
                    TextFormField(
                      controller: _emailController,
                      enabled: !isLoading,
                      onChanged: _onInputChanged,
                      style: const TextStyle(
                          color: AppTheme.textPrimary, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Company Email',
                        hintStyle: const TextStyle(
                            color: AppTheme.textSecondary, fontSize: 15),
                        prefixIcon: const Icon(Icons.mail_outline_rounded,
                            color: AppTheme.textSecondary, size: 22),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                              color: AppTheme.textPrimary, width: 1.5),
                        ),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Email is required';
                        }
                        if (!value.contains('@') || !value.contains('.')) {
                          return 'Enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password field
                    TextFormField(
                      controller: _passwordController,
                      enabled: !isLoading,
                      onChanged: _onInputChanged,
                      style: const TextStyle(
                          color: AppTheme.textPrimary, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Password',
                        hintStyle: const TextStyle(
                            color: AppTheme.textSecondary, fontSize: 15),
                        prefixIcon: const Icon(Icons.lock_outline_rounded,
                            color: AppTheme.textSecondary, size: 22),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: AppTheme.textSecondary,
                            size: 22,
                          ),
                          onPressed: isLoading
                              ? null
                              : () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                              color: AppTheme.textPrimary, width: 1.5),
                        ),
                      ),
                      obscureText: _obscurePassword,
                      validator: (value) => value == null || value.isEmpty
                          ? 'Password is required'
                          : null,
                    ),
                    const SizedBox(height: 16),

                    // Confirm Password field
                    TextFormField(
                      controller: _confirmPasswordController,
                      enabled: !isLoading,
                      onChanged: _onInputChanged,
                      style: const TextStyle(
                          color: AppTheme.textPrimary, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Confirm Password',
                        hintStyle: const TextStyle(
                            color: AppTheme.textSecondary, fontSize: 15),
                        prefixIcon: const Icon(Icons.lock_reset_rounded,
                            color: AppTheme.textSecondary, size: 22),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureConfirmPassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            color: AppTheme.textSecondary,
                            size: 22,
                          ),
                          onPressed: isLoading
                              ? null
                              : () => setState(() =>
                                  _obscureConfirmPassword =
                                      !_obscureConfirmPassword),
                        ),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 18),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide:
                              const BorderSide(color: AppTheme.borderColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                              color: AppTheme.textPrimary, width: 1.5),
                        ),
                      ),
                      obscureText: _obscureConfirmPassword,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please confirm your password';
                        }
                        if (value != _passwordController.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password Requirements Checklist
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Password Requirements',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          _buildRequirementItem(
                              '8 characters minimum', _hasMinLength),
                          _buildRequirementItem(
                              'One uppercase letter', _hasUppercase),
                          _buildRequirementItem(
                              'One lowercase letter', _hasLowercase),
                          _buildRequirementItem('One number', _hasNumber),
                          _buildRequirementItem(
                              'One special character', _hasSpecial),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Terms Consent Checkbox
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          height: 24,
                          width: 24,
                          child: Checkbox(
                            value: _consent,
                            onChanged: isLoading
                                ? null
                                : (v) => setState(() => _consent = v ?? false),
                            activeColor: AppTheme.primaryColor,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GestureDetector(
                            onTap: isLoading
                                ? null
                                : () => setState(() => _consent = !_consent),
                            child: const Text(
                              'By creating an account, you agree to PropertyStack\'s Terms of Service and Privacy Policy.',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppTheme.textSecondary,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Create Account Button
                    SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: isLoading ? null : _handleRegister,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.textPrimary,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor:
                              AppTheme.textPrimary.withAlpha(150),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 0,
                          textStyle: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600),
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
                            : const Text('Create Account'),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Already have an account? Sign In
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Already have an account?',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          style: TextButton.styleFrom(
                            foregroundColor: AppTheme.primaryColor,
                            textStyle: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          child: const Text('Sign In'),
                        ),
                      ],
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
}
