/// Client guidance mirrors the backend's basic password requirements. The
/// backend still checks private identity hints and remains authoritative.
String? passwordValidationMessage(String password, String? email) {
  final normalized = password.toLowerCase();
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!RegExp('[A-Z]').hasMatch(password)) {
    return 'Password needs an uppercase letter.';
  }
  if (!RegExp('[a-z]').hasMatch(password)) {
    return 'Password needs a lowercase letter.';
  }
  if (!RegExp(r'\d').hasMatch(password)) return 'Password needs a number.';
  if (!RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
    return 'Password needs a symbol.';
  }
  if (const {
    'admin123',
    'password123',
    'school123',
    'qwerty123',
    'welcome123',
    'letmein123',
  }.contains(normalized)) {
    return 'Password must not use a common school password.';
  }
  final emailParts =
      email
          ?.toLowerCase()
          .split(RegExp('[^a-z0-9]+'))
          .where((part) => part.length >= 3) ??
      const Iterable<String>.empty();
  if (emailParts.any(normalized.contains)) {
    return 'Password must not include your email.';
  }
  return null;
}
