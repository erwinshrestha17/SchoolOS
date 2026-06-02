import '../mobile_role.dart';

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.tenantId,
    this.tenantSlug,
    this.roles = const [],
    this.permissions = const [],
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String email;
  final String role; // e.g. PARENT, STUDENT, TEACHER, DRIVER, STAFF, ADMIN
  final String? tenantId;
  final String? tenantSlug;
  final List<String> roles;
  final List<String> permissions;
  final String? avatarUrl;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .toList();
    final permissions = (json['permissions'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .toList();
    final staff = json['staff'] is Map<String, dynamic>
        ? json['staff'] as Map<String, dynamic>
        : null;
    final student = json['student'] is Map<String, dynamic>
        ? json['student'] as Map<String, dynamic>
        : null;
    final tenant = json['tenant'] is Map<String, dynamic>
        ? json['tenant'] as Map<String, dynamic>
        : null;
    final email = json['email'] as String? ?? '';
    final firstName =
        json['firstName'] as String? ??
        json['firstNameEn'] as String? ??
        json['first_name'] as String? ??
        staff?['firstName'] as String? ??
        student?['firstNameEn'] as String?;
    final lastName =
        json['lastName'] as String? ??
        json['lastNameEn'] as String? ??
        json['last_name'] as String? ??
        staff?['lastName'] as String? ??
        student?['lastNameEn'] as String?;
    final emailName = email.contains('@') ? email.split('@').first : email;
    final displayName =
        json['name'] as String? ??
        [firstName, lastName]
            .where((part) => part != null && part.trim().isNotEmpty)
            .join(' ')
            .trim();

    return AuthUser(
      id: json['id'] as String? ?? json['userId'] as String? ?? '',
      name: displayName.isNotEmpty
          ? displayName
          : emailName.isNotEmpty
          ? emailName
          : 'SchoolOS User',
      email: email,
      role: MobileRole.normalize(json['role'] as String?, roles: roles),
      tenantId:
          json['tenantId'] as String? ??
          json['tenant_id'] as String? ??
          tenant?['id'] as String?,
      tenantSlug:
          json['tenantSlug'] as String? ??
          json['tenant_slug'] as String? ??
          tenant?['slug'] as String?,
      roles: roles,
      permissions: permissions,
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'tenantId': tenantId,
      'tenantSlug': tenantSlug,
      'roles': roles,
      'permissions': permissions,
      'avatarUrl': avatarUrl,
    };
  }
}
