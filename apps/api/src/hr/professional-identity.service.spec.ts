import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfessionalIdentityService,
  translateGuardError,
} from './professional-identity.service';

const HR_A = { tenantId: 't1', userId: 'hr-a' } as any;
const HR_B = { tenantId: 't1', userId: 'hr-b' } as any;
const TEACHER_SELF = { tenantId: 't1', userId: 'teacher-user' } as any;
const OTHER_TENANT = { tenantId: 't2', userId: 'hr-x' } as any;

const PAST = new Date('2024-01-01T00:00:00Z');

function setup(
  state: Partial<{
    employment: any;
    overlap: any;
    profile: any;
    evidence: any;
  }> = {},
) {
  const staffRow = { id: 's1', userId: 'teacher-user', tenantId: 't1' };
  const tx: any = {
    $queryRaw: jest.fn(
      (_strings: TemplateStringsArray, staffId: string, tenantId: string) =>
        staffId === staffRow.id && tenantId === staffRow.tenantId
          ? [{ id: staffRow.id, userId: staffRow.userId }]
          : [],
    ),
    staff: {
      findFirst: jest.fn(({ where }) =>
        where.id === staffRow.id && where.tenantId === staffRow.tenantId
          ? { id: staffRow.id, userId: staffRow.userId }
          : null,
      ),
    },
    staffEmployment: {
      create: jest.fn(({ data }) => ({ id: 'e-new', ...data })),
      findFirst: jest.fn(({ where }) =>
        typeof where.id === 'object'
          ? (state.overlap ?? null)
          : (state.employment ?? null),
      ),
      update: jest.fn(({ data }) => ({ ...state.employment, ...data })),
    },
    teacherProfile: {
      findFirst: jest.fn(() => state.profile ?? null),
      create: jest.fn(({ data }) => ({ id: 'p-new', ...data })),
      update: jest.fn(({ data }) => ({ ...state.profile, ...data })),
    },
    teacherQualificationEvidence: {
      create: jest.fn(({ data }) => ({ id: 'q-new', ...data })),
      findFirst: jest.fn(() => state.evidence ?? null),
      update: jest.fn(({ data }) => ({ ...state.evidence, ...data })),
    },
    teachingLicenceEvidence: {
      create: jest.fn(({ data }) => ({ id: 'l-new', ...data })),
      findFirst: jest.fn(() => state.evidence ?? null),
      update: jest.fn(({ data }) => ({ ...state.evidence, ...data })),
    },
  };
  const prisma: any = tx;
  tx.$transaction = jest.fn((fn: (t: any) => unknown) => fn(tx));
  const audit = { record: jest.fn() };
  const eligibility = {
    projectEligibility: jest.fn(() => ({ outcome: 'INELIGIBLE' })),
  };
  return {
    service: new ProfessionalIdentityService(
      prisma,
      audit as any,
      eligibility as any,
    ),
    tx,
    audit,
    eligibility,
  };
}

const pendingEmployment = {
  id: 'e1',
  status: 'PENDING',
  effectiveFrom: PAST,
  effectiveTo: null,
  submittedById: 'hr-a',
};

describe('ProfessionalIdentityService (Phase 5J–5L)', () => {
  describe('employment', () => {
    it('creates employment as PENDING with the submitter recorded, and audits', async () => {
      const { service, tx, audit } = setup();
      await service.createEmployment(
        's1',
        {
          employmentType: 'PERMANENT',
          postCategoryCode: ' TEACHER ',
          schoolTypeCode: 'INSTITUTIONAL',
          effectiveFrom: '2025-04-14',
        } as any,
        HR_A,
      );
      const data = tx.staffEmployment.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        tenantId: 't1',
        staffId: 's1',
        submittedById: 'hr-a',
        postCategoryCode: 'TEACHER',
      });
      expect(data.status).toBeUndefined(); // DB default PENDING; never set by caller
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          resource: 'staff_employment',
        }),
        tx,
      );
    });

    it('rejects an inverted date window before touching the DB', async () => {
      const { service, tx } = setup();
      await expect(
        service.createEmployment(
          's1',
          {
            employmentType: 'PERMANENT',
            postCategoryCode: 'T',
            schoolTypeCode: 'I',
            effectiveFrom: '2025-05-01',
            effectiveTo: '2025-04-01',
          } as any,
          HR_A,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.staffEmployment.create).not.toHaveBeenCalled();
    });

    it('does not reveal staff from another tenant', async () => {
      const { service } = setup();
      await expect(
        service.createEmployment(
          's1',
          {
            employmentType: 'PERMANENT',
            postCategoryCode: 'T',
            schoolTypeCode: 'I',
            effectiveFrom: '2025-04-14',
          } as any,
          OTHER_TENANT,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('enforces maker-checker: the submitter cannot verify', async () => {
      const { service, tx } = setup({ employment: pendingEmployment });
      await expect(
        service.reviewEmployment('s1', 'e1', { decision: 'VERIFY' }, HR_A),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'PROFESSIONAL_MAKER_CHECKER',
        }),
      });
      expect(tx.staffEmployment.update).not.toHaveBeenCalled();
    });

    it('a staff member cannot verify their own employment', async () => {
      const { service } = setup({
        employment: { ...pendingEmployment, submittedById: 'hr-a' },
      });
      await expect(
        service.reviewEmployment(
          's1',
          'e1',
          { decision: 'VERIFY' },
          TEACHER_SELF,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PROFESSIONAL_SELF_REVIEW' }),
      });
    });

    it('locks the staff row and blocks overlapping verified employment', async () => {
      const { service, tx } = setup({
        employment: pendingEmployment,
        overlap: { id: 'e0' },
      });
      await expect(
        service.reviewEmployment('s1', 'e1', { decision: 'VERIFY' }, HR_B),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'EMPLOYMENT_OVERLAP',
          overlappingEmploymentId: 'e0',
        }),
      });
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.staffEmployment.update).not.toHaveBeenCalled();
    });

    it('an independent reviewer verifies pending employment', async () => {
      const { service, tx, audit } = setup({ employment: pendingEmployment });
      await service.reviewEmployment('s1', 'e1', { decision: 'VERIFY' }, HR_B);
      expect(tx.staffEmployment.update.mock.calls[0][0].data).toMatchObject({
        status: 'VERIFIED',
        verifiedById: 'hr-b',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'verify' }),
        tx,
      );
    });

    it('rejecting does not require an overlap check', async () => {
      const { service, tx } = setup({
        employment: pendingEmployment,
        overlap: { id: 'e0' },
      });
      await service.reviewEmployment('s1', 'e1', { decision: 'REJECT' }, HR_B);
      expect(tx.staffEmployment.update.mock.calls[0][0].data.status).toBe(
        'REJECTED',
      );
    });

    it('only pending employment can be reviewed', async () => {
      const { service } = setup({
        employment: { ...pendingEmployment, status: 'VERIFIED' },
      });
      await expect(
        service.reviewEmployment('s1', 'e1', { decision: 'VERIFY' }, HR_B),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('ending cannot extend a verified period', async () => {
      const { service } = setup({
        employment: {
          ...pendingEmployment,
          status: 'VERIFIED',
          effectiveTo: new Date('2026-01-01'),
        },
      });
      await expect(
        service.endEmployment(
          's1',
          'e1',
          { effectiveTo: '2027-01-01', reason: 'Resigned' },
          HR_B,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ends verified employment with a reason', async () => {
      const { service, tx } = setup({
        employment: { ...pendingEmployment, status: 'VERIFIED' },
      });
      await service.endEmployment(
        's1',
        'e1',
        { effectiveTo: '2026-03-01', reason: ' Resigned ' },
        HR_B,
      );
      expect(tx.staffEmployment.update.mock.calls[0][0].data).toMatchObject({
        status: 'ENDED',
        endReason: 'Resigned',
      });
    });
  });

  describe('teacher profile', () => {
    it('is separate from role: a second profile is refused', async () => {
      const { service, tx } = setup({ profile: { id: 'p1' } });
      await expect(
        service.createTeacherProfile(
          's1',
          { effectiveFrom: '2025-04-14' },
          HR_A,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'TEACHER_PROFILE_EXISTS' }),
      });
      expect(tx.teacherProfile.create).not.toHaveBeenCalled();
    });

    it('creates an ACTIVE profile', async () => {
      const { service, tx } = setup();
      await service.createTeacherProfile(
        's1',
        { effectiveFrom: '2025-04-14' },
        HR_A,
      );
      expect(tx.teacherProfile.create.mock.calls[0][0].data).toMatchObject({
        status: 'ACTIVE',
        staffId: 's1',
        tenantId: 't1',
      });
    });
  });

  describe('evidence', () => {
    it('requires a teacher profile first', async () => {
      const { service } = setup();
      await expect(
        service.addLicence(
          's1',
          {
            authorityCode: 'tsc',
            externalReference: 'L-1',
            validFrom: '2025-01-01',
          } as any,
          HR_A,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'TEACHER_PROFILE_MISSING' }),
      });
    });

    it('uploaded evidence is PENDING, never verified by default', async () => {
      const { service, tx } = setup({ profile: { id: 'p1' } });
      await service.addLicence(
        's1',
        {
          authorityCode: 'tsc',
          externalReference: 'L-1',
          validFrom: '2025-01-01',
          documentId: 'f1',
        } as any,
        HR_A,
      );
      const data = tx.teachingLicenceEvidence.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        status: 'PENDING',
        authorityCode: 'TSC',
        submittedById: 'hr-a',
        documentId: 'f1',
      });
      expect(data.verifiedById).toBeUndefined();
    });

    it('cannot verify evidence with no document or source', async () => {
      const { service } = setup({
        evidence: {
          id: 'q1',
          status: 'PENDING',
          submittedById: 'hr-a',
          documentId: null,
          sourceUri: null,
        },
      });
      await expect(
        service.reviewEvidence(
          'qualification',
          's1',
          'q1',
          { decision: 'VERIFY' },
          HR_B,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EVIDENCE_SOURCE_REQUIRED' }),
      });
    });

    it('maker-checker applies to evidence verification', async () => {
      const { service } = setup({
        evidence: {
          id: 'q1',
          status: 'PENDING',
          submittedById: 'hr-a',
          documentId: 'f1',
          sourceUri: null,
        },
      });
      await expect(
        service.reviewEvidence(
          'qualification',
          's1',
          'q1',
          { decision: 'VERIFY' },
          HR_A,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('verifies with an independent reviewer', async () => {
      const { service, tx } = setup({
        evidence: {
          id: 'l1',
          status: 'PENDING',
          submittedById: 'hr-a',
          documentId: 'f1',
          sourceUri: null,
        },
      });
      await service.reviewEvidence(
        'licence',
        's1',
        'l1',
        { decision: 'VERIFY' },
        HR_B,
      );
      expect(
        tx.teachingLicenceEvidence.update.mock.calls[0][0].data,
      ).toMatchObject({ status: 'VERIFIED', verifiedById: 'hr-b' });
    });

    it('only verified evidence can be revoked, with a reason', async () => {
      const pending = setup({ evidence: { id: 'l1', status: 'PENDING' } });
      await expect(
        pending.service.revokeEvidence(
          'licence',
          's1',
          'l1',
          { reason: 'Revoked by TSC' },
          HR_B,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      const verified = setup({ evidence: { id: 'l1', status: 'VERIFIED' } });
      await verified.service.revokeEvidence(
        'licence',
        's1',
        'l1',
        { reason: 'Revoked by TSC' },
        HR_B,
      );
      expect(
        verified.tx.teachingLicenceEvidence.update.mock.calls[0][0].data,
      ).toMatchObject({
        status: 'REVOKED',
        revocationReason: 'Revoked by TSC',
      });
    });

    it('overview exposes documentId only (no URLs) and effective evidence state', async () => {
      const { service, tx } = setup();
      tx.staffEmployment.findMany = jest.fn(() => []);
      tx.teacherEligibilityAssessment = { findMany: jest.fn(() => []) };
      tx.teacherProfile.findFirst = jest.fn(() => ({
        id: 'p1',
        status: 'ACTIVE',
        effectiveFrom: PAST,
        effectiveTo: null,
        qualifications: [
          {
            id: 'q1',
            status: 'PENDING',
            validFrom: PAST,
            validUntil: null,
            documentId: 'f1',
          },
        ],
        licences: [
          {
            id: 'l1',
            status: 'VERIFIED',
            validFrom: PAST,
            validUntil: new Date('2025-01-01'),
            documentId: 'f2',
          },
        ],
      }));
      const overview: any = await service.getOverview('s1', HR_A);
      expect(overview.teacherProfile.qualifications[0].effectiveState).toBe(
        'PENDING',
      );
      expect(overview.teacherProfile.licences[0].effectiveState).toBe(
        'EXPIRED',
      );
      expect(JSON.stringify(overview)).not.toMatch(/url|signed/i);
      expect(overview.roleIsNotEvidence).toBe(true);
    });
  });

  it('eligibility projection is tenant-scoped and delegates to the shared evaluator', async () => {
    const { service, eligibility } = setup();
    await service.projectEligibility('s1', { classId: 'c1' }, HR_A);
    expect(eligibility.projectEligibility).toHaveBeenCalledWith({
      tenantId: 't1',
      staffId: 's1',
      classId: 'c1',
      subjectId: null,
    });
    await expect(
      service.projectEligibility('s1', { classId: 'c1' }, OTHER_TENANT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps database guard failures to stable 409 codes', () => {
    expect(
      translateGuardError(
        new Error('Overlapping verified employment periods are not permitted'),
      ),
    ).toMatchObject({
      response: expect.objectContaining({ code: 'EMPLOYMENT_OVERLAP' }),
    });
    expect(
      translateGuardError(
        new Error('violates check constraint "StaffEmployment_maker_checker"'),
      ),
    ).toMatchObject({
      response: expect.objectContaining({ code: 'PROFESSIONAL_MAKER_CHECKER' }),
    });
    const unknown = new Error('boom');
    expect(translateGuardError(unknown)).toBe(unknown);
  });
});
