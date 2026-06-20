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

function buildPrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    tenantSetting: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    admissionApplication: {
      findFirst: jest.fn().mockResolvedValue(admissionCase),
      create: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValue({ ...admissionCase, status: 'ADMITTED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    const prisma = buildPrisma({
      tenantSetting: {
        findFirst: jest.fn().mockResolvedValue({
          value: {
            defaultPolicy: { admissionMode: 'REVIEW_REQUIRED' },
            overrides: [],
          },
        }),
      },
    });
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

    prisma.tenantSetting.findFirst.mockResolvedValue({
      value: {
        defaultPolicy: { admissionMode: 'REVIEW_REQUIRED' },
        overrides: [],
      },
    });
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
    prisma.tenantSetting.findFirst.mockResolvedValue({
      value: {
        defaultPolicy: {
          admissionMode: 'REVIEW_REQUIRED',
          requirePrincipalApproval: true,
        },
        overrides: [],
      },
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

  it('rejects policy scopes that do not belong to the authenticated tenant', async () => {
    const prisma = buildPrisma();
    prisma.class.findMany.mockResolvedValue([]);
    const auditService = { record: jest.fn() };
    const service = buildService(prisma, { auditService });

    await expect(
      service.updatePolicy(
        {
          defaultPolicy: { admissionMode: 'DIRECT_ALLOWED' },
          overrides: [
            { admissionMode: 'REVIEW_REQUIRED', classId: 'class-other' },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenantSetting.upsert).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('inherits school defaults into a scoped rule instead of resetting unspecified controls', async () => {
    const prisma = buildPrisma();
    prisma.tenantSetting.findFirst.mockResolvedValue({
      value: {
        defaultPolicy: {
          admissionMode: 'DIRECT_ALLOWED',
          requireDocumentReview: true,
          allowAdmissionWithDocumentsPending: true,
        },
        overrides: [{ classId: 'class-a', admissionMode: 'DIRECT_ALLOWED' }],
      },
    });
    const service = buildService(prisma);

    const result = await service.getCase('case-a', actor);

    expect(result.policyRequirements.requireDocumentReview).toBe(true);
    expect(result.requiresReview).toBe(true);
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
});
