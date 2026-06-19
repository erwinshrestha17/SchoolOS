class MobileRole {
  const MobileRole._();

  static const parent = 'PARENT';
  static const teacher = 'TEACHER';
  static const staff = 'STAFF';
  static const principal = 'PRINCIPAL';
  static const admin = 'ADMIN';
  static const student = 'STUDENT';
  static const driver = 'DRIVER';

  static String normalize(String? role, {List<String> roles = const []}) {
    final candidates = <String>[
      ?role,
      ...roles,
    ].map(_clean).where((value) => value.isNotEmpty).toList();

    if (candidates.any(_isAdmin)) return admin;
    if (candidates.any(_isPrincipal)) return principal;
    if (candidates.any(_isTeacher)) return teacher;
    if (candidates.any(_isStaff)) return staff;
    if (candidates.any((value) => value == 'PARENT' || value == 'GUARDIAN')) {
      return parent;
    }
    if (candidates.any((value) => value == 'DRIVER' || value == 'TRANSPORT')) {
      return driver;
    }
    if (candidates.any((value) => value == 'STUDENT')) return student;

    return candidates.isNotEmpty ? candidates.first : student;
  }

  static bool isParent(String? role) => normalize(role) == parent;
  static bool isTeacher(String? role) => normalize(role) == teacher;
  static bool isStaff(String? role) => normalize(role) == staff;
  static bool isPrincipal(String? role) => normalize(role) == principal;
  static bool isAdmin(String? role) => normalize(role) == admin;
  static bool isStudent(String? role) => normalize(role) == student;
  static bool isDriver(String? role) => normalize(role) == driver;

  static String _clean(String value) =>
      value.trim().replaceAll('-', '_').toUpperCase();

  static bool _isAdmin(String value) {
    return value == 'ADMIN' ||
        value == 'SUPER_ADMIN' ||
        value == 'PLATFORM_SUPER_ADMIN';
  }

  static bool _isPrincipal(String value) {
    return value == 'PRINCIPAL' || value == 'HEAD_TEACHER';
  }

  static bool _isTeacher(String value) {
    return value == 'TEACHER' ||
        value == 'CLASS_TEACHER' ||
        value == 'SUBJECT_TEACHER';
  }

  static bool _isStaff(String value) {
    return value == 'STAFF' ||
        value == 'ACCOUNTANT' ||
        value == 'LIBRARIAN' ||
        value == 'RECEPTIONIST' ||
        value == 'HR' ||
        value == 'HR_MANAGER' ||
        value == 'FINANCE' ||
        value == 'FINANCE_OFFICER';
  }
}
