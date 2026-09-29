import type { AuthContext } from '../../auth/auth.types';
import {
  actorHoldsPermissionFor,
  decideSections,
  omitUnauthorizedKeys,
} from './sensitive-projection';

const schoolActor = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  roles: ['admin'],
  permissions: ['students:read'],
} as unknown as AuthContext;

describe('sensitive projection primitive (Phase 3B)', () => {
  it('denies a section whose rule throws or returns a non-boolean', () => {
    const decisions = decideSections({
      allowed: () => true,
      denied: () => false,
      throws: () => {
        throw new Error('policy lookup failed');
      },
      truthy: () => 'yes' as unknown as boolean,
    });

    expect(decisions).toEqual({
      allowed: true,
      denied: false,
      throws: false,
      truthy: false,
    });
    expect(Object.isFrozen(decisions)).toBe(true);
  });

  it('omits keys bound to denied sections and keeps unbound keys', () => {
    const projected = omitUnauthorizedKeys(
      { id: 's-1', medical: 'private', invoices: [1], name: 'Aarav' },
      { medical: 'health', invoices: 'fees' },
      { health: false, fees: true },
    );

    expect(projected).toEqual({ id: 's-1', invoices: [1], name: 'Aarav' });
    expect(projected).not.toHaveProperty('medical');
  });

  it('treats a bound key with an undeclared section as denied', () => {
    const projected = omitUnauthorizedKeys(
      { id: 's-1', secret: 'x' },
      { secret: 'unknownSection' },
      {} as Readonly<Record<'unknownSection', boolean>>,
    );

    expect(projected).toEqual({ id: 's-1' });
  });

  it('does not treat prototype keys as section bindings', () => {
    const projected = omitUnauthorizedKeys(
      { toString: 'kept', id: 's-1' },
      {},
      {},
    );

    expect(projected).toEqual({ toString: 'kept', id: 's-1' });
  });

  it('never releases projection permissions to Platform or support identities', () => {
    expect(actorHoldsPermissionFor(schoolActor, 'students:read')).toBe(true);
    expect(actorHoldsPermissionFor(schoolActor, 'students:update')).toBe(false);
    expect(
      actorHoldsPermissionFor(
        { ...schoolActor, isSupportOverride: true } as AuthContext,
        'students:read',
      ),
    ).toBe(false);
    expect(
      actorHoldsPermissionFor(
        { ...schoolActor, securityDomain: 'PLATFORM' } as AuthContext,
        'students:read',
      ),
    ).toBe(false);
    expect(actorHoldsPermissionFor(undefined, 'students:read')).toBe(false);
  });

  it('honours resource-scoped grants only for the matching resource', () => {
    const scoped = {
      ...schoolActor,
      permissions: [],
      accessGrants: [
        {
          role: 'class_coordinator',
          tenantId: 'tenant-1',
          permissions: ['students:read'],
          scopes: [
            {
              scopeType: 'CLASS',
              scopeId: 'class-1',
              effectiveFrom: new Date('2020-01-01').toISOString(),
              expiresAt: null,
              revokedAt: null,
            },
          ],
        },
      ],
    } as unknown as AuthContext;

    expect(
      actorHoldsPermissionFor(scoped, 'students:read', {
        TENANT: 'tenant-1',
        CLASS: 'class-1',
      }),
    ).toBe(true);
    expect(
      actorHoldsPermissionFor(scoped, 'students:read', {
        TENANT: 'tenant-1',
        CLASS: 'class-2',
      }),
    ).toBe(false);
    expect(actorHoldsPermissionFor(scoped, 'students:read')).toBe(false);
  });
});
