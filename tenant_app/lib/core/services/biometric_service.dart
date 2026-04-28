import 'package:local_auth/local_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Service to handle biometric (fingerprint/face) authentication.
/// 
/// Flow:
/// 1. User logs in with email/password successfully.
/// 2. App asks if they want to enable biometric login.
/// 3. If yes, we store a flag in secure storage.
/// 4. Next time the app opens with a valid session, we show the biometric prompt
///    instead of the login screen.
class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const String _biometricEnabledKey = 'biometric_enabled';

  /// Check if the device supports biometric authentication.
  Future<bool> isDeviceSupported() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return isSupported && canCheck;
    } catch (e) {
      debugPrint('Caught error: $e');
      return false;
    }
  }

  /// Check if biometric login has been enabled by the user.
  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _biometricEnabledKey);
    return value == 'true';
  }

  /// Enable biometric login.
  Future<void> enableBiometric() async {
    await _storage.write(key: _biometricEnabledKey, value: 'true');
  }

  /// Disable biometric login.
  Future<void> disableBiometric() async {
    await _storage.delete(key: _biometricEnabledKey);
  }

  /// Prompt the user for biometric authentication.
  /// Returns true if authentication succeeded, false otherwise.
  Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'Scan your fingerprint to access EstateOS',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      debugPrint('[Biometric] Authentication error: $e');
      return false;
    }
  }
}
