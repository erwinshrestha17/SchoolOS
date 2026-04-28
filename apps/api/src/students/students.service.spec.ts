import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthMethod,
  EnrollmentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { StudentsService } from './students.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: [
    'students:read',
    'students:manage_lifecycle',
    'students:delete',
    'student_documents:manage',
    'guardians:verify',
  ],
};

describe('students lifecycle hardening', () => {
  it('transfers an active student and records an immutable transition', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const updatedStudent = {
      ...student,
      lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
      exitedAt: new Date('2026-04-27T00:00:00.000Z'),
      destinationSchool: 'New Horizon School',
      conductRemark: 'Good standing',
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
      transactionStudentUpdateResult: updatedStudent,
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.requestTransfer(
      student.id,
      {
        reason: 'Family relocation',
        destinationSchool: 'New Horizon School',
        conductRemark: 'Good standing',
        exitedAt: '2026-04-27',
      },
      actor,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.transaction.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: EnrollmentStatus.ACTIVE,
      },
      data: {
        status: EnrollmentStatus.TRANSFERRED,
      },
    });
    expect(prisma.studentLifecycleTransition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.TRANSFERRED,
        reason: 'Family relocation',
        changedById: actor.userId,
        feeClearanceWaived: false,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'transfer',
        resource: 'student',
        resourceId: student.id,
      }),
    );
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.TRANSFERRED);
  });

  it('blocks invalid lifecycle transitions', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.TRANSFERRED,
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
    });
    const { service } = buildService(prisma);

    await expect(
      service.requestTransfer(
        student.id,
        {
          reason: 'Duplicate transfer request',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('soft deletes students without removing finance or document history', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const deletedStudent = {
      ...student,
      lifecycleStatus: StudentLifecycleStatus.DELETED,
      exitedAt: new Date('2026-04-27T00:00:00.000Z'),
      exitReason: 'Merged duplicate record',
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[]],
      transactionStudentUpdateResult: deletedStudent,
    });
    const { service } = buildService(prisma);

    const result = await service.deleteStudent(
      student.id,
      {
        reason: 'Merged duplicate record',
        deletedAt: '2026-04-27',
      },
      actor,
    );

    expect(prisma.transaction.student.update).toHaveBeenCalledWith({
      where: { id: student.id },
      data: {
        lifecycleStatus: StudentLifecycleStatus.DELETED,
        exitReason: 'Merged duplicate record',
        exitedAt: new Date('2026-04-27T00:00:00.000Z'),
      },
    });
    expect('delete' in prisma.student).toBe(false);
    expect(result.lifecycleStatus).toBe(StudentLifecycleStatus.DELETED);
  });

  it('merges an active duplicate into a canonical student and soft-deletes the source', async () => {
    const sourceStudent = buildStudent({
      id: 'student-source',
      studentSystemId: 'SCH-2026-0002',
      guardianLinks: [
        {
          guardianId: 'guardian-source',
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
          appLoginLinked: false,
        },
      ],
    });
    const targetStudent = buildStudent({
      id: 'student-target',
      studentSystemId: 'SCH-2026-0001',
      guardianLinks: [],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [sourceStudent, targetStudent],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.mergeDuplicateStudent(
      {
        sourceStudentId: sourceStudent.id,
        targetStudentId: targetStudent.id,
        reason: 'Duplicate record confirmed by registrar',
      },
      actor,
    );

    expect(prisma.transaction.studentGuardian.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: actor.tenantId,
          studentId: targetStudent.id,
          guardianId: 'guardian-source',
          relation: 'mother',
          isPrimary: true,
          appLoginLinked: false,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.transaction.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: sourceStudent.id,
      },
      data: { studentId: targetStudent.id },
    });
    expect(prisma.transaction.student.update).toHaveBeenCalledWith({
      where: { id: sourceStudent.id },
      data: {
        lifecycleStatus: StudentLifecycleStatus.DELETED,
        exitReason: 'Duplicate record confirmed by registrar',
        exitedAt: expect.any(Date),
      },
    });
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: sourceStudent.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.DELETED,
        reason: 'Duplicate record confirmed by registrar',
        changedById: actor.userId,
        metadata: expect.objectContaining({
          mergeType: 'duplicate_student_merge',
          mergedIntoStudentId: targetStudent.id,
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'merge_duplicate',
        resource: 'student',
        resourceId: sourceStudent.id,
      }),
    );
    expect(result.sourceStudent.lifecycleStatus).toBe(
      StudentLifecycleStatus.DELETED,
    );
  });

  it('rejects duplicate merge when identity evidence does not match', async () => {
    const sourceStudent = buildStudent({
      id: 'student-source',
      firstNameEn: 'Erwin',
    });
    const targetStudent = buildStudent({
      id: 'student-target',
      firstNameEn: 'Sita',
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [sourceStudent, targetStudent],
    });
    const { service } = buildService(prisma);

    await expect(
      service.mergeDuplicateStudent(
        {
          sourceStudentId: sourceStudent.id,
          targetStudentId: targetStudent.id,
          reason: 'Mistaken duplicate',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns validation-first iEMIS export results', async () => {
    const validStudent = buildStudent({
      id: 'student-valid',
      studentSystemId: 'SCH-2026-0001',
      firstNameNp: 'एरविन',
      lastNameNp: 'श्रेष्ठ',
      section: 'A',
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
      enrollments: [
        {
          academicYear: { name: '2083' },
          classId: 'class-1',
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });
    const invalidStudent = buildStudent({
      id: 'student-invalid',
      studentSystemId: 'SCH-2026-0002',
      firstNameNp: null,
      lastNameNp: null,
      section: null,
      sectionRef: null,
      lifecycleStatus: StudentLifecycleStatus.DELETED,
      guardianLinks: [],
      enrollments: [],
    });
    const prisma = buildPrisma({
      studentFindManyResult: [validStudent, invalidStudent],
    });
    const { service } = buildService(prisma);

    const result = await service.exportIemis(actor);

    expect(result.formatVersion).toBe('SCHOLOS-IEMIS-1.0');
    expect(result.totalRecords).toBe(2);
    expect(result.validRecords).toBe(1);
    expect(result.invalidRecords).toBe(1);
    expect(result.headers).toContain('studentSystemId');
    expect(result.csv).toContain('SCH-2026-0001');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentSystemId).toBe('SCH-2026-0001');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'fullNameNp',
        }),
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'guardianContact',
        }),
        expect.objectContaining({
          studentId: 'student-invalid',
          field: 'lifecycleStatus',
        }),
      ]),
    );
  });

  it('persists signed metadata when generating student documents', async () => {
    const student = buildStudent({
      guardianLinks: [
        {
          guardian: {
            fullName: 'Maya Shrestha',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: '5',
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
      enrollments: [
        {
          academicYear: { name: '2083' },
          classId: 'class-1',
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    });
    const latestVersion = { version: 2 };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [latestVersion],
    });
    const { service, storageService } = buildService(prisma);

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'enrollment-confirmation',
      actor,
    );

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(storageService.saveBufferObject).toHaveBeenCalledWith({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/generated-documents/enrollment-confirmation`,
      fileName: `${student.studentSystemId}-enrollment-confirmation.pdf`,
      contentType: 'application/pdf',
      content: expect.any(Buffer),
    });
    expect(
      prisma.transaction.generatedStudentDocument.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: 'enrollment-confirmation',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedById: actor.userId,
      },
    });
    expect(
      prisma.transaction.generatedStudentDocument.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: 'enrollment-confirmation',
        generatedById: actor.userId,
        pdfUrl: '/storage/generated-doc.pdf',
        storageObjectKey: `tenant-1/students/${student.id}/generated-documents/enrollment-confirmation/generated-doc.pdf`,
        checksumSha256: expect.any(String),
        signedAt: expect.any(Date),
        signatureMetadata: expect.objectContaining({
          issuerUserId: actor.userId,
          tenantSlug: actor.tenantSlug,
          mode: 'internal-issued',
          storageProvider: 'LOCAL',
        }),
        version: 3,
        retentionUntil: expect.any(Date),
      }),
    });
  });

  it('blocks revoking generated documents before retention expiry', async () => {
    const student = buildStudent();
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [
        {
          id: 'doc-1',
          tenantId: actor.tenantId,
          studentId: student.id,
          kind: 'transfer-certificate',
          fileName: 'doc.pdf',
          revokedAt: null,
          retentionUntil: new Date('2099-01-01T00:00:00.000Z'),
          metadata: {},
        },
      ],
    });
    const { service } = buildService(prisma);

    await expect(
      service.revokeGeneratedStudentDocument(
        student.id,
        'doc-1',
        { reason: 'Superseded' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('marks expired revoked generated documents as purge-eligible without deleting them', async () => {
    const expiredDocument = {
      id: 'doc-expired',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'id-card',
      metadata: { previous: true },
      revokedAt: new Date('2026-01-01T00:00:00.000Z'),
      retentionUntil: new Date('2026-02-01T00:00:00.000Z'),
    };
    const alreadyMarkedDocument = {
      ...expiredDocument,
      id: 'doc-marked',
      metadata: { retentionStatus: 'eligible_for_purge' },
    };
    const prisma = buildPrisma({
      generatedStudentDocumentFindManyResult: [
        expiredDocument,
        alreadyMarkedDocument,
      ],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.processGeneratedDocumentRetention(
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result).toEqual({
      reviewedAt: '2026-03-01T00:00:00.000Z',
      eligibleDocuments: 2,
      markedDocuments: 1,
    });
    expect(prisma.generatedStudentDocument.update).toHaveBeenCalledWith({
      where: { id: expiredDocument.id },
      data: {
        metadata: {
          previous: true,
          retentionStatus: 'eligible_for_purge',
          retentionReviewedAt: '2026-03-01T00:00:00.000Z',
        },
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retention_mark_eligible',
        resource: 'generated_student_document',
        userId: null,
        resourceId: expiredDocument.id,
      }),
    );
  });

  it('creates and approves guardian identity verification records with audit history', async () => {
    const guardian = {
      id: 'guardian-1',
      tenantId: actor.tenantId,
      fullName: 'Maya Shrestha',
    };
    const evidenceDocument = {
      id: 'document-1',
      tenantId: actor.tenantId,
    };
    const createdVerification = {
      id: 'verification-1',
      tenantId: actor.tenantId,
      guardianId: guardian.id,
      status: 'PENDING',
      documentType: 'citizenship',
      documentNumber: '12-34-56',
      evidenceDocumentId: evidenceDocument.id,
    };
    const reviewedVerification = {
      ...createdVerification,
      status: 'VERIFIED',
      reviewedById: actor.userId,
      reviewedAt: new Date('2026-04-28T00:00:00.000Z'),
      reviewNote: 'Document matches guardian profile',
    };
    const prisma = buildPrisma({
      guardianFindFirstQueue: [guardian, guardian],
      studentDocumentFindFirstQueue: [evidenceDocument],
      guardianIdentityVerificationCreateResult: createdVerification,
      guardianIdentityVerificationFindFirstQueue: [createdVerification],
      transactionGuardianIdentityVerificationUpdateResult: reviewedVerification,
    });
    const { service, auditService } = buildService(prisma);

    const created = await service.createGuardianIdentityVerification(
      guardian.id,
      {
        documentType: 'citizenship',
        documentNumber: '12-34-56',
        evidenceDocumentId: evidenceDocument.id,
      },
      actor,
    );
    const reviewed = await service.reviewGuardianIdentityVerification(
      guardian.id,
      createdVerification.id,
      {
        status: 'VERIFIED',
        reviewNote: 'Document matches guardian profile',
      },
      actor,
    );

    expect(created.status).toBe('PENDING');
    expect(prisma.guardianIdentityVerification.create).toHaveBeenCalledWith({
      data: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        status: 'PENDING',
        documentType: 'citizenship',
        documentNumber: '12-34-56',
        evidenceDocumentId: evidenceDocument.id,
        notes: null,
        submittedById: actor.userId,
      },
    });
    expect(
      prisma.transaction.guardianIdentityVerification.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        guardianId: guardian.id,
        status: 'VERIFIED',
        id: { not: createdVerification.id },
      },
      data: expect.objectContaining({
        status: 'REVOKED',
        reviewedById: actor.userId,
      }),
    });
    expect(reviewed.status).toBe('VERIFIED');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'review',
        resource: 'guardian_identity_verification',
        resourceId: reviewedVerification.id,
      }),
    );
  });

  it('requires fee clearance before transfer when no waiver is provided', async () => {
    const student = buildStudent({
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    });
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1',
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(1000),
      dueDate: new Date('2026-05-01T00:00:00.000Z'),
      payments: [],
    };
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      invoiceFindManyQueue: [[invoice]],
    });
    const { service } = buildService(prisma);

    await expect(
      service.requestTransfer(
        student.id,
        { reason: 'Relocating family' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing students in tenant-scoped operations', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    await expect(service.getFeeClearance('missing', actor)).rejects.toThrow(
      NotFoundException,
    );
  });
});

function buildStudent(
  overrides: Partial<{
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameNp: string | null;
    lastNameNp: string | null;
    dateOfBirth: Date;
    gender: string;
    nationality: string | null;
    motherTongue: string | null;
    ethnicity: string | null;
    disabilityFlag: string | null;
    admissionDate: Date;
    admissionNumber: string | null;
    lifecycleStatus: StudentLifecycleStatus;
    classId: string;
    class: { id: string; name: string };
    section: string | null;
    sectionRef: { id: string; name: string } | null;
    rollNumber: number | null;
    guardianLinks: Array<{
      guardianId?: string;
      guardian: {
        fullName: string;
        primaryPhone: string | null;
        email: string | null;
        wardNumber: string | null;
      };
      relation: string;
      isPrimary: boolean;
      appLoginLinked?: boolean;
    }>;
    enrollments: Array<{
      academicYear: { name: string };
      classId: string;
      section: { name: string } | null;
      status: EnrollmentStatus;
    }>;
    tenant: { name: string };
  }> = {},
) {
  return {
    id: overrides.id ?? 'student-1',
    tenantId: actor.tenantId,
    studentSystemId: overrides.studentSystemId ?? 'SCH-2026-0001',
    firstNameEn: overrides.firstNameEn ?? 'Erwin',
    lastNameEn: overrides.lastNameEn ?? 'Shrestha',
    firstNameNp: 'firstNameNp' in overrides ? overrides.firstNameNp : 'एरविन',
    lastNameNp: 'lastNameNp' in overrides ? overrides.lastNameNp : 'श्रेष्ठ',
    dateOfBirth: overrides.dateOfBirth ?? new Date('2016-01-02T00:00:00.000Z'),
    gender: overrides.gender ?? 'MALE',
    nationality: overrides.nationality ?? 'Nepali',
    motherTongue: overrides.motherTongue ?? 'Nepali',
    ethnicity: overrides.ethnicity ?? 'Brahmin',
    disabilityFlag: overrides.disabilityFlag ?? null,
    admissionDate:
      overrides.admissionDate ?? new Date('2026-04-01T00:00:00.000Z'),
    admissionNumber: overrides.admissionNumber ?? 'ADM-1',
    lifecycleStatus: overrides.lifecycleStatus ?? StudentLifecycleStatus.ACTIVE,
    classId: overrides.classId ?? 'class-1',
    class: overrides.class ?? { id: 'class-1', name: 'Grade 1' },
    section: 'section' in overrides ? overrides.section : 'A',
    sectionRef:
      'sectionRef' in overrides
        ? overrides.sectionRef
        : { id: 'section-1', name: 'A' },
    rollNumber: overrides.rollNumber ?? 7,
    destinationSchool: null,
    conductRemark: null,
    exitedAt: null,
    exitReason: null,
    feeClearanceWaivedAt: null,
    guardianLinks: overrides.guardianLinks ?? [],
    enrollments: overrides.enrollments ?? [],
    tenant: overrides.tenant ?? { name: 'Everest Academy' },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const usersService = {
    createManagedUser: jest.fn(),
  };
  const communicationsService = {
    recordDeliveryRecords: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const storageService = {
    saveBufferObject: jest.fn(async (input: { prefix: string }) => ({
      provider: 'LOCAL',
      objectKey: `tenant-1/${input.prefix}/generated-doc.pdf`,
      publicUrl: '/storage/generated-doc.pdf',
      sizeBytes: 512,
    })),
  };

  return {
    service: new StudentsService(
      prisma as never,
      usersService as never,
      communicationsService as never,
      auditService as never,
      storageService as never,
    ),
    prisma,
    auditService,
    storageService,
  };
}

function buildPrisma(options: {
  studentFindFirstQueue?: unknown[];
  studentFindManyResult?: unknown[];
  guardianFindFirstQueue?: unknown[];
  studentDocumentFindFirstQueue?: unknown[];
  invoiceFindManyQueue?: unknown[];
  generatedStudentDocumentFindFirstQueue?: unknown[];
  generatedStudentDocumentFindManyResult?: unknown[];
  guardianIdentityVerificationCreateResult?: unknown;
  guardianIdentityVerificationFindFirstQueue?: unknown[];
  transactionGuardianIdentityVerificationUpdateResult?: unknown;
  transactionStudentUpdateResult?: unknown;
}) {
  const transaction = {
    enrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    student: {
      update: jest
        .fn()
        .mockResolvedValue(options.transactionStudentUpdateResult ?? null),
    },
    studentGuardian: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentDocument: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    generatedStudentDocument: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'doc-created' }),
    },
    invoice: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    feeWaiver: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationDelivery: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    developmentalMilestone: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    moodLog: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    libraryIssue: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    transportEnrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    transportLog: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    conversation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    conversationParticipant: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-merge' }),
    },
    guardianIdentityVerification: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockResolvedValue(
          options.transactionGuardianIdentityVerificationUpdateResult ?? null,
        ),
    },
  };

  const prisma = {
    student: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.studentFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentFindManyResult ?? []),
    },
    guardian: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.guardianFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
    },
    studentDocument: {
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.studentDocumentFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
    },
    invoice: {
      findMany: jest
        .fn()
        .mockImplementation(
          async () => options.invoiceFindManyQueue?.shift() ?? [],
        ),
    },
    generatedStudentDocument: {
      findFirst: jest
        .fn()
        .mockImplementation(
          async () =>
            options.generatedStudentDocumentFindFirstQueue?.shift() ?? null,
        ),
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.generatedStudentDocumentFindManyResult ?? [],
        ),
      update: jest.fn(),
    },
    guardianIdentityVerification: {
      create: jest
        .fn()
        .mockResolvedValue(options.guardianIdentityVerificationCreateResult),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(async () => {
        const queue = options.guardianIdentityVerificationFindFirstQueue ?? [];

        if (queue.length === 0) {
          return null;
        }

        if (queue.length === 1) {
          return queue[0];
        }

        return queue.shift();
      }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
    },
    $transaction: jest
      .fn()
      .mockImplementation(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    transaction,
  };

  return prisma;
}
