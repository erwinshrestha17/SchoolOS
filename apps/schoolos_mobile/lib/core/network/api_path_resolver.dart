import '../errors/app_exception.dart';

/// Rewrites a backend-supplied file location into a path this app can request
/// through the authenticated API client.
///
/// Protected-file responses carry an absolute URL built from the server's own
/// `API_PUBLIC_BASE_URL`. That value is not the same as the base URL a given
/// mobile build talks to, so following it verbatim is wrong twice over:
///
/// * Security. Every request made through the API client carries the session
///   bearer token. Handing a response-supplied host to that client would leak
///   the token to whatever origin the payload named. Only the path is kept
///   here, so a protected download can never leave the configured API origin.
/// * Correctness. An Android emulator reaches the API on `10.0.2.2` and can
///   never reach the `localhost` the server advertises, so the verbatim URL
///   simply fails.
///
/// Returns a path (with query string, when present) suitable for
/// `ApiClient.get`. Throws [ValidationException] when the value is empty, is
/// not parseable, uses a non-HTTP scheme, or tries to escape the API root.
String resolveApiPath(
  String rawUrl, {
  required String baseUrl,
  String unavailableMessage = 'This file is unavailable.',
}) {
  ValidationException unavailable() =>
      ValidationException(message: unavailableMessage);

  final trimmed = rawUrl.trim();
  if (trimmed.isEmpty) throw unavailable();

  final parsed = Uri.tryParse(trimmed);
  if (parsed == null) throw unavailable();

  // Anything that names a transport other than the API's own is rejected
  // outright rather than coerced: `data:`, `file:` and app scheme payloads
  // have no business reaching the authenticated client.
  if (parsed.hasScheme && parsed.scheme != 'http' && parsed.scheme != 'https') {
    throw unavailable();
  }
  // A scheme-relative URL (`//other-host/path`) also names a foreign origin.
  if (!parsed.hasScheme && parsed.hasAuthority) throw unavailable();

  var path = parsed.path;
  if (!path.startsWith('/')) path = '/$path';

  // Strip the API root the client already applies (for example `/api/v1`) so
  // the caller does not end up requesting it twice.
  final basePath = _normalizedBasePath(baseUrl);
  if (basePath.isNotEmpty) {
    if (path == basePath) {
      path = '/';
    } else if (path.startsWith('$basePath/')) {
      path = path.substring(basePath.length);
    }
  }

  // Traversal is already neutralised: `Uri` decodes percent escapes and
  // removes dot segments while parsing, so neither `/a/../../b` nor
  // `/a/%2e%2e/%2e%2e/b` survives into `parsed.path`. The path is also always
  // absolute here, so the client's base-URL concatenation keeps the request
  // under the API root. See `api_path_resolver_test.dart`.
  final query = parsed.query;
  return query.isEmpty ? path : '$path?$query';
}

String _normalizedBasePath(String baseUrl) {
  final base = Uri.tryParse(baseUrl.trim());
  if (base == null) return '';
  var basePath = base.path;
  while (basePath.endsWith('/')) {
    basePath = basePath.substring(0, basePath.length - 1);
  }
  return basePath;
}
