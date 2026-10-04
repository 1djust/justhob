import 'package:local_auth/local_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Service to handle biometric (fingerprint/face) authentication.
/// 
/// Flow:
/// 1. User logs in with email/password successfully.
/// 2. App asks if they want to enable biometric login.
/// 3. If yes, we store a flag and the credentials securely.
/// 4. Next time the app opens with a valid session or expired session, 
///    we show the biometric prompt and use credentials to auto-login.
class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  static bool _isAuthenticating = false;
  static bool _isAuthenticated = false;

  /// Returns whether biometric authentication has already succeeded in this session.
  static bool get isAuthenticated => _isAuthenticated;

  /// Resets the session flags (e.g. upon user logout).
  static void resetSession() {
    _isAuthenticating = false;
    _isAuthenticated = false;
  }

  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const String _biometricEnabledKey = 'biometric_enabled';
  static const String _biometricEmailKey = 'biometric_email';
  static const String _biometricPasswordKey = 'biometric_password';

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
    try {
      final value = await _storage.read(key: _biometricEnabledKey);
      return value == 'true';
    } catch (e) {
      debugPrint('[BiometricService] isBiometricEnabled error: $e');
      // If secure storage is corrupted from switching encryption types, clear it
      await _storage.deleteAll();
      return false;
    }
  }

  /// Enable biometric login and save credentials.
  Future<void> enableBiometric(String email, String password) async {
    try {
      await _storage.write(key: _biometricEnabledKey, value: 'true');
      await _storage.write(key: _biometricEmailKey, value: email);
      await _storage.write(key: _biometricPasswordKey, value: password);
    } catch (e) {
      debugPrint('[BiometricService] enableBiometric error: $e');
    }
  }

  /// Disable biometric login.
  Future<void> disableBiometric() async {
    resetSession();
    await _storage.delete(key: _biometricEnabledKey);
    await _storage.delete(key: _biometricEmailKey);
    await _storage.delete(key: _biometricPasswordKey);
  }

  /// Get stored credentials
  Future<Map<String, String>?> getStoredCredentials() async {
    final email = await _storage.read(key: _biometricEmailKey);
    final password = await _storage.read(key: _biometricPasswordKey);
    if (email != null && password != null) {
      return {'email': email, 'password': password};
    }
    return null;
  }

  /// Prompt the user for biometric authentication.
  /// Strictly guarantees a single active biometric prompt at any time.
  Future<bool> authenticate() async {
    if (_isAuthenticating || _isAuthenticated) {
      debugPrint('[BiometricService] Skipping authenticate — already in progress or already authenticated.');
      return false;
    }

    _isAuthenticating = true;
    try {
      final success = await _auth.authenticate(
        localizedReason: 'Scan your fingerprint to access PropertyStack',
        options: const AuthenticationOptions(
          stickyAuth: false, // Prevents Android OS from re-opening prompt when activity pauses/resumes
          biometricOnly: true,
          sensitiveTransaction: false, // Prevents Android requiring a secondary confirmation tap
          useErrorDialogs: true,
        ),
      );
      if (success) {
        _isAuthenticated = true;
      }
      return success;
    } catch (e) {
      debugPrint('[Biometric] Authentication error: $e');
      return false;
    } finally {
      _isAuthenticating = false;
    }
  }
}
