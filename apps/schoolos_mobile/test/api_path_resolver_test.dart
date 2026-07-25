import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_path_resolver.dart';

void main() {
  const base = 'https://api.schoolos.test/api/v1';

  group('resolveApiPath', () {
    test('keeps an already API-relative path unchanged', () {
      expect(
        resolveApiPath('/files/asset-1/preview', baseUrl: base),
        '/files/asset-1/preview',
      );
    });

    test('reduces a same-origin absolute URL to an API-relative path', () {
      expect(
        resolveApiPath(
          'https://api.schoolos.test/api/v1/files/asset-1/preview',
          baseUrl: base,
        ),
        '/files/asset-1/preview',
      );
    });

    test('drops a foreign host so the session token cannot follow it', () {
      // A protected download must never be fetched from a host named by a
      // response body: the authenticated client attaches the bearer token to
      // every request it makes.
      expect(
        resolveApiPath('https://attacker.example/steal/asset-1', baseUrl: base),
        '/steal/asset-1',
      );
    });

    test('rebases a URL advertised on a host this build cannot reach', () {
      // The server advertises API_PUBLIC_BASE_URL, which is not the base URL an
      // Android emulator build talks to.
      expect(
        resolveApiPath(
          'http://localhost:4000/api/v1/files/asset-1/preview',
          baseUrl: 'http://10.0.2.2:4000/api/v1',
        ),
        '/files/asset-1/preview',
      );
    });

    test('preserves the query string', () {
      expect(
        resolveApiPath(
          'https://api.schoolos.test/api/v1/files/asset-1/preview?token=abc',
          baseUrl: base,
        ),
        '/files/asset-1/preview?token=abc',
      );
    });

    test('rejects an empty or unparseable value', () {
      expect(
        () => resolveApiPath('   ', baseUrl: base),
        throwsA(isA<ValidationException>()),
      );
    });

    test('rejects non-HTTP schemes', () {
      for (final raw in [
        'data:application/pdf;base64,AAAA',
        'file:///etc/passwd',
        'schoolos://open',
      ]) {
        expect(
          () => resolveApiPath(raw, baseUrl: base),
          throwsA(isA<ValidationException>()),
          reason: raw,
        );
      }
    });

    test('rejects a scheme-relative URL naming a foreign authority', () {
      expect(
        () => resolveApiPath('//attacker.example/asset-1', baseUrl: base),
        throwsA(isA<ValidationException>()),
      );
    });

    test('normalises traversal away, plain and percent-encoded', () {
      // `Uri` decodes escapes and removes dot segments while parsing, so no
      // traversal survives into the path handed to the client. The result is
      // always absolute, so the client's base-URL concatenation keeps the
      // request under the API root.
      expect(
        resolveApiPath('/files/../../admin/secrets', baseUrl: base),
        '/admin/secrets',
      );
      expect(
        resolveApiPath('/files/%2e%2e/%2e%2e/admin', baseUrl: base),
        '/admin',
      );
    });

    test('carries the caller supplied unavailable message', () {
      expect(
        () => resolveApiPath(
          '',
          baseUrl: base,
          unavailableMessage: 'This homework attachment is unavailable.',
        ),
        throwsA(
          isA<ValidationException>().having(
            (error) => error.message,
            'message',
            'This homework attachment is unavailable.',
          ),
        ),
      );
    });
  });
}
