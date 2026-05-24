class LoginRequest {
  const LoginRequest({
    required this.tenantSlug,
    required this.usernameOrEmail,
    required this.password,
  });

  final String tenantSlug;
  final String usernameOrEmail;
  final String password;

  Map<String, dynamic> toJson() {
    return {
      'tenantSlug': tenantSlug,
      'email': usernameOrEmail,
      'password': password,
    };
  }
}
