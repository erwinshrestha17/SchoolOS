import 'auth_user.dart';
import 'token_pair.dart';

class LoginResponse {
  const LoginResponse({required this.tokenPair, required this.user});

  final TokenPair tokenPair;
  final AuthUser user;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      tokenPair: TokenPair.fromJson(
        json['tokens'] as Map<String, dynamic>? ?? json,
      ),
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>? ?? json),
    );
  }

  Map<String, dynamic> toJson() {
    return {'tokens': tokenPair.toJson(), 'user': user.toJson()};
  }
}
