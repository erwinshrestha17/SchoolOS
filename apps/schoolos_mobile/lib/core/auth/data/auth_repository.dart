import '../../network/api_client.dart';
import '../models/auth_user.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';
import '../models/token_pair.dart';

class AuthRepository {
  const AuthRepository(this.client);

  final ApiClient client;

  /// Sign in with tenant credentials
  Future<LoginResponse> login(LoginRequest request) async {
    final response = await client.post('/auth/login', data: request.toJson());
    return LoginResponse.fromJson(response.data as Map<String, dynamic>);
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
  Future<void> logout({String? refreshToken}) async {
    await client.post(
      '/auth/logout',
      data: refreshToken == null ? null : {'refreshToken': refreshToken},
    );
  }
}
