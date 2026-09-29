import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  authorizationCacheScope,
  resourceAccess,
} from '../lib/resource-authorization.ts';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const projection = {
  contractVersion: 1,
  allowedActions: ['UPDATE_PROFILE'],
  capabilities: {
    UPDATE_PROFILE: true,
    MANAGE_LIFECYCLE: false,
    MANAGE_DOCUMENTS: false,
  },
  authorizedSections: ['identity', 'attendance'],
  lifecycleState: 'ACTIVE',
  entitlementState: { module: 'students', state: 'ENABLED' },
};

describe('Phase 3A resource authorization consumer', () => {
  it('allows only what the server projection allows', () => {
    const access = resourceAccess(projection);
    assert.equal(access.can('UPDATE_PROFILE'), true);
    assert.equal(access.can('MANAGE_LIFECYCLE'), false);
    assert.equal(access.sees('attendance'), true);
    assert.equal(access.sees('health'), false);
    assert.equal(access.sees('fees'), false);
  });

  it('denies everything when the projection is missing (old API) or malformed', () => {
    for (const value of [
      undefined,
      null,
      {},
      { ...projection, contractVersion: 2 },
    ]) {
      const access = resourceAccess(value);
      assert.equal(access.can('UPDATE_PROFILE'), false);
      assert.equal(access.sees('identity'), false);
    }
  });

  it('denies everything when the entitlement is not ENABLED', () => {
    const access = resourceAccess({
      ...projection,
      entitlementState: { module: 'students', state: 'UNKNOWN' },
    });
    assert.equal(access.can('UPDATE_PROFILE'), false);
    assert.equal(access.sees('identity'), false);
  });

  it('partitions cached projections by identity and authority', () => {
    const session = {
      tenant: { id: 'tenant-1' },
      user: {
        id: 'user-1',
        isSupportOverride: false,
        roles: ['teacher'],
        permissions: ['students:read', 'attendance:read'],
      },
    };
    const base = authorizationCacheScope(session);
    const reordered = authorizationCacheScope({
      ...session,
      user: {
        ...session.user,
        permissions: ['attendance:read', 'students:read'],
      },
    });
    assert.equal(base, reordered);
    for (const changed of [
      { ...session, tenant: { id: 'tenant-2' } },
      { ...session, user: { ...session.user, id: 'user-2' } },
      { ...session, user: { ...session.user, isSupportOverride: true } },
      { ...session, user: { ...session.user, roles: ['admin'] } },
      {
        ...session,
        user: { ...session.user, permissions: ['students:read'] },
      },
    ])
      assert.notEqual(authorizationCacheScope(changed), base);
    assert.equal(authorizationCacheScope(null), 'anonymous');
  });

  it('student detail page derives tabs and actions from the server projection', () => {
    const source = readFileSync(
      join(webRoot, 'components/students/student-detail-page.tsx'),
      'utf8',
    );
    assert.match(source, /resourceAccess(<[^>]*>)?\(/);
    assert.match(source, /authorizationCacheScope\(/);
    // No client-held permission list decides Student profile visibility.
    assert.doesNotMatch(source, /hasPermissions\(/);
  });
});
