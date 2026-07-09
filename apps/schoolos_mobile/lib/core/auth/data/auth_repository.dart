import '../../network/api_client.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';
import '../models/token_pair.dart';
import '../../errors/app_exception.dart';

class AuthRepository {
  const AuthRepository(this.client);

  final ApiClient client;

  /// Sign in with tenant credentials
  Future<LoginResponse> login(LoginRequest request) async {
    final response = await client.post('/auth/login', data: request.toJson());
    final data = response.data as Map<String, dynamic>;
    if (data['requiresMfa'] == true) {
      throw const MfaRequiredException();
    }
    final result = LoginResponse.fromJson(data);
    if (result.tokenPair.accessToken.isEmpty ||
        result.tokenPair.refreshToken.isEmpty ||
        result.user.id.isEmpty) {
      throw const AuthException(
        message: 'SchoolOS could not create a valid mobile session.',
        code: 'INVALID_AUTH_RESPONSE',
      );
    }
    return result;
  }

  /// Fetch active profile details
  Future<AuthUser> getMe() async {
    final response = await client.get('/auth/me');
    return AuthUser.fromJson(response.data as Map<String, dynamic>);
  }

  /// Request new access token using a refresh token
  Future<TokenPair> refreshToken(String refresh) async {
    // Call refresh endpoint with the refresh token in headers or custom config
    final response = await client.post(
      '/auth/refresh',
      data: {'refreshToken': refresh},
    );
    return TokenPair.fromJson(response.data as Map<String, dynamic>);
  }

  Future<String> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
    bool logoutOtherDevices = true,
  }) async {
    final response = await client.post(
      '/auth/change-password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmNewPassword': confirmNewPassword,
        'logoutOtherDevices': logoutOtherDevices,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'] as String?;
      if (message != null && message.trim().isNotEmpty) {
        return message;
      }
    }
    return logoutOtherDevices
        ? 'Password changed successfully. For your security, other sessions have been signed out.'
        : 'Password changed successfully.';
  }

  /// Gracefully sign out on servers
  Future<void> logout({String? refreshToken, String? installationId}) async {
    await client.post(
      '/auth/logout',
      data: {'refreshToken': ?refreshToken, 'installationId': ?installationId},
    );
  }
}
