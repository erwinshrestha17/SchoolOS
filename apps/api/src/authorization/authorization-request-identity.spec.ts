import { AuthMethod, SecurityDomain } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  recordVerifiedAuthorizationIdentity,
  readVerifiedAuthorizationIdentity,
} from './authorization-request-identity';

describe('Authenticated request identity provenance', () => {
  const actor: AuthContext = {
    userId: 'actor',
    tenantId: 'school',
    tenantSlug: 'school',
    email: null,
    authMethod: AuthMethod.PASSWORD,
    roles: [],
    permissions: [],
  };
  const identity = {
    securityDomain: SecurityDomain.SCHOOL,
    tenantId: 'school',
    userSessionActive: true,
    tenantActive: true,
  };
  it('does not accept an auth object or body-supplied identity as evidence', () => {
    const req = { auth: actor, body: { identity } };
    expect(readVerifiedAuthorizationIdentity(req, actor)).toBeUndefined();
  });
  it('binds immutable live-check facts to the exact request and actor reference', () => {
    const req = { auth: actor };
    recordVerifiedAuthorizationIdentity(req, actor, identity);
    const proof = readVerifiedAuthorizationIdentity(req, actor);
    expect(proof).toEqual(identity);
    expect(Object.isFrozen(proof)).toBe(true);
    expect(
      readVerifiedAuthorizationIdentity({ auth: actor }, actor),
    ).toBeUndefined();
    expect(
      readVerifiedAuthorizationIdentity(req, { ...actor }),
    ).toBeUndefined();
  });
  it('does not retain mutable caller-owned identity facts', () => {
    const req = { auth: actor };
    const facts = { ...identity };
    recordVerifiedAuthorizationIdentity(req, actor, facts);
    facts.tenantId = 'foreign';
    expect(readVerifiedAuthorizationIdentity(req, actor)?.tenantId).toBe(
      'school',
    );
  });
});
