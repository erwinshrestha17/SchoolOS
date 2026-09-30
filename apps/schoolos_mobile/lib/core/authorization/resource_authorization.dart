/// Reader for the canonical `authorization` (ResourceAuthorization) contract
/// shared with the Web (packages/core/src/authorization-contract.ts).
///
/// Fail-closed: an action is allowed only when the server's projection says
/// so with an ENABLED entitlement. Returns null when the payload has no
/// canonical projection at all (older server), so callers can fall back to
/// the legacy flag — never to `true`.
bool? canonicalActionAllowed(Map<String, dynamic> json, String action) {
  final authorization = json['authorization'];
  if (authorization is! Map) return null;
  final entitlement = authorization['entitlementState'];
  if (entitlement is! Map || entitlement['state'] != 'ENABLED') return false;
  final capabilities = authorization['capabilities'];
  if (capabilities is! Map) return false;
  return capabilities[action] == true;
}
