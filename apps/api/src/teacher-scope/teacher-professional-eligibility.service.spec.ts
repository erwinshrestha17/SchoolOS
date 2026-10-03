/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { TeacherProfessionalEligibilityService } from './teacher-professional-eligibility.service';

/**
 * Phase 5M required tests. The fake mirrors only the query filters the
 * service relies on (tenant, status, effective window) so each case proves a
 * specific fact is required rather than that a mock returned null.
 */
type Row = Record<string, any>;

const NOW = new Date();
const PAST = new Date(NOW.getTime() - 86_400_000 * 365);
const SOON = new Date(NOW.getTime() + 86_400_000 * 30);
const EXPIRED = new Date(NOW.getTime() - 86_400_000);

const EMPLOYMENT: Row = {
  id: 'e1',
  tenantId: 't1',
  staffId: 's1',
  status: 'VERIFIED',
  verifiedAt: PAST,
  employmentType: 'PERMANENT',
  postCategoryCode: 'TEACHER',
  schoolTypeCode: 'INSTITUTIONAL',
  localLevelId: null,
  localLevel: null,
  effectiveFrom: PAST,
  effectiveTo: null,
};

const POLICY: Row = {
  id: 'pol-v3',
  policyKey: 'nepal.teacher.licence',
  kind: 'TEACHER_PROFESSIONAL_ELIGIBILITY',
  reviewStatus: 'APPROVED',
  scope: 'NATIONAL',
  version: 3,
  effectiveFrom: PAST,
  effectiveTo: null,
  isMandatoryBaseline: true,
  requiresQualification: true,
  requiresLicence: true,
  schoolTypeCode: null,
  employmentType: null,
  postCategoryCode: null,
  classLevelMin: null,
  classLevelMax: null,
  subjectCode: null,
  localLevelId: null,
};

function activeWindow(row: Row, from: string, to: string) {
  return row[from] <= NOW && (row[to] === null || row[to] > NOW);
}

function world(overrides: Partial<Record<string, Row[]>> = {}) {
  const data: Record<string, Row[]> = {
    staff: [{ id: 's1', tenantId: 't1', status: 'ACTIVE', joiningDate: PAST }],
    employment: [EMPLOYMENT],
    profile: [
      {
        id: 'p1',
        tenantId: 't1',
        staffId: 's1',
        status: 'ACTIVE',
        effectiveFrom: PAST,
        effectiveTo: null,
      },
    ],
    classes: [{ id: 'c1', tenantId: 't1', level: 9 }],
    policies: [POLICY],
    qualifications: [
      {
        id: 'q1',
        tenantId: 't1',
        profileId: 'p1',
        status: 'VERIFIED',
        validFrom: PAST,
        validUntil: null,
      },
    ],
    licences: [
      {
        id: 'l1',
        tenantId: 't1',
        profileId: 'p1',
        status: 'VERIFIED',
        validFrom: PAST,
        validUntil: SOON,
      },
    ],
    ...overrides,
  };
  const created: Row[] = [];
  const inIds = (value: any, id: string) => value?.in?.includes(id) ?? false;
  const prisma = {
    staff: {
      findMany: jest.fn(({ where }) =>
        data.staff.filter(
          (r) =>
            inIds(where.id, r.id) &&
            r.tenantId === where.tenantId &&
            r.status === 'ACTIVE',
        ),
      ),
    },
    staffEmployment: {
      findMany: jest.fn(({ where }) => {
        // The service must only ask for authoritative (verified/ended,
        // reviewed) employment; the fake enforces what it asked for.
        expect(where.verifiedAt).toEqual({ not: null });
        return data.employment.filter(
          (r) =>
            r.tenantId === where.tenantId &&
            inIds(where.staffId, r.staffId) &&
            where.status.in.includes(r.status) &&
            r.verifiedAt !== null &&
            activeWindow(r, 'effectiveFrom', 'effectiveTo'),
        );
      }),
    },
    teacherProfile: {
      findMany: jest.fn(({ where }) =>
        data.profile.filter(
          (r) =>
            r.tenantId === where.tenantId &&
            inIds(where.staffId, r.staffId) &&
            r.status === 'ACTIVE' &&
            activeWindow(r, 'effectiveFrom', 'effectiveTo'),
        ),
      ),
    },
    class: {
      findMany: jest.fn(({ where }) =>
        data.classes.filter(
          (r) => inIds(where.id, r.id) && r.tenantId === where.tenantId,
        ),
      ),
    },
    subject: { findMany: jest.fn(() => []) },
    nepalHrPolicyVersion: {
      findMany: jest.fn(() =>
        data.policies.filter(
          (r) =>
            r.reviewStatus === 'APPROVED' &&
            activeWindow(r, 'effectiveFrom', 'effectiveTo'),
        ),
      ),
    },
    teacherQualificationEvidence: {
      findMany: jest.fn(({ where }) =>
        data.qualifications
          .filter(
            (r) =>
              r.tenantId === where.tenantId &&
              inIds(where.profileId, r.profileId),
          )
          // Real rows always carry the nullable scope columns.
          .map((r) => ({ subjectCode: null, levelCode: null, ...r })),
      ),
    },
    teachingLicenceEvidence: {
      findMany: jest.fn(({ where }) =>
        data.licences
          .filter(
            (r) =>
              r.tenantId === where.tenantId &&
              inIds(where.profileId, r.profileId),
          )
          // Real rows always carry the nullable scope columns.
          .map((r) => ({ subjectCode: null, levelCode: null, ...r })),
      ),
    },
    teacherEligibilityAssessment: {
      create: jest.fn(({ data: row }) => {
        created.push(row);
        return { id: `a${String(created.length)}` };
      }),
    },
  };
  return {
    service: new TeacherProfessionalEligibilityService(prisma as any),
    prisma,
    created,
  };
}

const ctx = { tenantId: 't1', staffId: 's1', classId: 'c1', actorId: 'u1' };

async function reasonOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'NO_REJECTION';
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    return ((error as ConflictException).getResponse() as any).reason;
  }
}

describe('TeacherProfessionalEligibilityService (Phase 5M)', () => {
  it('persists an ELIGIBLE snapshot that retains the policy version and evidence used', async () => {
    const { service, created } = world();
    await expect(service.preflightAssignment(ctx)).resolves.toBe('a1');
    expect(created[0]).toMatchObject({
      outcome: 'ELIGIBLE',
      reasonCode: 'POLICY_REQUIREMENTS_SATISFIED',
      policyVersionId: 'pol-v3',
      employmentId: 'e1',
      qualificationId: 'q1',
      licenceId: 'l1',
      evaluatedById: 'u1',
    });
    // The decision expires no later than the earliest evidence expiry.
    expect(created[0].validUntil).toEqual(SOON);
  });

  it('a teacher role alone (no employment, profile or evidence) does not satisfy preflight', async () => {
    const { service, created } = world({
      employment: [],
      profile: [],
      qualifications: [],
      licences: [],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'EMPLOYMENT_UNVERIFIED',
    );
    expect(created).toHaveLength(0);
  });

  it('pending (unverified) employment is not authoritative', async () => {
    const { service } = world({
      employment: [{ ...EMPLOYMENT, status: 'PENDING' }],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'EMPLOYMENT_UNVERIFIED',
    );
  });

  it('ended employment blocks new assignments', async () => {
    const { service } = world({
      employment: [{ ...EMPLOYMENT, effectiveTo: EXPIRED }],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'EMPLOYMENT_UNVERIFIED',
    );
  });

  it('missing teacher profile is distinct from missing employment', async () => {
    const { service } = world({ profile: [] });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'TEACHER_PROFILE_MISSING',
    );
  });

  it('uploaded but unverified qualification is not treated as verified', async () => {
    const { service, created } = world({
      qualifications: [
        {
          id: 'q1',
          tenantId: 't1',
          profileId: 'p1',
          status: 'PENDING',
          validFrom: PAST,
          validUntil: null,
        },
      ],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'QUALIFICATION_UNVERIFIED',
    );
    expect(created[0]).toMatchObject({
      outcome: 'INELIGIBLE',
      reasonCode: 'QUALIFICATION_UNVERIFIED',
      policyVersionId: 'pol-v3',
    });
  });

  it('expired teaching licence blocks new authoritative assignment', async () => {
    const { service } = world({
      licences: [
        {
          id: 'l1',
          tenantId: 't1',
          profileId: 'p1',
          status: 'VERIFIED',
          validFrom: PAST,
          validUntil: EXPIRED,
        },
      ],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'TEACHING_LICENCE_UNVERIFIED',
    );
  });

  it('revoked teaching licence blocks new authoritative assignment', async () => {
    const { service } = world({
      licences: [
        {
          id: 'l1',
          tenantId: 't1',
          profileId: 'p1',
          status: 'REVOKED',
          validFrom: PAST,
          validUntil: null,
        },
      ],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'TEACHING_LICENCE_UNVERIFIED',
    );
  });

  it('no approved policy means no eligibility (never defaults to allowed)', async () => {
    const { service } = world({ policies: [] });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'TEACHER_POLICY_UNAVAILABLE',
    );
  });

  it('licence requirement follows policy: not required means no licence needed', async () => {
    const { service } = world({
      policies: [
        {
          ...POLICY,
          id: 'pol-basic',
          policyKey: 'school.basic',
          version: 1,
          isMandatoryBaseline: false,
          requiresLicence: false,
        },
      ],
      licences: [],
    });
    await expect(service.preflightAssignment(ctx)).resolves.toBe('a1');
  });

  describe('projectEligibility', () => {
    it('returns the same outcome without persisting a decision', async () => {
      const { service, created } = world({ licences: [] });
      const projection = await service.projectEligibility(ctx);
      expect(projection).toMatchObject({
        outcome: 'INELIGIBLE',
        reasonCode: 'TEACHING_LICENCE_UNVERIFIED',
        policyVersionId: 'pol-v3',
        persisted: false,
      });
      expect(created).toHaveLength(0);
    });

    it('turns early rejections into an INELIGIBLE projection with a reason code', async () => {
      const { service } = world({ employment: [] });
      await expect(service.projectEligibility(ctx)).resolves.toMatchObject({
        outcome: 'INELIGIBLE',
        reasonCode: 'EMPLOYMENT_UNVERIFIED',
        employmentId: null,
      });
    });

    it('reports ELIGIBLE with the evidence ids used', async () => {
      const { service } = world();
      await expect(service.projectEligibility(ctx)).resolves.toMatchObject({
        outcome: 'ELIGIBLE',
        qualificationId: 'q1',
        licenceId: 'l1',
      });
    });
  });
});

describe('Phase 7.10 employment window and batch equivalence', () => {
  const endedInFuture: Row = {
    ...EMPLOYMENT,
    status: 'ENDED',
    effectiveTo: SOON,
  };

  it('an ended employment still counts until its end date', async () => {
    const { service } = world({ employment: [endedInFuture] });
    await expect(service.preflightAssignment(ctx)).resolves.toBe('a1');
  });

  it('an ended employment whose end date has passed does not count', async () => {
    const { service } = world({
      employment: [{ ...endedInFuture, effectiveTo: EXPIRED }],
    });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'EMPLOYMENT_UNVERIFIED',
    );
  });

  it.each([
    ['pending', { status: 'PENDING', verifiedAt: null }],
    ['rejected', { status: 'REJECTED', verifiedAt: PAST }],
    ['ended but never verified', { status: 'ENDED', verifiedAt: null }],
  ])('%s employment is never authoritative', async (_label, patch) => {
    const { service } = world({ employment: [{ ...EMPLOYMENT, ...patch }] });
    expect(await reasonOf(service.preflightAssignment(ctx))).toBe(
      'EMPLOYMENT_UNVERIFIED',
    );
  });

  const scenarios: [string, Partial<Record<string, Row[]>>][] = [
    ['eligible', {}],
    ['no employment', { employment: [] }],
    ['no profile', { profile: [] }],
    ['no policy', { policies: [] }],
    ['no licence', { licences: [] }],
    ['no qualification', { qualifications: [] }],
    ['inactive staff', { staff: [] }],
    ['ended in future', { employment: [endedInFuture] }],
    [
      'expired licence',
      {
        licences: [
          {
            id: 'l1',
            tenantId: 't1',
            profileId: 'p1',
            status: 'VERIFIED',
            validFrom: PAST,
            validUntil: EXPIRED,
          },
        ],
      },
    ],
    [
      'pending licence',
      {
        licences: [
          {
            id: 'l1',
            tenantId: 't1',
            profileId: 'p1',
            status: 'PENDING',
            validFrom: PAST,
            validUntil: null,
          },
        ],
      },
    ],
  ];

  it.each(scenarios)(
    'batch evaluation agrees with the single projection: %s',
    async (_label, overrides) => {
      const { service } = world(overrides);
      const single = await service.projectEligibility({
        tenantId: 't1',
        staffId: 's1',
        classId: 'c1',
      });
      const batch = await service.evaluateMany({
        tenantId: 't1',
        resources: [{ staffId: 's1', classId: 'c1', subjectId: null }],
      });
      const decision = batch.get('s1|c1|');
      expect(decision).toBeDefined();
      expect(decision?.outcome).toBe(single.outcome);
      expect(decision?.reasonCode).toBe(single.reasonCode);
      expect(decision?.qualificationId).toBe(single.qualificationId);
      expect(decision?.licenceId).toBe(single.licenceId);
      expect(decision?.policyVersionId).toBe(single.policyVersionId);
      expect(decision?.validUntil).toEqual(single.validUntil);
    },
  );

  it('evaluates many resources with one fact load and one catalogue read', async () => {
    const { service, prisma } = world();
    await service.evaluateMany({
      tenantId: 't1',
      resources: [
        { staffId: 's1', classId: 'c1', subjectId: null },
        { staffId: 's1', classId: 'c1', subjectId: null },
      ],
    });
    expect(prisma.nepalHrPolicyVersion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.staff.findMany).toHaveBeenCalledTimes(1);
  });
});
