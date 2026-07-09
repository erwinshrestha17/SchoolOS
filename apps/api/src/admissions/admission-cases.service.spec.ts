/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as PrismaClient from '@prisma/client';
import { AdmissionCasesService } from './admission-cases.service';

Object.assign(PrismaClient.Prisma as Record<string, unknown>, {
  TransactionIsolationLevel: { Serializable: 'Serializable' },
});
Object.assign(PrismaClient as Record<string, unknown>, {
  StudentDocumentStatus: { ACTIVE: 'ACTIVE' },
  StudentDocumentKind: {
    BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
    TRANSFER_CERTIFICATE: 'TRANSFER_CERTIFICATE',
    PREVIOUS_REPORT_CARD: 'PREVIOUS_REPORT_CARD',
    OTHER: 'OTHER',
  },
});

const actor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  roles: ['admin'],
  permissions: ['students:manage_lifecycle'],
} as any;

const admissionCase = {
  id: 'case-a',
  tenantId: 'tenant-a',
  status: 'READY_TO_ADMIT',
  firstNameEn: 'Aarav',
  lastNameEn: 'Shrestha',
  firstNameNp: null,
  lastNameNp: null,
  dateOfBirth: new Date('2015-01-01'),
  gender: 'MALE',
  guardianFullName: 'Sita Shrestha',
  guardianRelation: 'Mother',
  guardianPhone: '9800000000',
  guardianEmail: null,
  academicYearId: 'year-a',
  classId: 'class-a',
  sectionId: 'section-a',
  previousSchool: null,
  source: 'OFFICE_WALK_IN',
  notes: null,
  duplicateReview: {},
  convertedStudentId: null,
  rejectedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultPolicyVersion = {
  id: 'version-default',
  policyId: 'policy-default',
  admissionMode: 'DIRECT_ALLOWED',
  requiredFields: [],
  requireSection: false,
  requireDocumentReview: false,
  requireInterview: false,
  requirePrincipalApproval: false,
  requireTransferCertificate: false,
  requirePriorMarksheet: false,
  requireStreamOrMarksReview: false,
  allowAdmissionWithDocumentsPending: true,
  enforceCapacityWhenAvailable: false,
  documentRequirements: [],
  policy: { id: 'policy-default', name: 'School Default' },
};

// Overrides the mocked resolved policy for a single test, mirroring how a
// named ACTIVE AdmissionPolicy + its current version would resolve.
function mockPolicy(prisma: any, rule: Record<string, unknown>) {
  const version = { ...defaultPolicyVersion, ...rule };
  prisma.admissionPolicy.findMany.mockResolvedValue([
    {
      id: 'policy-default',
      name: 'School Default',
      isDefault: true,
      academicYearId: null,
      classId: null,
      gradeBand: null,
      source: null,
      applicantType: 'BOTH',
      currentVersionId: 'version-default',
    },
  ]);
  prisma.admissionPolicyVersion.findFirst.mockResolvedValue(version);
}

function buildPrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    admissionPolicy: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'policy-default',
          name: 'School Default',
          isDefault: true,
          academicYearId: null,
          classId: null,
          gradeBand: null,
          source: null,
          applicantType: 'BOTH',
          currentVersionId: 'version-default',
        },
      ]),
    },
    admissionPolicyVersion: {
      findFirst: jest.fn().mockResolvedValue(defaultPolicyVersion),
    },
    admissionApplication: {
      findFirst: jest.fn().mockResolvedValue(admissionCase),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValue({ ...admissionCase, status: 'ADMITTED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    admissionAssessmentSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    academicYear: {
      findFirst: jest.fn().mockResolvedValue({ id: 'year-a', name: '2082/83' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'year-a' }]),
    },
    class: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'class-a', name: 'Grade 5', level: 5 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'class-a' }]),
    },
    section: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'section-a',
        name: 'A',
        classId: 'class-a',
        capacity: 40,
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    enrollment: {
      count: jest.fn().mockResolvedValue(10),
      create: jest.fn().mockResolvedValue({ id: 'enrollment-a' }),
    },
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-a',
        studentSystemId: 'STU-001',
        firstNameEn: 'Aarav',
        lastNameEn: 'Shrestha',
      }),
      create: jest.fn().mockResolvedValue({ id: 'student-a' }),
    },
    guardian: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'guardian-a' }),
      update: jest.fn(),
    },
    studentGuardian: {
      create: jest.fn().mockResolvedValue({ id: 'student-guardian-a' }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-a' }),
    },
    studentDocument: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    fileAsset: { findMany: jest.fn().mockResolvedValue([]) },
    approvalRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    approvalPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    ...overrides,
  };
  return prisma;
}

function buildService(prisma: any, dependencies: Record<string, any> = {}) {
  return new AdmissionCasesService(
    prisma,
    dependencies.auditService ?? { record: jest.fn() },
    { medicalEncryptionKey: undefined } as any,
    dependencies.fileRegistryService ?? { getFileMetadata: jest.fn() },
    dependencies.studentRecordsService ?? {
      attachRegisteredAdmissionDocuments: jest.fn(),
    },
    dependencies.approvalWorkflowService ?? {
      createRequest: jest.fn(),
      decide: jest.fn(),
      registerFinalAction: jest.fn(),
    },
  );
}

describe('AdmissionCasesService', () => {
  it('creates the M1 student, guardian, enrollment, lifecycle, and audit atomically without finance writes', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.directAdmit('case-a', {}, actor);

    expect(result).toEqual(
      expect.objectContaining({
        admissionCaseId: 'case-a',
        alreadyAdmitted: false,
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.student.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.guardian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.studentGuardian.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.studentLifecycleTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admission_case_direct_admit',
          tenantId: 'tenant-a',
        }),
      }),
    );
    expect((service as any).financeService).toBeUndefined();
  });

  it('returns the already admitted student on a repeat submission', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue({
          ...admissionCase,
          status: 'ADMITTED',
          convertedStudentId: 'student-a',
        }),
      },
    });
    const service = buildService(prisma);

    const result = await service.directAdmit('case-a', {}, actor);

    expect(result).toEqual(
      expect.objectContaining({
        alreadyAdmitted: true,
        student: expect.objectContaining({ id: 'student-a' }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reuses a matching tenant guardian without silently overwriting the guardian profile', async () => {
    const prisma = buildPrisma();
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-existing' });
    const service = buildService(prisma);

    await service.directAdmit('case-a', {}, actor);

    expect(prisma.guardian.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        primaryPhone: '+9779800000000',
        fullName: { equals: 'Sita Shrestha', mode: 'insensitive' },
      },
      select: { id: true },
    });
    expect(prisma.guardian.create).not.toHaveBeenCalled();
    expect(prisma.guardian.update).not.toHaveBeenCalled();
    expect(prisma.studentGuardian.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ guardianId: 'guardian-existing' }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after: expect.objectContaining({ guardianReused: true }),
        }),
      }),
    );
  });

  it('moves review-required policy cases out of direct admission', async () => {
    const prisma = buildPrisma();
    mockPolicy(prisma, { admissionMode: 'REVIEW_REQUIRED' });
    const service = buildService(prisma);

    await expect(
      service.directAdmit('case-a', {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admissionApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WAITING_FOR_REVIEW' }),
      }),
    );
  });

  it('lists timing-aware missing document requests including admitted follow-ups', async () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-07-10T00:00:00.000Z').getTime());
    const policyVersion = {
      ...defaultPolicyVersion,
      documentRequirements: [
        {
          documentKind: 'BIRTH_CERTIFICATE',
          label: 'Birth certificate',
          isRequired: true,
          timing: 'BEFORE_REVIEW',
          requiresOriginalVerification: true,
          canBeWaived: false,
          waivableByRoleKeys: [],
        },
        {
          documentKind: 'PHOTO',
          label: 'Photo',
          isRequired: true,
          timing: 'BEFORE_ENROLLMENT',
          requiresOriginalVerification: false,
          canBeWaived: false,
          waivableByRoleKeys: [],
        },
      ],
    };
    const admittedWithFollowUp = {
      ...admissionCase,
      status: 'ADMITTED',
      convertedStudentId: 'student-a',
      policyVersionId: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-08T00:00:00.000Z'),
      duplicateReview: {
        followUps: [
          {
            code: 'DOCUMENTS_PENDING',
            label: 'Add missing student documents',
            blocking: false,
          },
        ],
      },
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findMany: jest.fn().mockResolvedValue([admittedWithFollowUp]),
      },
      admissionPolicy: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'policy-default',
            name: 'School Default',
            isDefault: true,
            academicYearId: null,
            classId: null,
            gradeBand: null,
            source: null,
            applicantType: 'BOTH',
            currentVersionId: 'version-default',
            currentVersion: policyVersion,
          },
        ]),
      },
      class: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'class-a', name: 'Grade 5', level: 5 }]),
      },
    });
    const service = buildService(prisma);

    try {
      const result = await service.listDocumentRequests(
        { timing: 'BEFORE_REVIEW', minDaysPending: 7 },
        actor,
      );

      expect(result.total).toBe(1);
      expect(result.summary).toEqual(
        expect.objectContaining({
          casesWithRequests: 1,
          totalMissingDocuments: 1,
          beforeReviewDocuments: 1,
          beforeEnrollmentDocuments: 0,
          oldestDaysPending: 9,
        }),
      );
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          admissionCaseId: 'case-a',
          admittedStudentId: 'student-a',
          className: 'Grade 5',
          displayStatus: 'ADMITTED',
          missingDocuments: [
            expect.objectContaining({
              documentKind: 'BIRTH_CERTIFICATE',
              timing: 'BEFORE_REVIEW',
              requiresOriginalVerification: true,
            }),
          ],
        }),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('lists interview-required admission cases that still need scheduling', async () => {
    const interviewCase = {
      ...admissionCase,
      status: 'WAITING_FOR_REVIEW',
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findMany: jest.fn().mockResolvedValue([interviewCase]),
      },
      class: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'class-a', name: 'Grade 5', level: 5 }]),
      },
    });
    mockPolicy(prisma, {
      admissionMode: 'REVIEW_REQUIRED',
      requireInterview: true,
    });
    const service = buildService(prisma);

    const result = await service.listAssessmentCandidates({}, actor);

    expect(prisma.admissionApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          assessmentSessions: { none: {} },
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        admissionCaseId: 'case-a',
        applicantName: 'Aarav Shrestha',
        className: 'Grade 5',
        policyName: 'School Default',
      }),
    );
  });

  it('schedules a policy-required assessment in NPT and audits the lifecycle change', async () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-07-10T00:00:00.000Z').getTime());
    const scheduledSession = {
      id: 'assessment-a',
      tenantId: 'tenant-a',
      admissionCaseId: 'case-a',
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-07-17T04:15:00.000Z'),
      durationMinutes: 45,
      mode: 'IN_PERSON',
      location: 'Room 2',
      notes: 'Meet admission coordinator.',
      interviewerUserId: 'user-a',
      result: null,
      resultNotes: null,
      resultScore: null,
      resultRecordedAt: null,
      resultRecordedById: null,
      createdById: 'user-a',
      updatedById: 'user-a',
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
      updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    };
    const prisma = buildPrisma();
    mockPolicy(prisma, {
      admissionMode: 'REVIEW_REQUIRED',
      requireInterview: true,
    });
    prisma.admissionAssessmentSession.upsert.mockResolvedValue(
      scheduledSession,
    );
    prisma.admissionAssessmentSession.findFirst.mockResolvedValue({
      ...scheduledSession,
      admissionCase: { ...admissionCase, status: 'WAITING_FOR_REVIEW' },
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    try {
      const result = await service.scheduleAssessmentSession(
        'case-a',
        {
          bsDate: '2083-04-01',
          startTime: '10:00',
          durationMinutes: 45,
          location: 'Room 2',
          notes: 'Meet admission coordinator.',
        },
        actor,
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'assessment-a',
          admissionCaseId: 'case-a',
          status: 'SCHEDULED',
          mode: 'IN_PERSON',
        }),
      );
      expect(prisma.admissionAssessmentSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: 'tenant-a',
            admissionCaseId: 'case-a',
            scheduledAt: expect.any(Date),
            durationMinutes: 45,
            interviewerUserId: 'user-a',
          }),
        }),
      );
      expect(prisma.admissionApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-a' },
          data: expect.objectContaining({
            status: 'WAITING_FOR_REVIEW',
            policyVersionId: 'version-default',
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admission_assessment_schedule',
          tenantId: 'tenant-a',
          resourceId: 'assessment-a',
          after: expect.objectContaining({ admissionCaseId: 'case-a' }),
        }),
        prisma,
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('records an assessment result once and keeps the admission case open for review', async () => {
    const scheduledSession = {
      id: 'assessment-a',
      tenantId: 'tenant-a',
      admissionCaseId: 'case-a',
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-07-09T04:15:00.000Z'),
      durationMinutes: 30,
      mode: 'IN_PERSON',
      location: null,
      notes: null,
      interviewerUserId: 'user-a',
      result: null,
      resultNotes: null,
      resultScore: null,
      resultRecordedAt: null,
      resultRecordedById: null,
      createdById: 'user-a',
      updatedById: 'user-a',
      createdAt: new Date('2026-07-08T00:00:00.000Z'),
      updatedAt: new Date('2026-07-08T00:00:00.000Z'),
    };
    const completedSession = {
      ...scheduledSession,
      status: 'COMPLETED',
      result: 'PASSED',
      resultScore: 82,
      resultRecordedAt: new Date('2026-07-09T05:00:00.000Z'),
      resultRecordedById: 'user-a',
    };
    const prisma = buildPrisma();
    prisma.admissionAssessmentSession.findFirst
      .mockResolvedValueOnce({
        ...scheduledSession,
        admissionCase: { ...admissionCase, status: 'WAITING_FOR_REVIEW' },
      })
      .mockResolvedValueOnce({
        ...completedSession,
        admissionCase: { ...admissionCase, status: 'WAITING_FOR_REVIEW' },
      });
    prisma.admissionAssessmentSession.update.mockResolvedValue(
      completedSession,
    );
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    const result = await service.recordAssessmentResult(
      'assessment-a',
      { result: 'PASSED', score: 82 },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'assessment-a',
        result: 'PASSED',
        resultScore: 82,
      }),
    );
    expect(prisma.admissionAssessmentSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assessment-a' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: 'PASSED',
          resultScore: 82,
          resultRecordedById: 'user-a',
        }),
      }),
    );
    expect(prisma.admissionApplication.update).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_assessment_result',
        resourceId: 'assessment-a',
        after: expect.objectContaining({
          result: 'PASSED',
          resultScore: 82,
        }),
      }),
      prisma,
    );
  });

  it('fails closed for an admission case outside the authenticated tenant', async () => {
    const prisma = buildPrisma({
      admissionApplication: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = buildService(prisma);

    await expect(
      service.getCase('case-other-tenant', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns safe duplicate candidates before admission and permits only an audited authorized override', async () => {
    const duplicate = {
      id: 'student-existing',
      studentSystemId: 'STU-EXISTING',
      firstNameEn: 'Aarav',
      lastNameEn: 'Shrestha',
      lifecycleStatus: 'ACTIVE',
      class: { name: 'Grade 5' },
      sectionRef: { name: 'A' },
    };
    const prisma = buildPrisma();
    prisma.student.findMany.mockResolvedValue([duplicate]);
    const service = buildService(prisma);

    await expect(service.directAdmit('case-a', {}, actor)).rejects.toEqual(
      expect.objectContaining({
        constructor: ConflictException,
        response: expect.objectContaining({
          admissionCaseId: 'case-a',
          duplicateCandidates: [
            expect.objectContaining({ studentId: 'student-existing' }),
          ],
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const result = await service.directAdmit(
      'case-a',
      {
        overrideDuplicate: true,
        overrideReason: 'Same name and date, confirmed as a different child.',
      },
      actor,
    );
    expect(result.alreadyAdmitted).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after: expect.objectContaining({
            duplicateOverride: true,
            duplicateOverrideReason:
              'Same name and date, confirmed as a different child.',
          }),
        }),
      }),
    );
  });

  it('surfaces guardian-linked sibling candidates without blocking direct admission', async () => {
    const relatedSibling = {
      id: 'student-sibling',
      studentSystemId: 'STU-SIBLING',
      firstNameEn: 'Anaya',
      lastNameEn: 'Shrestha',
      lastNameNp: null,
      lifecycleStatus: 'ACTIVE',
      class: { name: 'Grade 3' },
      sectionRef: { name: 'B' },
      guardianLinks: [
        {
          relation: 'Mother',
          guardian: { fullName: 'Sita Shrestha' },
        },
      ],
    };
    const prisma = buildPrisma();
    prisma.student.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([relatedSibling]);
    const service = buildService(prisma);

    const result = await service.getCase('case-a', actor);

    expect(result.duplicateRisk).toBe(false);
    expect(result.canAdmitDirectly).toBe(true);
    expect(result.relatedStudentCandidates).toEqual([
      expect.objectContaining({
        studentId: 'student-sibling',
        guardianName: 'Sita Shrestha',
        guardianRelation: 'Mother',
        matchReasons: expect.arrayContaining([
          'Guardian phone already has linked student records.',
          'English family name matches.',
          'Guardian name matches an existing guardian.',
        ]),
      }),
    ]);
  });

  it('does not let duplicate override bypass policy-required review or missing permission', async () => {
    const duplicate = {
      id: 'student-existing',
      studentSystemId: 'STU-EXISTING',
      firstNameEn: 'Aarav',
      lastNameEn: 'Shrestha',
      lifecycleStatus: 'ACTIVE',
      class: { name: 'Grade 5' },
      sectionRef: null,
    };
    const prisma = buildPrisma();
    prisma.student.findMany.mockResolvedValue([duplicate]);
    const service = buildService(prisma);

    await expect(
      service.directAdmit(
        'case-a',
        { overrideDuplicate: true, overrideReason: 'Reviewed.' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    mockPolicy(prisma, { admissionMode: 'REVIEW_REQUIRED' });
    await expect(
      service.directAdmit(
        'case-a',
        { overrideDuplicate: true, overrideReason: 'Reviewed.' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finalizes approved cases only and attaches protected admission documents inside the transaction', async () => {
    const caseWithDocument = {
      ...admissionCase,
      status: 'APPROVED',
      duplicateReview: {
        documents: [
          {
            fileId: 'file-a',
            kind: 'BIRTH_CERTIFICATE',
            title: 'Birth certificate',
          },
        ],
      },
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(caseWithDocument),
        update: jest.fn().mockResolvedValue(caseWithDocument),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const studentRecordsService = {
      attachRegisteredAdmissionDocuments: jest.fn(),
    };
    const service = buildService(prisma, {
      fileRegistryService: {
        getFileMetadata: jest.fn().mockResolvedValue({
          id: 'file-a',
          status: 'UPLOADED',
          module: 'admissions',
          entityId: 'case-a',
          uploadedByUserId: 'user-a',
        }),
      },
      studentRecordsService,
    });

    await service.finalizeApprovedCase('case-a', {}, actor);
    expect(
      studentRecordsService.attachRegisteredAdmissionDocuments,
    ).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        admissionCaseId: 'case-a',
        studentId: 'student-a',
        documents: [expect.objectContaining({ fileId: 'file-a' })],
      }),
    );

    const unapproved = buildPrisma();
    await expect(
      buildService(unapproved).finalizeApprovedCase('case-a', {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces principal-only approval when the resolved policy requires it', async () => {
    const prisma = buildPrisma();
    mockPolicy(prisma, {
      admissionMode: 'REVIEW_REQUIRED',
      requirePrincipalApproval: true,
    });
    const service = buildService(prisma);

    await expect(
      service.reviewCase(
        'case-a',
        { action: 'APPROVE', reason: 'Reviewed.' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exposes only backend-authorized review actions and an empty typed history', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    const result = await service.getCase('case-a', actor);

    expect(result.review).toEqual({
      reviewerUserId: null,
      dueDate: null,
      history: [],
      availableActions: ['ASSIGN_REVIEWER', 'MARK_READY_FOR_REVIEW', 'CLOSE'],
    });

    const readOnlyResult = await service.getCase('case-a', {
      ...actor,
      permissions: [],
    });
    expect(readOnlyResult.review.availableActions).toEqual([]);
  });

  it('requires a reason and the waiting-for-review stage before approval', async () => {
    const prisma = buildPrisma();
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await expect(
      service.reviewCase('case-a', { action: 'APPROVE' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reviewCase(
        'case-a',
        { action: 'APPROVE', reason: 'All requirements were reviewed.' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('blocks approval while a policy-required interview has no passed result', async () => {
    const waitingCase = {
      ...admissionCase,
      status: 'WAITING_FOR_REVIEW',
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(waitingCase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    mockPolicy(prisma, {
      admissionMode: 'REVIEW_REQUIRED',
      requireInterview: true,
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await expect(
      service.reviewCase(
        'case-a',
        {
          action: 'APPROVE',
          reason: 'Application is otherwise ready.',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('records a reasoned approval with tenant and concurrency predicates in one transaction', async () => {
    const waitingCase = {
      ...admissionCase,
      status: 'WAITING_FOR_REVIEW',
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(waitingCase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await service.reviewCase(
      'case-a',
      {
        action: 'APPROVE',
        reason: 'Identity, placement, and duplicate checks were reviewed.',
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.admissionApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'case-a',
          tenantId: 'tenant-a',
          status: 'WAITING_FOR_REVIEW',
          updatedAt: waitingCase.updatedAt,
        },
        data: expect.objectContaining({
          status: 'APPROVED',
          updatedById: 'user-a',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_case_approve',
        tenantId: 'tenant-a',
        resourceId: 'case-a',
        after: expect.objectContaining({
          status: 'APPROVED',
          reason: 'Identity, placement, and duplicate checks were reviewed.',
        }),
      }),
      prisma,
    );
  });

  it('assigns review ownership without changing the admission stage', async () => {
    const waitingCase = {
      ...admissionCase,
      status: 'WAITING_FOR_REVIEW',
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(waitingCase),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    prisma.user.findFirst.mockResolvedValue({ id: actor.userId });
    const service = buildService(prisma);

    await service.reviewCase(
      'case-a',
      { action: 'ASSIGN_REVIEWER', reviewerUserId: actor.userId },
      actor,
    );

    expect(prisma.admissionApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'WAITING_FOR_REVIEW',
          duplicateReview: expect.objectContaining({
            review: expect.objectContaining({
              reviewerUserId: 'user-a',
            }),
          }),
        }),
      }),
    );
  });

  it('rejects reviewer assignment outside the active authorized tenant users', async () => {
    const prisma = buildPrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(
      service.reviewCase(
        'case-a',
        { action: 'ASSIGN_REVIEWER', reviewerUserId: 'user-other-tenant' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-other-tenant',
          tenantId: 'tenant-a',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
  });

  it('does not write an audit event when a concurrent review update loses the race', async () => {
    const waitingCase = {
      ...admissionCase,
      status: 'WAITING_FOR_REVIEW',
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(waitingCase),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await expect(
      service.reviewCase(
        'case-a',
        {
          action: 'REJECT',
          reason: 'The application did not meet the recorded requirements.',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('fails closed before a review write when the case belongs to another tenant', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
    });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await expect(
      service.reviewCase(
        'case-other-tenant',
        {
          action: 'REJECT',
          reason: 'The application belongs to a different school.',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('does not require a section merely because the class has sections', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue({
          ...admissionCase,
          sectionId: null,
        }),
      },
    });
    const service = buildService(prisma);

    const result = await service.getCase('case-a', actor);

    expect(result.classSection.sectionRequired).toBe(false);
    expect(result.missingRequiredFields).not.toContain('sectionId');
    expect(result.canAdmitDirectly).toBe(true);
    expect(result).not.toHaveProperty('storageStatus');
  });

  const waivableRequirement = (overrides: Record<string, unknown> = {}) => ({
    documentKind: 'TRANSFER_CERTIFICATE',
    label: 'Transfer certificate',
    isRequired: true,
    timing: 'BEFORE_ENROLLMENT',
    requiresOriginalVerification: false,
    canBeWaived: true,
    waivableByRoleKeys: [],
    ...overrides,
  });

  it('waives a policy-waivable document with an audited reason and clears it from missing documents', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(admissionCase),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ ...admissionCase, ...data }),
          ),
      },
    });
    mockPolicy(prisma, { documentRequirements: [waivableRequirement()] });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await service.waiveCaseDocument(
      'case-a',
      {
        documentKind: 'TRANSFER_CERTIFICATE',
        reason: 'Original verified at the desk.',
      },
      actor,
    );

    expect(prisma.admissionApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duplicateReview: expect.objectContaining({
            documentWaivers: [
              expect.objectContaining({
                documentKind: 'TRANSFER_CERTIFICATE',
                reason: 'Original verified at the desk.',
                byUserId: 'user-a',
              }),
            ],
          }),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_case_document_waived',
        resource: 'admission_case',
        resourceId: 'case-a',
      }),
    );
  });

  it('excludes waived documents from missing documents and reports them separately', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue({
          ...admissionCase,
          duplicateReview: {
            documentWaivers: [
              {
                documentKind: 'TRANSFER_CERTIFICATE',
                reason: 'Original verified at the desk.',
                at: '2026-07-08T00:00:00.000Z',
                byUserId: 'user-a',
              },
            ],
          },
        }),
      },
    });
    mockPolicy(prisma, { documentRequirements: [waivableRequirement()] });
    const service = buildService(prisma);

    const result = await service.getCase('case-a', actor);

    expect(result.missingRequiredDocuments).not.toContain(
      'TRANSFER_CERTIFICATE',
    );
    expect(result.waivedDocuments).toEqual([
      expect.objectContaining({ documentKind: 'TRANSFER_CERTIFICATE' }),
    ]);
  });

  it('rejects waiving a document the applied policy does not mark waivable', async () => {
    const prisma = buildPrisma();
    mockPolicy(prisma, {
      documentRequirements: [waivableRequirement({ canBeWaived: false })],
    });
    const service = buildService(prisma);

    await expect(
      service.waiveCaseDocument(
        'case-a',
        { documentKind: 'TRANSFER_CERTIFICATE', reason: 'Reviewed in person.' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admissionApplication.update).not.toHaveBeenCalled();
  });

  it('rejects waiving when the actor role is outside the policy waiver roles', async () => {
    const prisma = buildPrisma();
    mockPolicy(prisma, {
      documentRequirements: [
        waivableRequirement({ waivableByRoleKeys: ['principal'] }),
      ],
    });
    const service = buildService(prisma);

    await expect(
      service.waiveCaseDocument(
        'case-a',
        { documentKind: 'TRANSFER_CERTIFICATE', reason: 'Reviewed in person.' },
        { ...actor, roles: ['support_staff'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removes an active waiver and refuses when none exists', async () => {
    const withWaiver = {
      ...admissionCase,
      duplicateReview: {
        documentWaivers: [
          {
            documentKind: 'TRANSFER_CERTIFICATE',
            reason: 'Original verified at the desk.',
            at: '2026-07-08T00:00:00.000Z',
            byUserId: 'user-a',
          },
        ],
      },
    };
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue(withWaiver),
        update: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ ...withWaiver, ...data }),
          ),
      },
    });
    mockPolicy(prisma, { documentRequirements: [waivableRequirement()] });
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await service.removeCaseDocumentWaiver(
      'case-a',
      { documentKind: 'TRANSFER_CERTIFICATE' },
      actor,
    );
    expect(prisma.admissionApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duplicateReview: expect.objectContaining({ documentWaivers: [] }),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_case_document_waiver_removed',
      }),
    );

    const bare = buildPrisma();
    mockPolicy(bare, { documentRequirements: [waivableRequirement()] });
    await expect(
      buildService(bare).removeCaseDocumentWaiver(
        'case-a',
        { documentKind: 'TRANSFER_CERTIFICATE' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('multi-tier approval chain', () => {
    const waitingCase = { ...admissionCase, status: 'WAITING_FOR_REVIEW' };
    const stageActor = {
      tenantId: 'tenant-a',
      userId: 'user-vp',
      roles: ['vice_principal'],
      permissions: ['students:manage_lifecycle'],
    } as any;

    it('starts a new approval chain on the first APPROVE click and leaves the case WAITING_FOR_REVIEW', async () => {
      const prisma = buildPrisma({
        admissionApplication: {
          findFirst: jest.fn().mockResolvedValue(waitingCase),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        approvalPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'approval-policy-x',
            approverRoles: ['vice_principal', 'principal'],
            approverPermissions: ['', ''],
          }),
        },
      });
      mockPolicy(prisma, {
        admissionMode: 'REVIEW_REQUIRED',
        approvalPolicyId: 'approval-policy-x',
      });
      const approvalWorkflowService = {
        createRequest: jest.fn().mockResolvedValue({ id: 'request-a' }),
        decide: jest.fn().mockResolvedValue({ status: 'PENDING' }),
        registerFinalAction: jest.fn(),
      };
      const service = buildService(prisma, { approvalWorkflowService });

      await service.reviewCase(
        'case-a',
        { action: 'APPROVE', reason: 'Reviewed and ready for stage 1.' },
        stageActor,
      );

      expect(approvalWorkflowService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowType: 'ADMISSION_CASE',
          policyId: 'approval-policy-x',
          targetModule: 'admissions',
          targetType: 'AdmissionApplication',
          targetId: 'case-a',
        }),
        stageActor,
      );
      expect(approvalWorkflowService.decide).toHaveBeenCalledWith(
        'request-a',
        expect.objectContaining({ decision: 'APPROVE' }),
        stageActor,
      );
      expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
    });

    it('rejects APPROVE from an actor who does not hold the current stage role', async () => {
      const prisma = buildPrisma({
        admissionApplication: {
          findFirst: jest.fn().mockResolvedValue(waitingCase),
        },
        approvalPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'approval-policy-x',
            approverRoles: ['vice_principal'],
            approverPermissions: [''],
          }),
        },
      });
      mockPolicy(prisma, {
        admissionMode: 'REVIEW_REQUIRED',
        approvalPolicyId: 'approval-policy-x',
      });
      const approvalWorkflowService = {
        createRequest: jest.fn(),
        decide: jest.fn(),
        registerFinalAction: jest.fn(),
      };
      const service = buildService(prisma, { approvalWorkflowService });
      const otherActor = { ...stageActor, roles: ['teacher'] };

      await expect(
        service.reviewCase(
          'case-a',
          { action: 'APPROVE', reason: 'Trying to approve without the role.' },
          otherActor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(approvalWorkflowService.createRequest).not.toHaveBeenCalled();
    });

    it('advances an in-progress chain via decide() when the current stage approver approves', async () => {
      const prisma = buildPrisma({
        admissionApplication: {
          findFirst: jest.fn().mockResolvedValue(waitingCase),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        approvalRequest: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'request-a',
            steps: [
              {
                sequence: 1,
                status: 'APPROVED',
                approverRole: 'vice_principal',
                approverPermission: null,
              },
              {
                sequence: 2,
                status: 'PENDING',
                approverRole: 'principal',
                approverPermission: null,
              },
            ],
          }),
        },
      });
      mockPolicy(prisma, {
        admissionMode: 'REVIEW_REQUIRED',
        approvalPolicyId: 'approval-policy-x',
      });
      const approvalWorkflowService = {
        createRequest: jest.fn(),
        decide: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
        registerFinalAction: jest.fn(),
      };
      const service = buildService(prisma, { approvalWorkflowService });
      const principalActor = {
        ...stageActor,
        userId: 'user-principal',
        roles: ['principal'],
      };

      await service.reviewCase(
        'case-a',
        { action: 'APPROVE', reason: 'Final sign-off.' },
        principalActor,
      );

      expect(approvalWorkflowService.createRequest).not.toHaveBeenCalled();
      expect(approvalWorkflowService.decide).toHaveBeenCalledWith(
        'request-a',
        expect.objectContaining({ decision: 'APPROVE' }),
        principalActor,
      );
      expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
    });

    it('still gates legacy requirePrincipalApproval on principal/platform_super_admin only when no chain is configured', async () => {
      const prisma = buildPrisma();
      mockPolicy(prisma, {
        admissionMode: 'REVIEW_REQUIRED',
        requirePrincipalApproval: true,
      });
      const service = buildService(prisma);

      await expect(
        service.reviewCase(
          'case-a',
          { action: 'APPROVE', reason: 'Reviewed.' },
          { ...stageActor, roles: ['vice_principal'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
