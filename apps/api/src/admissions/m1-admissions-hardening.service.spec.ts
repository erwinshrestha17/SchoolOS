import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  EnrollmentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { M1AdmissionsHardeningService } from './m1-admissions-hardening.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:read', 'student_documents:manage'],
};

describe('M1AdmissionsHardeningService', () => {
  it('denies admission draft recovery during support override before reading autosave PII', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.recoverAdmissionDrafts(
        {},
        {
          ...actor,
          isSupportOverride: true,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.admissionApplication.findMany).not.toHaveBeenCalled();
  });

  it('denies import review payloads during support override before reading raw rows', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.listImportReviewQueue(
        {},
        {
          ...actor,
          isSupportOverride: true,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.admissionImportRow.findMany).not.toHaveBeenCalled();
  });

  it('returns ownership audit data only through tenant and student scoped lookups without QR token hashes', async () => {
    const prisma = buildPrisma();
    const { service, auditService } = buildService(prisma);

    const result = await service.getOwnershipAudit('student-1', actor);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { id: 'student-1', tenantId: actor.tenantId },
      include: { class: true, sectionRef: true },
    });
    expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
      }),
    );
    expect(prisma.generatedStudentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
      }),
    );
    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          module: 'students',
          entityId: 'student-1',
          deletedAt: null,
        },
      }),
    );
    expect(prisma.studentQrCredential.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
      }),
    );
    expect(prisma.studentGuardian.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          studentId: 'student-1',
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          approvalStatus: 'APPROVED',
          effectiveFrom: { lte: expect.any(Date) },
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { effectiveUntil: null },
                { effectiveUntil: { gt: expect.any(Date) } },
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(result.qrAnalytics[0]).not.toHaveProperty('tokenHash');
    expect(result.policy).toEqual(
      expect.objectContaining({
        importHistoryRequiresTenantMatch: true,
        qrAnalyticsNeverReturnsTokenHash: true,
        guardianFileAccessRequiresActiveStudentGuardianLink: true,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'm1_access_scope_review',
        tenantId: actor.tenantId,
        resourceId: 'student-1',
      }),
    );
  });

  it('autosaves and recovers admission drafts through tenant-owned application rows', async () => {
    const prisma = buildPrisma({
      admissionApplicationFindFirst: null,
      studentFindMany: [],
    });
    const { service, auditService } = buildService(prisma);

    const saved = await service.autosaveAdmissionDraft(
      {
        draftKey: 'front-desk-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        dateOfBirth: '2020-01-02',
        guardianPhone: '980 000 0000',
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        previousSchool: 'Sunrise School',
        payload: { step: 'guardian' },
      },
      actor,
    );

    expect(prisma.admissionApplication.findFirst).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, source: 'autosave:front-desk-1' },
    });
    expect(prisma.admissionApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        source: 'autosave:front-desk-1',
        guardianPhone: '+9779800000000',
        duplicateReview: expect.objectContaining({ hasWarnings: false }),
      }),
    });
    expect(saved.draftKey).toBe('front-desk-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_draft_autosave_create',
        resource: 'admission_application',
        tenantId: actor.tenantId,
      }),
    );

    await service.recoverAdmissionDrafts(
      { guardianPhone: '980 000 0000', limit: 5 },
      actor,
    );

    expect(prisma.admissionApplication.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        status: { in: ['INQUIRY', 'APPLICATION', 'DOCUMENT_PENDING'] },
        source: { startsWith: 'autosave:' },
        guardianPhone: '+9779800000000',
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
    });
  });

  it('rejects autosave references that do not belong to the actor tenant', async () => {
    const prisma = buildPrisma({ sectionFindFirst: null });
    const { service } = buildService(prisma);

    await expect(
      service.autosaveAdmissionDraft(
        {
          draftKey: 'bad-section',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
          classId: 'class-1',
          sectionId: 'other-tenant-section',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.admissionApplication.create).not.toHaveBeenCalled();
  });

  it('scores enhanced duplicate review using Nepali names, guardian phones, DOB, previous school, and sibling clues within one tenant', async () => {
    const prisma = buildPrisma();
    prisma.student.findFirst.mockResolvedValueOnce(buildSibling());
    prisma.student.findMany.mockResolvedValueOnce([buildDuplicateCandidate()]);
    const { service, auditService } = buildService(prisma);

    const result = await service.enhancedDuplicateReview(
      {
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        firstNameNp: 'आशा',
        lastNameNp: 'तामाङ',
        dateOfBirth: '2020-01-02',
        guardianPhones: ['9800000000'],
        previousSchool: 'Sunrise School',
        siblingStudentSystemId: 'SCH-2026-0012',
      },
      actor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          studentSystemId: 'SCH-2026-0012',
        },
      }),
    );
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
        take: 100,
      }),
    );
    expect(result.hasWarnings).toBe(true);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-existing',
        riskLevel: 'HIGH',
        signals: expect.arrayContaining([
          expect.objectContaining({ code: 'english_name_dob' }),
          expect.objectContaining({ code: 'nepali_name_dob' }),
          expect.objectContaining({ code: 'guardian_phone_reuse' }),
          expect.objectContaining({ code: 'previous_school_match' }),
          expect.objectContaining({ code: 'sibling_group_clue' }),
        ]),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_duplicate_review_enhanced',
        tenantId: actor.tenantId,
      }),
    );
  });

  it('requires an explicit file-access review before guardian removal', async () => {
    const { service } = buildService(buildPrisma());

    await expect(
      service.removeGuardianAccess(
        'student-1',
        'guardian-1',
        {
          confirmFileAccessReview: false,
          reason: 'Guardian access review requested',
          evidenceReference: 'support-case-100',
        } as never,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('revokes guardian access with tenant-scoped mutation and records document history', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const { service, auditService } = buildService(prisma);

    const result = await service.removeGuardianAccess(
      'student-1',
      'guardian-1',
      {
        confirmFileAccessReview: true,
        reason: 'Guardian changed after admission review',
        evidenceReference: 'front-office-register-12',
        newPrimaryGuardianId: 'guardian-2',
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.studentGuardian.findFirst).not.toHaveBeenCalled();
    expect(tx.studentGuardian.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        status: 'ACTIVE',
        effectiveFrom: { lte: expect.any(Date) },
        AND: expect.any(Array),
      }),
      include: { guardian: true, student: true },
    });
    expect(tx.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'student-guardian-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        status: 'ACTIVE',
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
      data: {
        status: 'REVOKED',
        isPrimary: false,
        effectiveUntil: expect.any(Date),
        restrictionReasonRef: 'front-office-register-12',
      },
    });
    expect(tx.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'student-guardian-2',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-2',
        status: 'ACTIVE',
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
      data: { isPrimary: true },
    });
    expect(prisma.studentDocument.findMany).not.toHaveBeenCalled();
    expect(tx.studentDocument.findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, studentId: 'student-1' },
      select: { id: true, title: true, kind: true },
    });
    expect(tx.studentDocumentHistory.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: actor.tenantId,
          documentId: 'document-1',
          action: 'GUARDIAN_ACCESS_REVIEW',
          reason: 'Guardian changed after admission review',
          metadata: expect.objectContaining({
            relationshipRevoked: true,
            evidenceReference: 'front-office-register-12',
          }),
        }),
      ],
    });
    expect(result.accessReview).toEqual(
      expect.objectContaining({
        canAccessStudentFiles: false,
        documentsReviewed: 1,
        generatedDocumentsReviewed: 2,
        registryFilesReviewed: 3,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'guardian_revoked_file_access_review',
        tenantId: actor.tenantId,
        resourceId: 'student-guardian-1',
        after: expect.objectContaining({
          reason: 'Guardian changed after admission review',
          evidenceReference: 'front-office-register-12',
          replacementGuardianId: 'guardian-2',
        }),
      }),
      tx,
    );
  });

  it('rejects removal of the last currently active guardian inside the transaction', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    tx.studentGuardian.findMany.mockResolvedValueOnce([
      {
        id: 'student-guardian-1',
        guardianId: 'guardian-1',
        isPrimary: true,
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const { service, auditService } = buildService(prisma);

    await expect(
      service.removeGuardianAccess(
        'student-1',
        'guardian-1',
        {
          confirmFileAccessReview: true,
          reason: 'Guardian changed after admission review',
          evidenceReference: 'front-office-register-12',
        },
        actor,
      ),
    ).rejects.toThrow('A student must have at least one guardian.');

    expect(tx.studentDocument.findMany).not.toHaveBeenCalled();
    expect(tx.studentGuardian.updateMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a stale replacement guardian before revoking the current primary', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    tx.studentGuardian.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const { service, auditService } = buildService(prisma);

    await expect(
      service.removeGuardianAccess(
        'student-1',
        'guardian-1',
        {
          confirmFileAccessReview: true,
          reason: 'Guardian changed after admission review',
          evidenceReference: 'front-office-register-12',
          newPrimaryGuardianId: 'guardian-2',
        },
        actor,
      ),
    ).rejects.toThrow(
      'The replacement guardian changed while removal was being finalized',
    );

    expect(tx.studentGuardian.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.studentDocumentHistory.createMany).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rolls back guardian removal when the audit append fails', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const { service, auditService } = buildService(prisma);
    auditService.record.mockRejectedValueOnce(
      new Error('guardian removal audit unavailable'),
    );

    await expect(
      service.removeGuardianAccess(
        'student-1',
        'guardian-1',
        {
          confirmFileAccessReview: true,
          reason: 'Guardian changed after admission review',
          evidenceReference: 'front-office-register-12',
          newPrimaryGuardianId: 'guardian-2',
        },
        actor,
      ),
    ).rejects.toThrow('guardian removal audit unavailable');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'student-guardian-1' }),
      tx,
    );
  });

  it('maps guardian removal serialization conflicts to a bounded retry response', async () => {
    const prisma = buildPrisma();
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    const { service } = buildService(prisma);

    await expect(
      service.removeGuardianAccess(
        'student-1',
        'guardian-1',
        {
          confirmFileAccessReview: true,
          reason: 'Guardian changed after admission review',
          evidenceReference: 'front-office-register-12',
          newPrimaryGuardianId: 'guardian-2',
        },
        actor,
      ),
    ).rejects.toThrow(
      'Guardian access changed while removal was being finalized',
    );
  });

  it('generates ID cards through StudentsService and reads back tenant-owned generated metadata', async () => {
    const prisma = buildPrisma();
    const { service, studentsService } = buildService(prisma);

    const result = await service.generateIdCard('student-1', actor);

    expect(studentsService.generateStudentDocumentPdf).toHaveBeenCalledWith(
      'student-1',
      'ID_CARD',
      actor,
    );
    expect(prisma.generatedStudentDocument.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        kind: 'id-card',
      },
      orderBy: [{ generatedAt: 'desc' }],
    });
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'ID_CARD',
        workflowLabel: 'Student ID card generated',
        wording: 'Student Identity Card',
      }),
    );
  });

  it('lists import review rows with tenant-scoped queue filters and workflow labels', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    const result = await service.listImportReviewQueue({ limit: 10 }, actor);

    expect(prisma.admissionImportRow.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { status: 'FAILED' },
          { duplicates: expect.objectContaining({ not: undefined }) },
        ],
      },
      include: { batch: true },
      orderBy: [{ createdAt: 'desc' }, { rowNumber: 'asc' }],
      take: 10,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        workflowLabel: 'Needs correction before import',
        duplicates: [
          expect.objectContaining({ studentSystemId: 'SCH-2026-0001' }),
        ],
      }),
    );
  });

  it('summarizes iEMIS readiness from tenant-owned non-deleted student records', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    const result = await service.getIemisReadinessSummary(
      { classId: 'class-1', sectionId: 'section-1' },
      actor,
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          classId: 'class-1',
          sectionId: 'section-1',
          lifecycleStatus: {
            notIn: [
              StudentLifecycleStatus.DELETED,
              StudentLifecycleStatus.MERGED,
            ],
          },
        },
        take: 1000,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        ready: false,
        blockers: expect.arrayContaining(['iemis_disability_flag_missing']),
        warnings: expect.arrayContaining(['national_student_id_missing']),
      }),
    );
  });

  it('delegates graduation to the canonical tenant-safe alumni transition', async () => {
    const prisma = buildPrisma();
    const { service, auditService, studentsService } = buildService(prisma);

    const result = await service.graduateStudent(
      'student-1',
      {
        graduatedAt: '2026-04-30',
        reason: 'SEE completed',
      },
      actor,
    );

    expect(studentsService.archiveAlumni).toHaveBeenCalledWith(
      'student-1',
      { reason: 'SEE completed', exitedAt: '2026-04-30' },
      actor,
      { auditAction: 'graduate_to_alumni' },
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.alumniState).toBe('ALUMNI');
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

function buildService(prisma = buildPrisma()) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const studentsService = {
    generateStudentDocumentPdf: jest.fn().mockResolvedValue(undefined),
    requestTransfer: jest.fn().mockResolvedValue(undefined),
    archiveAlumni: jest.fn().mockResolvedValue({
      id: 'student-1',
      studentSystemId: 'SCH-2026-0001',
      lifecycleStatus: StudentLifecycleStatus.ALUMNI,
      exitedAt: new Date('2026-04-30T00:00:00.000Z'),
    }),
  };
  const service = new M1AdmissionsHardeningService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    studentsService as unknown as StudentsService,
  );

  return { service, auditService, studentsService };
}

function buildPrisma(overrides: Partial<PrismaMockOptions> = {}) {
  const tx = buildTransaction();
  return {
    student: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          hasOverride(overrides, 'studentFindFirst')
            ? overrides.studentFindFirst
            : buildStudent(),
        ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          hasOverride(overrides, 'studentFindMany')
            ? overrides.studentFindMany
            : [buildIemisStudent()],
        ),
      update: jest.fn().mockResolvedValue({
        ...buildStudent(),
        lifecycleStatus: StudentLifecycleStatus.ALUMNI,
        exitedAt: new Date('2026-04-30T00:00:00.000Z'),
      }),
    },
    studentDocument: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'document-1',
          fileId: 'file-1',
          kind: 'BIRTH_CERTIFICATE',
          status: 'ACTIVE',
          objectKey: 'tenant-1/students/student-1/birth.pdf',
          uploadedById: 'user-1',
          title: 'Birth certificate',
        },
      ]),
    },
    generatedStudentDocument: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'generated-1',
          kind: 'ID_CARD',
          title: 'Student Identity Card',
          storageObjectKey: 'tenant-1/students/student-1/id-card.pdf',
          revokedAt: null,
          generatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ]),
      count: jest.fn().mockResolvedValue(2),
      findFirst: jest.fn().mockResolvedValue(buildGeneratedDocument()),
    },
    fileAsset: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'file-1',
          originalFilename: 'birth.pdf',
          objectKey: 'tenant-1/students/student-1/birth.pdf',
          ownerType: 'student',
          ownerId: 'student-1',
          visibility: 'PRIVATE',
          status: 'UPLOADED',
        },
      ]),
      count: jest.fn().mockResolvedValue(3),
    },
    studentQrCredential: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'qr-1',
          status: 'ACTIVE',
          tokenHash: 'must-not-leak',
          expiresAt: new Date('2026-05-01T00:00:00.000Z'),
          lastScannedAt: new Date('2026-04-02T00:00:00.000Z'),
          revokedAt: null,
          rotatedAt: null,
        },
      ]),
    },
    studentGuardian: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'student-guardian-1',
          guardianId: 'guardian-1',
          relation: 'mother',
          isPrimary: true,
          guardian: buildGuardian(),
        },
        {
          id: 'student-guardian-2',
          guardianId: 'guardian-2',
          relation: 'father',
          isPrimary: false,
          guardian: { ...buildGuardian(), id: 'guardian-2' },
        },
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-guardian-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        relation: 'mother',
        isPrimary: true,
        guardian: buildGuardian(),
        student: buildStudent(),
      }),
    },
    academicYear: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          hasOverride(overrides, 'academicYearFindFirst')
            ? overrides.academicYearFindFirst
            : { id: 'ay-1' },
        ),
    },
    class: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          hasOverride(overrides, 'classFindFirst')
            ? overrides.classFindFirst
            : { id: 'class-1' },
        ),
    },
    section: {
      findFirst: jest.fn().mockResolvedValue(
        hasOverride(overrides, 'sectionFindFirst')
          ? overrides.sectionFindFirst
          : {
              id: 'section-1',
              classId: 'class-1',
            },
      ),
    },
    guardian: {
      findMany: jest.fn().mockResolvedValue([buildGuardianWithLinks()]),
    },
    admissionApplication: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          hasOverride(overrides, 'admissionApplicationFindFirst')
            ? overrides.admissionApplicationFindFirst
            : buildDraftApplication(),
        ),
      create: jest.fn().mockResolvedValue(buildDraftApplication()),
      update: jest.fn().mockResolvedValue(buildDraftApplication()),
      findMany: jest.fn().mockResolvedValue([buildDraftApplication()]),
    },
    admissionImportRow: {
      findMany: jest.fn().mockResolvedValue([buildImportRow()]),
    },
    enrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
}

function hasOverride(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function buildTransaction() {
  return {
    studentGuardian: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'student-guardian-1',
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        relation: 'mother',
        isPrimary: true,
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveUntil: null,
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        guardian: buildGuardian(),
        student: buildStudent(),
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'student-guardian-1',
          guardianId: 'guardian-1',
          isPrimary: true,
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        {
          id: 'student-guardian-2',
          guardianId: 'guardian-2',
          isPrimary: false,
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentDocument: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'document-1',
          title: 'Birth certificate',
          kind: 'BIRTH_CERTIFICATE',
        },
      ]),
    },
    generatedStudentDocument: {
      count: jest.fn().mockResolvedValue(2),
    },
    fileAsset: {
      count: jest.fn().mockResolvedValue(3),
    },
    studentDocumentHistory: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    enrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
    },
    student: {
      update: jest.fn().mockResolvedValue({
        ...buildStudent(),
        lifecycleStatus: StudentLifecycleStatus.ALUMNI,
        exitedAt: new Date('2026-04-30T00:00:00.000Z'),
      }),
    },
  };
}

function buildStudent() {
  return {
    id: 'student-1',
    tenantId: actor.tenantId,
    studentSystemId: 'SCH-2026-0001',
    firstNameEn: 'Asha',
    lastNameEn: 'Tamang',
    firstNameNp: 'आशा',
    lastNameNp: 'तामाङ',
    dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
    gender: 'FEMALE',
    admissionDate: new Date('2026-04-01T00:00:00.000Z'),
    classId: 'class-1',
    sectionId: 'section-1',
    section: null,
    lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    previousSchool: 'Sunrise School',
    class: { id: 'class-1', name: 'Class 1' },
    sectionRef: { id: 'section-1', name: 'A' },
  };
}

function buildIemisStudent() {
  return {
    ...buildStudent(),
    disabilityFlag: null,
    nationalStudentId: null,
    guardianLinks: [{ guardian: buildGuardian() }],
    enrollments: [{ id: 'enrollment-1', status: EnrollmentStatus.ACTIVE }],
  };
}

function buildGuardian() {
  return {
    id: 'guardian-1',
    tenantId: actor.tenantId,
    fullName: 'Maya Tamang',
    relation: 'mother',
    primaryPhone: '9800000000',
    secondaryPhone: null,
  };
}

function buildGuardianWithLinks() {
  return {
    ...buildGuardian(),
    studentLinks: [
      {
        relation: 'mother',
        student: buildStudent(),
      },
    ],
  };
}

function buildSibling() {
  return {
    ...buildStudent(),
    id: 'sibling-1',
    studentSystemId: 'SCH-2026-0012',
    guardianLinks: [{ guardian: buildGuardian() }],
    siblingMemberships: [{ siblingGroupId: 'sibling-group-1' }],
  };
}

function buildDuplicateCandidate() {
  return {
    ...buildStudent(),
    id: 'student-existing',
    studentSystemId: 'SCH-2026-0007',
    guardianLinks: [{ guardian: buildGuardian() }],
    siblingMemberships: [{ siblingGroupId: 'sibling-group-1' }],
  };
}

function buildDraftApplication() {
  return {
    id: 'application-1',
    tenantId: actor.tenantId,
    status: 'INQUIRY',
    firstNameEn: 'Asha',
    lastNameEn: 'Tamang',
    firstNameNp: null,
    lastNameNp: null,
    dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
    guardianFullName: 'Maya Tamang',
    guardianPhone: '980 000 0000',
    academicYearId: 'ay-1',
    classId: 'class-1',
    sectionId: 'section-1',
    previousSchool: 'Sunrise School',
    source: 'autosave:front-desk-1',
    notes: JSON.stringify({ payload: { step: 'guardian' } }),
    duplicateReview: { hasWarnings: false, matches: [] },
    convertedStudentId: null,
    rejectedReason: null,
    createdById: actor.userId,
    updatedById: actor.userId,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
  };
}

function buildGeneratedDocument() {
  return {
    id: 'generated-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    kind: 'ID_CARD',
    title: 'Student Identity Card',
    fileName: 'student-id-card.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    pdfUrl: '/files/generated-1',
    generatedById: actor.userId,
    storageObjectKey: 'tenant-1/students/student-1/id-card.pdf',
    checksumSha256: 'checksum',
    signedAt: null,
    signatureMetadata: null,
    version: 1,
    retentionUntil: null,
    revokedAt: null,
    revokedById: null,
    generatedAt: new Date('2026-04-03T00:00:00.000Z'),
    metadata: null,
  };
}

function buildImportRow() {
  return {
    id: 'import-row-1',
    tenantId: actor.tenantId,
    batchId: 'import-batch-1',
    rowNumber: 2,
    status: 'FAILED',
    errors: ['Possible duplicate admission found'],
    duplicates: [{ studentSystemId: 'SCH-2026-0001' }],
    rawData: { firstNameEn: 'Asha' },
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    batch: {
      id: 'import-batch-1',
      tenantId: actor.tenantId,
      sourceFileName: 'admissions.csv',
    },
  };
}

interface PrismaMockOptions {
  studentFindFirst: unknown;
  studentFindMany: unknown[];
  academicYearFindFirst: unknown;
  classFindFirst: unknown;
  sectionFindFirst: unknown;
  admissionApplicationFindFirst: unknown;
}
