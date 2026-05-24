class LoginRequest {
  const LoginRequest({
    required this.tenantCode,
    required this.usernameOrEmail,
    required this.password,
  });

  final String tenantCode;
  final String usernameOrEmail;
  final String password;

  Map<String, dynamic> toJson() {
    return {
      'tenantCode': tenantCode,
      'email':
          usernameOrEmail, // Map usernameOrEmail to standard 'email' or 'username' backend parameter
      'password': password,
    };
  }
}
