import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/core/authorization/resource_authorization.dart';

Map<String, dynamic> _auth(String state, Map<String, bool> capabilities) => {
  'authorization': {
    'contractVersion': 1,
    'entitlementState': {'module': 'attendance', 'state': state},
    'capabilities': capabilities,
  },
};

void main() {
  test('allows only actions the server projection allows', () {
    final json = _auth('ENABLED', {'CANCEL': true, 'RESUBMIT': false});
    expect(canonicalActionAllowed(json, 'CANCEL'), isTrue);
    expect(canonicalActionAllowed(json, 'RESUBMIT'), isFalse);
    expect(canonicalActionAllowed(json, 'DELETE'), isFalse);
  });

  test('denies everything when the entitlement is not confirmed', () {
    final json = _auth('UNKNOWN', {'CANCEL': true});
    expect(canonicalActionAllowed(json, 'CANCEL'), isFalse);
  });

  test(
    'returns null (use legacy fallback) only when there is no projection',
    () {
      expect(canonicalActionAllowed({'canCancel': true}, 'CANCEL'), isNull);
      expect(
        canonicalActionAllowed({'authorization': 'malformed'}, 'CANCEL'),
        isNull,
      );
      expect(
        canonicalActionAllowed({
          'authorization': {'entitlementState': 'bad'},
        }, 'CANCEL'),
        isFalse,
      );
    },
  );
}
