class AuthSession {
  const AuthSession({
    required this.id,
    required this.createdAt,
    required this.expiresAt,
    this.deviceId,
    this.userAgent,
    this.lastUsedAt,
  });

  final String id;
  final String? deviceId;
  final String? userAgent;
  final DateTime createdAt;
  final DateTime? lastUsedAt;
  final DateTime expiresAt;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      id: json['id'] as String? ?? '',
      deviceId: json['deviceId'] as String?,
      userAgent: json['userAgent'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      lastUsedAt: DateTime.tryParse(json['lastUsedAt'] as String? ?? ''),
      expiresAt:
          DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  String get displayName {
    final agent = userAgent?.trim() ?? '';
    if (agent.isEmpty) return 'Unknown device';
    final lower = agent.toLowerCase();
    if (lower.contains('dart') || lower.contains('flutter')) {
      if (lower.contains('android')) return 'SchoolOS Android app';
      if (lower.contains('iphone') || lower.contains('ios')) {
        return 'SchoolOS iOS app';
      }
      return 'SchoolOS mobile app';
    }
    if (lower.contains('mobile') ||
        lower.contains('android') ||
        lower.contains('iphone')) {
      return 'Mobile browser';
    }
    return 'Web browser';
  }
}
