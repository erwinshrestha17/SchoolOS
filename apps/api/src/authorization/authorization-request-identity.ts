import type { AuthContext } from '../auth/auth.types';
import type { VerifiedAuthorizationIdentity } from './authorization.types';

// Server-only provenance. Neither JSON bodies nor an `auth` object alone can
// manufacture proof that the live authentication guard completed.
const verifiedRequests = new WeakMap<
  object,
  {
    actor: AuthContext;
    identity: VerifiedAuthorizationIdentity;
  }
>();

export function recordVerifiedAuthorizationIdentity(
  request: object,
  actor: AuthContext,
  identity: VerifiedAuthorizationIdentity,
): void {
  verifiedRequests.set(request, {
    actor,
    identity: Object.freeze({ ...identity }),
  });
}

export function readVerifiedAuthorizationIdentity(
  request: object,
  actor: AuthContext | undefined,
): VerifiedAuthorizationIdentity | undefined {
  const proof = verifiedRequests.get(request);
  return proof?.actor === actor ? proof?.identity : undefined;
}
