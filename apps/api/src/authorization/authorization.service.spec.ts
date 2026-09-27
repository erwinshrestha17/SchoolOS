import { Logger } from '@nestjs/common';
import { AuthMethod, SecurityDomain } from '@prisma/client';
import {
  canonicalPermissionCatalog,
  getCanonicalPermissionForLegacyKey,
  hasEffectivePermission,
  systemRoleTemplates,
} from '@schoolos/core';
import { AuthorizationService } from './authorization.service';
import {
  AUTHORIZATION_STAGES,
  type AuthorizationContext,
  type PolicyEvaluator,
  type PolicyEvaluation,
} from './authorization.types';

const required = <T>(value: T | null | undefined): T => {
  if (value == null) throw new Error('Incomplete test fixture');
  return value;
};
const schoolContext = (
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext => ({
  actor: {
    userId: 'actor',
    tenantId: 'school',
    tenantSlug: 'school',
    email: 'private@example.invalid',
    authMethod: AuthMethod.PASSWORD,
    securityDomain: SecurityDomain.SCHOOL,
    roles: ['teacher'],
    permissions: ['students:read'],
  },
  identity: {
    securityDomain: SecurityDomain.SCHOOL,
    tenantId: 'school',
    userSessionActive: true,
    tenantActive: true,
  },
  securityDomain: SecurityDomain.SCHOOL,
  trustedTenantId: 'school',
  requestedPermissions: ['students:read'],
  method: 'GET',
  ...overrides,
});
const supportContext = (): AuthorizationContext => {
  const c = schoolContext();
  return {
    ...c,
    actor: {
      ...required(c.actor),
      securityDomain: SecurityDomain.PLATFORM,
      roles: [],
      isSupportOverride: true,
      originalTenantId: 'platform',
      supportOverrideReadOnly: true,
    },
    identity: {
      ...required(c.identity),
      securityDomain: SecurityDomain.PLATFORM,
      supportOverrideApproved: true,
    },
  };
};

describe('AuthorizationService authoritative generic contract', () => {
  const service = new AuthorizationService();
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('allows a valid permission with its canonical identity and a safe immutable decision', async () => {
    const d = await service.evaluate(schoolContext());
    expect(d).toEqual({
      outcome: 'ALLOW',
      reasonCode: 'ALLOWED',
      stage: 'AUDIT',
      policyId: 'authorization.generic',
      canonicalPermission: required(
        getCanonicalPermissionForLegacyKey('students:read'),
      ).code,
    });
    expect(Object.isFrozen(d)).toBe(true);
  });
  it.each([
    ['AUTHENTICATION_REQUIRED', { actor: undefined }],
    ['USER_OR_SESSION_INACTIVE', { identity: undefined }],
    ['PERMISSION_MISSING', { requestedPermissions: ['students:create'] }],
    ['UNKNOWN_PERMISSION', { requestedPermissions: ['students:unknown'] }],
    ['ROLE_MISSING', { requiredRoles: ['principal', 'admin'] }],
    ['TENANT_MISMATCH', { trustedTenantId: 'foreign' }],
    [
      'RESOURCE_TENANT_MISMATCH',
      { resource: { id: 'private', tenantId: 'foreign' } },
    ],
    ['RESOURCE_TENANT_MISMATCH', { resource: { id: 'private' } }],
    [
      'ENTITLEMENT_MISSING',
      { entitlement: { keys: ['students'], evaluate: () => false } },
    ],
    ['POLICY_DENIED', { requestedPermissions: [] }],
    [
      'POLICY_DENIED',
      { requestedPermissions: [], serviceAuthorizationPolicy: 'unknown' },
    ],
  ] as const)('denies %s', async (reasonCode, changes) => {
    expect(await service.evaluate(schoolContext(changes))).toMatchObject({
      outcome: 'DENY',
      reasonCode,
    });
  });
  it('denies inactive sessions and tenants and a mismatched verified identity', async () => {
    for (const [changes, reasonCode] of [
      [{ userSessionActive: false }, 'USER_OR_SESSION_INACTIVE'],
      [{ tenantActive: false }, 'TENANT_INACTIVE'],
      [{ tenantId: 'foreign' }, 'TENANT_MISMATCH'],
    ] as const)
      expect(
        await service.evaluate(
          schoolContext({
            identity: { ...required(schoolContext().identity), ...changes },
          }),
        ),
      ).toMatchObject({ outcome: 'DENY', reasonCode });
  });
  it('accepts role ANY while requiring every requested permission', async () => {
    expect(
      await service.evaluate(
        schoolContext({ requiredRoles: ['principal', 'teacher'] }),
      ),
    ).toMatchObject({ outcome: 'ALLOW' });
    expect(
      await service.evaluate(
        schoolContext({
          requestedPermissions: ['students:read', 'students:create'],
        }),
      ),
    ).toMatchObject({ outcome: 'DENY', reasonCode: 'PERMISSION_MISSING' });
  });
  it('keeps approved service-level authorization as a prerequisite, not a grant or fabricated domain decision', async () => {
    expect(
      await service.evaluate(
        schoolContext({
          requestedPermissions: [],
          serviceAuthorizationPolicy: 'FILE_RESOURCE_ACCESS',
        }),
      ),
    ).toMatchObject({ outcome: 'ALLOW' });
    expect(
      await service.evaluate(
        schoolContext({
          requestedPermissions: ['students:create'],
          serviceAuthorizationPolicy: 'FILE_RESOURCE_ACCESS',
        }),
      ),
    ).toMatchObject({ outcome: 'DENY', reasonCode: 'PERMISSION_MISSING' });
  });
  it('checks entitlement before permission and does not call a denied downstream evaluator', async () => {
    const policy: PolicyEvaluator = {
      id: 'permission.test',
      stage: 'PERMISSION',
      evaluate: jest.fn(() => ({ outcome: 'ALLOW' })),
    };
    expect(
      await service.evaluate(
        schoolContext({
          requestedPermissions: ['students:create'],
          entitlement: { keys: [], evaluate: () => false },
        }),
        [policy],
      ),
    ).toMatchObject({
      reasonCode: 'ENTITLEMENT_MISSING',
      stage: 'ENTITLEMENT',
    });
    expect(policy.evaluate).not.toHaveBeenCalled();
  });
  it('represents all 15 stages and orders same-stage evaluators by stable identifier', async () => {
    const seen: string[] = [];
    const policies: PolicyEvaluator[] = AUTHORIZATION_STAGES.flatMap((stage) =>
      ['z', 'a'].map((id) => ({
        id: `${stage}.${id}`,
        stage,
        evaluate: () => {
          seen.push(`${stage}.${id}`);
          return { outcome: 'NOT_APPLICABLE' };
        },
      })),
    );
    expect(
      await service.evaluate(schoolContext(), policies.reverse()),
    ).toMatchObject({ outcome: 'ALLOW' });
    expect(seen).toEqual(
      AUTHORIZATION_STAGES.flatMap((stage) => [`${stage}.a`, `${stage}.z`]),
    );
  });
  it('short-circuits DENY so ALLOW cannot override it', async () => {
    const later = jest.fn((): PolicyEvaluation => ({ outcome: 'ALLOW' }));
    expect(
      await service.evaluate(schoolContext(), [
        {
          id: 'relationship.a',
          stage: 'RELATIONSHIP',
          evaluate: () => ({ outcome: 'DENY' }),
        },
        { id: 'relationship.z', stage: 'RELATIONSHIP', evaluate: later },
      ]),
    ).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'POLICY_DENIED',
      policyId: 'relationship.a',
    });
    expect(later).not.toHaveBeenCalled();
  });
  it('snapshots evaluator registration so another evaluator cannot move a later denial', async () => {
    const denyPolicy: PolicyEvaluator = {
      id: 'scope.z',
      stage: 'SCOPE',
      evaluate: () => ({ outcome: 'DENY' }),
    };
    const mutation: PolicyEvaluator = {
      id: 'scope.a',
      stage: 'SCOPE',
      evaluate: () => {
        Object.assign(denyPolicy, { stage: 'AUTHENTICATION', id: 'mutated' });
        return { outcome: 'ALLOW' };
      },
    };
    expect(
      await service.evaluate(schoolContext(), [denyPolicy, mutation]),
    ).toMatchObject({ outcome: 'DENY', stage: 'SCOPE', policyId: 'scope.z' });
  });
  it('freezes entitlement checks against mutation by an earlier evaluator', async () => {
    const entitlement = { keys: ['students'], evaluate: () => false };
    const d = await service.evaluate(schoolContext({ entitlement }), [
      {
        id: 'gate.mutate',
        stage: 'AUTHENTICATION',
        evaluate: (context) => {
          Object.assign(context.entitlement ?? {}, { evaluate: () => true });
          return { outcome: 'ALLOW' };
        },
      },
    ]);
    expect(d).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
    });
    expect(entitlement.evaluate()).toBe(false);
  });

  it('freezes context authority against in-process evaluator mutation', async () => {
    const c = schoolContext();
    const d = await service.evaluate(c, [
      {
        id: 'authority.mutate',
        stage: 'AUTHENTICATION',
        evaluate: (context) => {
          required(context.actor).permissions.push('students:create');
          return { outcome: 'ALLOW' };
        },
      },
    ]);
    expect(d).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
    });
    expect(required(c.actor).permissions).toEqual(['students:read']);
  });
  it('fails closed and logs only safe code/stage/policy when an evaluator throws private data', async () => {
    const secret = 'private@example.invalid SELECT medical_data stack-private';
    const d = await service.evaluate(
      schoolContext({
        resource: { id: secret, tenantId: 'school' },
        routeAction: secret,
        requestId: secret,
      }),
      [
        {
          id: 'scope.check',
          stage: 'SCOPE',
          evaluate: () => {
            throw new Error(secret);
          },
        },
      ],
    );
    expect(d).toEqual({
      outcome: 'DENY',
      reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
      stage: 'SCOPE',
      policyId: 'scope.check',
    });
    expect(
      JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls),
    ).not.toContain(secret);
    expect(JSON.stringify(d)).not.toContain(secret);
  });
  it.each(['REQUIRE_APPROVAL', 'REQUIRE_STEP_UP', undefined])(
    'does not enforce future or malformed evaluator outcome %s',
    async (outcome) => {
      expect(
        await service.evaluate(schoolContext(), [
          {
            id: 'future.check',
            stage: 'APPROVAL_STEP_UP',
            evaluate: () => ({ outcome }) as PolicyEvaluation,
          },
        ]),
      ).toMatchObject({
        outcome: 'DENY',
        reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
      });
    },
  );
  it.each(['ALLOWED', 'PRIVATE_SQL'])(
    'rejects invalid denial reason %s',
    async (reasonCode) => {
      expect(
        await service.evaluate(schoolContext(), [
          {
            id: 'bad.reason',
            stage: 'SCOPE',
            evaluate: () =>
              ({ outcome: 'DENY', reasonCode }) as PolicyEvaluation,
          },
        ]),
      ).toMatchObject({ reasonCode: 'AUTHORIZATION_EVALUATION_ERROR' });
    },
  );
  it('rejects duplicate, invalid and reserved evaluator registrations', async () => {
    for (const ids of [
      ['duplicate', 'duplicate'],
      ['builtin.SCOPE'],
      ['unsafe/private'],
    ]) {
      expect(
        await service.evaluate(
          schoolContext(),
          ids.map((id) => ({
            id,
            stage: 'SCOPE',
            evaluate: () => ({ outcome: 'ALLOW' }),
          })),
        ),
      ).toMatchObject({
        outcome: 'DENY',
        reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
      });
    }
  });
  it('keeps every support boundary and forbids aliases, writes, roles and metadata-less reads', async () => {
    expect(await service.evaluate(supportContext())).toMatchObject({
      outcome: 'ALLOW',
    });
    const c = supportContext();
    for (const changes of [
      { method: 'POST' },
      { requestedPermissions: [] },
      { requiredRoles: ['admin'] },
      { actor: { ...required(c.actor), supportOverrideReadOnly: false } },
      { actor: { ...required(c.actor), originalTenantId: 'school' } },
      { identity: { ...required(c.identity), supportOverrideApproved: false } },
    ])
      expect(await service.evaluate({ ...c, ...changes })).toMatchObject({
        outcome: 'DENY',
        reasonCode: 'POLICY_DENIED',
      });
    expect(
      await service.evaluate({
        ...c,
        requestedPermissions: ['accounting:exports:create'],
        actor: { ...required(c.actor), permissions: ['reports:export'] },
      }),
    ).toMatchObject({ outcome: 'DENY', reasonCode: 'PERMISSION_MISSING' });
  });
  it('separates SCHOOL/Platform roles and permissions, including forged mixed-domain actors', async () => {
    const c = schoolContext();
    for (const changes of [
      { securityDomain: SecurityDomain.PLATFORM },
      { requestedPermissions: ['platform:dashboard:read'] },
      { actor: { ...required(c.actor), roles: ['platform_super_admin'] } },
      {
        actor: {
          ...required(c.actor),
          securityDomain: SecurityDomain.PLATFORM,
        },
      },
      {
        actor: {
          ...required(c.actor),
          securityDomain: SecurityDomain.PLATFORM,
        },
        identity: {
          ...required(c.identity),
          securityDomain: SecurityDomain.PLATFORM,
        },
      },
    ])
      expect(await service.evaluate({ ...c, ...changes })).toMatchObject({
        outcome: 'DENY',
        reasonCode: 'SECURITY_DOMAIN_MISMATCH',
      });
  });

  it.each(
    systemRoleTemplates.map((template) => [template.key, template] as const),
  )(
    'preserves every legacy ALLOW/DENY and canonical equivalent for %s',
    async (_key, template) => {
      const domain = template.securityDomain as SecurityDomain;
      const actor = {
        ...required(schoolContext().actor),
        roles: [template.key],
        securityDomain: domain,
        permissions: [...template.permissions],
      };
      for (const definition of canonicalPermissionCatalog) {
        const sameDomain =
          (definition.module === 'platform') ===
          (domain === SecurityDomain.PLATFORM);
        const expected =
          sameDomain &&
          (domain === SecurityDomain.PLATFORM
            ? actor.permissions.includes(definition.legacyKey)
            : hasEffectivePermission(actor.permissions, definition.legacyKey));
        for (const requested of [definition.legacyKey, definition.code]) {
          const d = await service.evaluate({
            ...schoolContext(),
            actor,
            identity: {
              ...required(schoolContext().identity),
              securityDomain: domain,
            },
            securityDomain: domain,
            requestedPermissions: [requested],
          });
          expect([template.key, requested, d.outcome]).toEqual([
            template.key,
            requested,
            expected ? 'ALLOW' : 'DENY',
          ]);
        }
      }
    },
  );
  it('normalizes canonical grants and retains legacy administrative alias semantics', async () => {
    const c = schoolContext();
    const canonical = required(
      getCanonicalPermissionForLegacyKey('students:read'),
    ).code;
    expect(
      await service.evaluate({
        ...c,
        actor: { ...required(c.actor), permissions: [canonical] },
      }),
    ).toMatchObject({ outcome: 'ALLOW' });
    expect(
      await service.evaluate({
        ...c,
        actor: { ...required(c.actor), permissions: ['payroll:manage'] },
        requestedPermissions: ['payroll:payslip:generate'],
      }),
    ).toMatchObject({ outcome: 'ALLOW' });
  });
});
