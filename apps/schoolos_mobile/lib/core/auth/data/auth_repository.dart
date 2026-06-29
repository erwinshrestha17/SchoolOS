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

  /// Gracefully sign out on servers
  Future<void> logout({String? refreshToken, String? installationId}) async {
    await client.post(
      '/auth/logout',
      data: {'refreshToken': ?refreshToken, 'installationId': ?installationId},
    );
  }
}
