class TokenPair {
  const TokenPair({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory TokenPair.fromJson(Map<String, dynamic> json) {
    return TokenPair(
      accessToken:
          json['accessToken'] as String? ??
          json['access_token'] as String? ??
          '',
      refreshToken:
          json['refreshToken'] as String? ??
          json['refresh_token'] as String? ??
          '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'accessToken': accessToken, 'refreshToken': refreshToken};
  }
}
