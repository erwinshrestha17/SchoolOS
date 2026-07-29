import 'auth_user.dart';
import 'token_pair.dart';

class LoginResponse {
  const LoginResponse({required this.tokenPair, required this.user});

  final TokenPair tokenPair;
  final AuthUser user;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    final rawUser = json['user'] as Map<String, dynamic>? ?? json;
    final tenant = json['tenant'];
    final user = <String, dynamic>{...rawUser};
    if (tenant is Map<String, dynamic> && user['tenant'] == null) {
      user['tenant'] = tenant;
    }
    return LoginResponse(
      tokenPair: TokenPair.fromJson(
        json['tokens'] as Map<String, dynamic>? ?? json,
      ),
      user: AuthUser.fromJson(user),
    );
  }

  Map<String, dynamic> toJson() {
    return {'tokens': tokenPair.toJson(), 'user': user.toJson()};
  }
}
