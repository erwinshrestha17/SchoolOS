import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'secure_storage_service.dart';

final tokenStorageServiceProvider = Provider<TokenStorageService>((ref) {
  final secureStorage = ref.watch(secureStorageServiceProvider);
  return TokenStorageService(secureStorage);
});

class TokenStorageService {
  const TokenStorageService(this._storage);

  final SecureStorageService _storage;

  static const String _accessTokenKey = 'school_os_access_token';
  static const String _refreshTokenKey = 'school_os_refresh_token';
  static const String _userRoleKey = 'school_os_user_role';

  Future<void> saveAccessToken(String token) async {
    await _storage.write(_accessTokenKey, token);
  }

  Future<String?> getAccessToken() async {
    return _storage.read(_accessTokenKey);
  }

  Future<void> deleteAccessToken() async {
    await _storage.delete(_accessTokenKey);
  }

  Future<void> saveRefreshToken(String token) async {
    await _storage.write(_refreshTokenKey, token);
  }

  Future<String?> getRefreshToken() async {
    return _storage.read(_refreshTokenKey);
  }

  Future<void> deleteRefreshToken() async {
    await _storage.delete(_refreshTokenKey);
  }

  Future<void> saveUserRole(String role) async {
    await _storage.write(_userRoleKey, role);
  }

  Future<String?> getUserRole() async {
    return _storage.read(_userRoleKey);
  }

  Future<void> deleteUserRole() async {
    await _storage.delete(_userRoleKey);
  }

  Future<void> clearTokens() async {
    await deleteAccessToken();
    await deleteRefreshToken();
    await deleteUserRole();
  }

  Future<bool> hasValidSession() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty && !isAccessTokenExpired(token);
  }

  bool isAccessTokenExpired(String token, {DateTime? now}) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      if (payload is! Map<String, dynamic> || payload['exp'] is! num) {
        return true;
      }
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(
        (payload['exp'] as num).toInt() * 1000,
        isUtc: true,
      );
      return !expiresAt.isAfter((now ?? DateTime.now()).toUtc());
    } catch (_) {
      return true;
    }
  }
}
