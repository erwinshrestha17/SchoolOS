import { studentResourceScope } from './student-resource-scope';
import { Logger } from '@nestjs/common';
import { AuthMethod, SecurityDomain } from '@prisma/client';
import { AuthorizationService } from '../authorization.service';
import type { AuthorizationContext } from '../authorization.types';
import { grantAllows, scopeIsActive, scopesMatch } from './scope-resolver';
import { validateScopeWrites } from './scope-write';
import type {
  ScopeGrant,
  SchoolScopeType,
  RoleAccessGrant,
} from './scope.types';
import { assertCompleteTenantBatch } from '../resource-ownership';

const scope = (scopeType: SchoolScopeType, scopeId: string): ScopeGrant => ({
  scopeType,
  scopeId,
  effectiveFrom: '2020-01-01T00:00:00Z',
  expiresAt: null,
  revokedAt: null,
});
const grant = (scopes: ScopeGrant[]): RoleAccessGrant => ({
  assignmentId: 'assignment',
  tenantId: 'school',
  role: 'teacher',
  permissions: ['students:read'],
  scopes,
});
const context = (scopes: ScopeGrant[]): AuthorizationContext => ({
  actor: {
    userId: 'actor',
    tenantId: 'school',
    tenantSlug: 'school',
    authMethod: AuthMethod.PASSWORD,
    email: null,
    roles: ['teacher'],
    permissions: [],
    accessGrants: [grant(scopes)],
  },
  identity: {
    tenantId: 'school',
    tenantActive: true,
    securityDomain: SecurityDomain.SCHOOL,
    userSessionActive: true,
  },
  securityDomain: SecurityDomain.SCHOOL,
  trustedTenantId: 'school',
  requestedPermissions: ['students:read'],
});

describe('Phase 1C typed scope contract', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses inclusive effectiveFrom and exclusive expiry at exact UTC boundaries', () => {
    const value = {
      ...scope('CLASS', 'class'),
      effectiveFrom: '2026-01-01T00:00:00+05:45',
      expiresAt: '2026-01-02T00:00:00+05:45',
    };
    expect(scopeIsActive(value, Date.parse(value.effectiveFrom) - 1)).toBe(
      false,
    );
    expect(scopeIsActive(value, Date.parse(value.effectiveFrom))).toBe(true);
    expect(scopeIsActive(value, Date.parse(value.expiresAt))).toBe(false);
    expect(
      scopeIsActive(
        { ...value, revokedAt: value.effectiveFrom },
        Date.parse(value.effectiveFrom),
      ),
    ).toBe(false);
    expect(scopeIsActive({ ...value, effectiveFrom: 'bad' })).toBe(false);
  });

  it('requires all dimensions, unions only grants of the same type and rejects missing context', () => {
    const scopes = [
      scope('CLASS', 'class'),
      scope('SECTION', 'one'),
      scope('SECTION', 'two'),
    ];
    expect(
      scopesMatch(scopes, 'school', { CLASS: 'class', SECTION: 'two' }),
    ).toBe(true);
    expect(
      scopesMatch(scopes, 'school', { CLASS: 'foreign', SECTION: 'two' }),
    ).toBe(false);
    expect(scopesMatch(scopes, 'school', { CLASS: 'class' })).toBe(false);
    expect(scopesMatch(scopes, 'school')).toBe(false);
  });

  it('does not drop an expired restrictive dimension or let TENANT override one', () => {
    expect(
      scopesMatch(
        [
          scope('CLASS', 'class'),
          {
            ...scope('ACADEMIC_YEAR', 'old'),
            expiresAt: '2021-01-01T00:00:00Z',
          },
        ],
        'school',
        { CLASS: 'class', ACADEMIC_YEAR: 'old' },
      ),
    ).toBe(false);
    expect(
      scopesMatch(
        [scope('TENANT', 'school'), scope('SECTION', 'restricted')],
        'school',
      ),
    ).toBe(false);
    expect(scopesMatch([scope('TENANT', 'foreign')], 'school')).toBe(false);
  });

  it('does not carry academic-year scope into the current rollover year', () => {
    const resource = studentResourceScope({
      id: 'student',
      tenantId: 'school',
      classId: 'class',
      sectionId: 'section',
      enrollments: [
        {
          academicYearId: 'old',
          classId: 'class',
          sectionId: 'section',
          status: 'ACTIVE',
          effectiveFrom: new Date(0),
          effectiveUntil: null,
          academicYear: { isCurrent: false },
        },
        {
          academicYearId: 'current',
          classId: 'class',
          sectionId: 'section',
          status: 'ACTIVE',
          effectiveFrom: new Date(0),
          effectiveUntil: null,
          academicYear: { isCurrent: true },
        },
      ],
    });
    expect(resource.ACADEMIC_YEAR).toBe('current');
    expect(
      scopesMatch([scope('ACADEMIC_YEAR', 'old')], 'school', resource),
    ).toBe(false);
    expect(
      scopesMatch([scope('ACADEMIC_YEAR', 'current')], 'school', resource),
    ).toBe(true);
  });

  it('subject authority requires the exact persisted subject dimension', () => {
    expect(
      scopesMatch([scope('SUBJECT', 'subject-class-one')], 'school', {
        CLASS: 'class-one',
      }),
    ).toBe(false);
    expect(
      scopesMatch([scope('SUBJECT', 'subject-class-one')], 'school', {
        SUBJECT: 'subject-class-two',
      }),
    ).toBe(false);
    expect(
      scopesMatch([scope('SUBJECT', 'subject-class-one')], 'school', {
        SUBJECT: 'subject-class-one',
        CLASS: 'class-one',
      }),
    ).toBe(true);
  });

  it('respects catalog scope types and never infers export from read', () => {
    expect(
      grantAllows(grant([scope('CLASS', 'class')]), 'students:read', 'school', {
        CLASS: 'class',
      }),
    ).toBe(true);
    expect(
      grantAllows(
        grant([scope('CLASS', 'class')]),
        'students:export',
        'school',
        { CLASS: 'class' },
      ),
    ).toBe(false);
    expect(
      grantAllows(
        {
          ...grant([scope('STUDENT', 'child')]),
          permissions: ['roles:assign'],
        },
        'roles:assign',
        'school',
        { STUDENT: 'child' },
      ),
    ).toBe(false);
    expect(
      grantAllows(
        grant([scope('TENANT', 'school')]),
        'unknown:action',
        'school',
      ),
    ).toBe(false);
  });

  it('central kernel denies scoped authority on an unmigrated route but allows exact resource scope', async () => {
    const auth = new AuthorizationService();
    const ctx = context([scope('SECTION', 'one')]);
    expect(await auth.evaluate(ctx)).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'SCOPE_MISMATCH',
      stage: 'SCOPE',
    });
    expect(
      await auth.evaluate({
        ...ctx,
        resourceLookup: async () => ({
          id: 'child',
          tenantId: 'school',
          scope: { SECTION: 'one' },
        }),
      }),
    ).toMatchObject({ outcome: 'ALLOW' });
    expect(
      await auth.evaluate({
        ...ctx,
        resourceLookup: async () => ({
          id: 'child',
          tenantId: 'school',
          scope: { SECTION: 'other' },
        }),
      }),
    ).toMatchObject({ outcome: 'DENY', reasonCode: 'SCOPE_MISMATCH' });
  });

  it('does not look up ownership before authentication and safely denies missing/foreign objects', async () => {
    const lookup = jest.fn(async () => null);
    const auth = new AuthorizationService();
    expect(
      await auth.evaluate({
        ...context([scope('TENANT', 'school')]),
        actor: null,
        resourceLookup: lookup,
      }),
    ).toMatchObject({ outcome: 'DENY', stage: 'AUTHENTICATION' });
    expect(lookup).not.toHaveBeenCalled();
    expect(
      await auth.evaluate({
        ...context([scope('TENANT', 'school')]),
        resourceLookup: lookup,
      }),
    ).toMatchObject({ outcome: 'DENY', reasonCode: 'RESOURCE_NOT_FOUND' });
    expect(
      await auth.evaluate({
        ...context([scope('TENANT', 'school')]),
        resourceLookup: async () => ({
          id: 'foreign',
          tenantId: 'foreign',
          scope: { TENANT: 'school' },
        }),
      }),
    ).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'RESOURCE_TENANT_MISMATCH',
    });
  });

  it('freezes grant arrays and scope dates before extension evaluators run', async () => {
    const auth = new AuthorizationService();
    expect(
      await auth.evaluate(context([scope('SECTION', 'one')]), [
        {
          id: 'try.mutate',
          stage: 'HARD_RESTRICTION',
          evaluate: (ctx) => {
            (ctx.actor?.accessGrants as RoleAccessGrant[]).push(
              grant([scope('TENANT', 'school')]),
            );
            return { outcome: 'ALLOW' };
          },
        },
      ]),
    ).toMatchObject({
      outcome: 'DENY',
      reasonCode: 'AUTHORIZATION_EVALUATION_ERROR',
    });
  });

  it('denies ambiguous writes, foreign targets, unsupported models and conflicting parent dimensions', async () => {
    const db = {
      class: { findFirst: jest.fn(async () => ({ id: 'class' })) },
      section: {
        findFirst: jest.fn(async () => ({ id: 'section', classId: 'other' })),
      },
    };
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [{ scopeId: 'class' }],
      }),
    ).rejects.toThrow('Explicit scopeType');
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [{ scopeType: 'BRANCH', scopeId: 'branch' }],
      }),
    ).rejects.toThrow('Scope target not found');
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [{ scopeType: 'TENANT', scopeId: 'foreign' }],
      }),
    ).rejects.toThrow('Scope target not found');
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [
          { scopeType: 'TENANT', scopeId: 'school' },
          { scopeType: 'CLASS', scopeId: 'class' },
        ],
      }),
    ).rejects.toThrow('cannot override');
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [
          { scopeType: 'CLASS', scopeId: 'class' },
          { scopeType: 'SECTION', scopeId: 'section' },
        ],
      }),
    ).rejects.toThrow('Conflicting academic scope');
    await expect(
      validateScopeWrites(db as never, 'school', ['role'], {
        role: [
          {
            scopeType: 'TENANT',
            scopeId: 'school',
            effectiveFrom: '2026-01-01',
          },
        ],
      }),
    ).rejects.toThrow('timezone');
  });

  it('validates the whole batch, including duplicates and tenant provenance', () => {
    expect(
      assertCompleteTenantBatch(
        'school',
        ['one', 'two'],
        [
          { id: 'one', tenantId: 'school' },
          { id: 'two', tenantId: 'school' },
        ],
      ),
    ).toBe(true);
    expect(
      assertCompleteTenantBatch(
        'school',
        ['one', 'two'],
        [{ id: 'one', tenantId: 'school' }],
      ),
    ).toBe(false);
    expect(
      assertCompleteTenantBatch(
        'school',
        ['one'],
        [{ id: 'one', tenantId: 'foreign' }],
      ),
    ).toBe(false);
    expect(
      assertCompleteTenantBatch(
        'school',
        ['one', 'one'],
        [{ id: 'one', tenantId: 'school' }],
      ),
    ).toBe(false);
  });
});
