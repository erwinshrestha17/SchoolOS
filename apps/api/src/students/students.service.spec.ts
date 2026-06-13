import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
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
    'students:update',
    'students:manage_lifecycle',
    'students:delete',
    'guardians:update',
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
    expect(prisma.transaction.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sourceStudent.id },
        data: expect.objectContaining({
          lifecycleStatus: StudentLifecycleStatus.MERGED,
          exitReason: `Merged into ${targetStudent.studentSystemId}: Duplicate record confirmed by registrar`,
        }),
      }),
    );
    expect(
      prisma.transaction.studentLifecycleTransition.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: sourceStudent.id,
        fromStatus: StudentLifecycleStatus.ACTIVE,
        toStatus: StudentLifecycleStatus.MERGED,
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
      StudentLifecycleStatus.MERGED,
    );
  });

  it('rejects duplicate merge when identity evidence does not match', async () => {
    const sourceStudent = buildStudent({
      id: 'student-source',
      firstNameEn: 'Erwin',
    });
    const targetStudent = buildStudent({
      id: 'student-target',
      studentSystemId: 'SCH-2026-9999',
      firstNameEn: 'Sita',
      dateOfBirth: new Date('2014-01-02T00:00:00.000Z'),
      admissionNumber: 'ADM-9999',
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

  it('rejects attempts to edit immutable student system IDs', async () => {
    const prisma = buildPrisma({});
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        'student-1',
        { studentSystemId: 'SCH-2026-9999' } as never,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });

  it('updates mutable student fields with tenant-scoped placement checks and audit logging', async () => {
    const student = buildStudent({
      disabilityFlag: null,
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
          rollNumber: 7,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    });
    const updatedProfileStudent = buildStudent({
      ...student,
      firstNameEn: 'Aarav',
      disabilityFlag: 'No known disability',
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student, updatedProfileStudent],
      classFindFirstResult: { id: 'class-1', tenantId: actor.tenantId },
      sectionFindFirstResult: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
        name: 'A',
      },
      enrollmentFindFirstResult: null,
      activityPostFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    await service.updateStudent(
      student.id,
      {
        firstNameEn: 'Aarav',
        disabilityFlag: 'No known disability',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 8,
      },
      actor,
    );

    expect(prisma.class.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'class-1',
        tenantId: actor.tenantId,
      },
    });
    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
      },
    });
    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: 8,
          studentId: { not: student.id },
        }),
      }),
    );
    expect(prisma.transaction.student.update).toHaveBeenCalledWith({
      where: { id: student.id },
      data: expect.objectContaining({
        firstNameEn: 'Aarav',
        disabilityFlag: 'No known disability',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 8,
      }),
    });
    expect(prisma.transaction.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: expect.objectContaining({
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 8,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'student',
        tenantId: actor.tenantId,
        resourceId: student.id,
      }),
    );
  });

  it('blocks roll number conflicts during student placement updates', async () => {
    const student = buildStudent({
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
          status: EnrollmentStatus.ACTIVE,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      classFindFirstResult: { id: 'class-1', tenantId: actor.tenantId },
      sectionFindFirstResult: {
        id: 'section-1',
        tenantId: actor.tenantId,
        classId: 'class-1',
        name: 'A',
      },
      enrollmentFindFirstResult: {
        id: 'enrollment-conflict',
        studentId: 'student-2',
        rollNumber: 7,
        student: {
          studentSystemId: 'SCH-2026-0002',
          firstNameEn: 'Sita',
          lastNameEn: 'Rai',
        },
        class: { name: 'Grade 1' },
        section: { name: 'A' },
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        student.id,
        {
          rollNumber: 7,
          confirmNoDisability: true,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates linked guardians through the student relationship with audit logging', async () => {
    const link = {
      id: 'student-guardian-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relation: 'mother',
      isPrimary: false,
      guardian: {
        id: 'guardian-1',
        fullName: 'Maya Shrestha',
        relation: 'mother',
        primaryPhone: '9800000000',
        secondaryPhone: null,
        email: 'maya@example.com',
        occupation: null,
        homeAddress: null,
        wardNumber: null,
      },
    };
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: link,
      guardianFindFirstQueue: [null],
      studentFindFirstQueue: [
        buildStudent({
          guardianLinks: [
            {
              guardianId: 'guardian-1',
              guardian: {
                id: 'guardian-1',
                fullName: 'Maya Shrestha',
                relation: 'mother',
                primaryPhone: '9811111111',
                email: 'maya@example.com',
                wardNumber: null,
              },
              relation: 'mother',
              isPrimary: true,
            },
          ],
        }),
      ],
      activityPostFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    await service.updateStudentGuardian(
      'student-1',
      'guardian-1',
      {
        primaryPhone: '9811111111',
        isPrimary: true,
      },
      actor,
    );

    expect(prisma.studentGuardian.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
      },
      include: {
        guardian: true,
      },
    });
    expect(prisma.transaction.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentId: 'student-1',
        id: { not: link.id },
      },
      data: { isPrimary: false },
    });
    expect(prisma.transaction.guardian.update).toHaveBeenCalledWith({
      where: { id: 'guardian-1' },
      data: {
        primaryPhone: '9811111111',
      },
    });
    expect(prisma.transaction.studentGuardian.update).toHaveBeenCalledWith({
      where: { id: link.id },
      data: { isPrimary: true },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        resource: 'student_guardian',
        tenantId: actor.tenantId,
        resourceId: link.id,
      }),
    );
  });

  it('rejects guardian updates that are not linked to the tenant-scoped student', async () => {
    const prisma = buildPrisma({
      studentGuardianFindFirstResult: null,
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudentGuardian(
        'student-1',
        'guardian-other-tenant',
        { primaryPhone: '9811111111' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
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
    const { service, storageService, fileRegistryService } =
      buildService(prisma);

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'enrollment-confirmation',
      actor,
    );

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
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
        pdfUrl: `/api/v1/students/${student.id}/documents/enrollment-confirmation.pdf`,
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
    expect(fileRegistryService.markUploaded).toHaveBeenCalledWith(
      actor.tenantId,
      'generated-file-asset',
      actor.userId,
    );
  });

  it('generates student ID cards with opaque QR payload support', async () => {
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
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      generatedStudentDocumentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    const pdf = await service.generateStudentDocumentPdf(
      student.id,
      'id-card',
      {
        ...actor,
        qrToken: 'schoolos_qr_opaque_test_token',
      } as typeof actor & { qrToken: string },
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('tokenHash');
    expect(pdf.toString('latin1')).not.toContain('student-1:tenant-1');
  });

  it('returns a clean validation error for unsupported student document kinds', async () => {
    const prisma = buildPrisma({});
    const { service } = buildService(prisma);

    await expect(
      service.generateStudentDocumentPdf('student-1', 'unsupported', actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a tenant-scoped student profile detail payload', async () => {
    const student = buildStudent({
      guardianLinks: [
        {
          guardian: {
            id: 'guardian-1',
            fullName: 'Maya Shrestha',
            relation: 'mother',
            primaryPhone: '9800000000',
            email: 'maya@example.com',
            wardNumber: null,
          },
          relation: 'mother',
          isPrimary: true,
        },
      ],
      documents: [
        {
          id: 'document-1',
          studentId: 'student-1',
          kind: 'BIRTH_CERTIFICATE',
          title: 'Birth certificate',
          fileName: 'birth.pdf',
          contentType: 'application/pdf',
          sizeBytes: 128,
          provider: 'LOCAL',
          objectKey: 'tenant-1/students/student-1/birth.pdf',
          publicUrl: null,
          createdAt: new Date('2026-04-27T00:00:00.000Z'),
        },
      ],
      generatedDocuments: [
        {
          id: 'generated-1',
          studentId: 'student-1',
          kind: 'id-card',
          title: 'Student ID Card',
          fileName: 'SCH-2026-0001-id-card.pdf',
          contentType: 'application/pdf',
          sizeBytes: 512,
          pdfUrl: '/api/v1/students/student-1/documents/id-card.pdf',
          generatedById: actor.userId,
          generatedAt: new Date('2026-04-27T00:00:00.000Z'),
          checksumSha256: 'checksum',
          storageObjectKey: 'tenant-1/students/student-1/generated.pdf',
          signedAt: new Date('2026-04-27T00:00:00.000Z'),
          version: 1,
          retentionUntil: new Date('2026-10-27T00:00:00.000Z'),
          revokedAt: null,
        },
      ],
      enrollments: [
        {
          id: 'enrollment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: 7,
          status: EnrollmentStatus.ACTIVE,
          admissionDate: new Date('2026-04-01T00:00:00.000Z'),
          academicYear: { name: '2083' },
          class: { name: 'Grade 1' },
          section: { name: 'A' },
        },
      ],
      invoices: [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-2026-00001',
          status: 'ISSUED',
          dueDate: new Date('2026-05-01T00:00:00.000Z'),
          totalAmount: new Prisma.Decimal(1000),
          issuedAt: new Date('2026-04-27T00:00:00.000Z'),
          lines: [
            {
              id: 'line-1',
              feeHeadId: 'fee-head-1',
              feeHead: { name: 'Tuition' },
              description: 'Tuition',
              quantity: 1,
              unitAmount: new Prisma.Decimal(1000),
              vatAmount: new Prisma.Decimal(0),
              totalAmount: new Prisma.Decimal(1000),
            },
          ],
          payments: [],
        },
      ],
      attendanceRecords: [
        {
          id: 'attendance-record-1',
          status: 'PRESENT',
          remark: null,
          lateAt: null,
          attendanceSession: {
            attendanceDate: new Date('2026-04-27T00:00:00.000Z'),
            submittedAt: new Date('2026-04-27T08:00:00.000Z'),
          },
        },
      ],
    });
    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      activityPostFindManyResult: [],
    });
    const { service } = buildService(prisma);

    const profile = await service.getStudentProfile(student.id, actor);

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: student.id,
          tenantId: actor.tenantId,
        },
      }),
    );
    expect(profile.student.studentSystemId).toBe(student.studentSystemId);
    expect(profile.guardians[0].primaryPhone).toBe('9800000000');
    expect(profile.documents[0].fileName).toBe('birth.pdf');
    expect(profile.generatedDocuments[0].kind).toBe('id-card');
    expect(profile.generatedDocuments[0].generatedAt).toBe(
      '2026-04-27T00:00:00.000Z',
    );
    expect(profile.invoices[0].outstandingAmount).toBe(1000);
    expect(profile.attendanceRecords[0].attendanceDate).toBe('2026-04-27');
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

  it('queues guardian reminders for active student documents expiring within the reminder window', async () => {
    const expiringDocument = {
      id: 'student-doc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'BIRTH_CERTIFICATE',
      status: 'ACTIVE',
      title: 'Birth Certificate',
      fileName: 'birth.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
      objectKey: 'tenant-1/students/student-1/birth.pdf',
      expiryDate: new Date('2026-03-20T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        guardianLinks: [
          {
            isPrimary: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            guardian: {
              email: 'guardian@example.com',
              primaryPhone: '9800000000',
              receivesAlerts: true,
            },
          },
        ],
      },
    };
    const prisma = buildPrisma({
      studentDocumentFindManyResult: [expiringDocument],
    });
    const { service, notificationsService, auditService } =
      buildService(prisma);

    const result = await service.processStudentDocumentExpiryReminders(
      new Date('2026-03-01T10:30:00.000Z'),
    );

    expect(result).toEqual({
      reviewedAt: '2026-03-01T10:30:00.000Z',
      reminderWindowEnd: '2026-03-31T00:00:00.000Z',
      candidateDocuments: 1,
      remindedDocuments: 1,
      skippedDocuments: 0,
    });
    expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'VERIFIED'] },
          expiryDate: { lte: new Date('2026-03-31T00:00:00.000Z') },
        }),
        take: 500,
      }),
    );
    expect(notificationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guardian@example.com',
        subject: 'Asha Shrestha: document expires soon',
        text: expect.stringContaining('expires in 19 days'),
        metadata: expect.objectContaining({
          tenantId: actor.tenantId,
          studentId: 'student-1',
          documentId: 'student-doc-1',
          reminderType: 'student_document_expiry',
        }),
      }),
    );
    expect(notificationsService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '9800000000',
        message: expect.stringContaining('Birth Certificate for Asha Shrestha'),
      }),
    );
    expect(prisma.studentDocumentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        documentId: 'student-doc-1',
        action: 'EXPIRY_REMINDER_SENT',
        performedBy: 'system',
        metadata: expect.objectContaining({
          daysUntilExpiry: 19,
          reminderStatus: 'expiring',
          recipientCount: 1,
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expiry_reminder_sent',
        resource: 'student_document',
        tenantId: actor.tenantId,
        userId: null,
        resourceId: 'student-doc-1',
      }),
    );
  });

  it('does not send duplicate student document expiry reminders on the same day', async () => {
    const document = {
      id: 'student-doc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      kind: 'ID_CARD',
      status: 'VERIFIED',
      title: 'Guardian ID',
      fileName: 'guardian-id.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
      objectKey: 'tenant-1/students/student-1/guardian-id.pdf',
      expiryDate: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        guardianLinks: [
          {
            isPrimary: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            guardian: {
              email: 'guardian@example.com',
              primaryPhone: '9800000000',
              receivesAlerts: true,
            },
          },
        ],
      },
    };
    const prisma = buildPrisma({
      studentDocumentFindManyResult: [document],
      studentDocumentHistoryFindManyResult: [{ documentId: 'student-doc-1' }],
    });
    const { service, notificationsService, auditService } =
      buildService(prisma);

    const result = await service.processStudentDocumentExpiryReminders(
      new Date('2026-03-01T10:30:00.000Z'),
    );

    expect(result.remindedDocuments).toBe(0);
    expect(result.skippedDocuments).toBe(1);
    expect(notificationsService.sendEmail).not.toHaveBeenCalled();
    expect(notificationsService.sendSms).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'expiry_reminder_sent',
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

  it('requires fee clearance before exiting or archiving an active student', async () => {
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
      service.archiveStudent(
        student.id,
        { reason: 'Withdrawal requested by guardian' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
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

describe('attendance history', () => {
  it('returns student attendance history with summary and records', async () => {
    const student = buildStudent({
      id: 'student-1',
      firstNameEn: 'Erwin',
      lastNameEn: 'Shrestha',
      class: { id: 'class-1', name: 'Grade 10' },
      sectionRef: { id: 'section-1', name: 'A' },
    });

    const records = [
      {
        id: 'record-1',
        attendanceSessionId: 'session-1',
        status: AttendanceStatus.PRESENT,
        remark: 'On time',
        attendanceSession: {
          attendanceDate: new Date('2026-05-01'),
          class: { name: 'Grade 10' },
          section: { name: 'A' },
          submittedById: 'user-2',
          submittedAt: new Date('2026-05-01T09:00:00Z'),
          submittedBy: {
            email: 'teacher@schoolos.test',
            staff: { firstName: 'John', lastName: 'Doe' },
          },
        },
      },
      {
        id: 'record-2',
        attendanceSessionId: 'session-2',
        status: AttendanceStatus.ABSENT,
        remark: 'Sick',
        attendanceSession: {
          attendanceDate: new Date('2026-05-02'),
          class: { name: 'Grade 10' },
          section: { name: 'A' },
          submittedById: 'user-2',
          submittedAt: new Date('2026-05-02T09:00:00Z'),
          submittedBy: {
            email: 'teacher@schoolos.test',
            staff: { firstName: 'John', lastName: 'Doe' },
          },
        },
      },
    ];

    const prisma = buildPrisma({
      studentFindFirstQueue: [student],
      attendanceRecordFindManyResult: records,
    });
    const { service } = buildService(prisma);

    const result = await service.getAttendanceHistory(
      student.id,
      { status: AttendanceStatus.PRESENT },
      actor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: student.id, tenantId: actor.tenantId },
      }),
    );

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: student.id,
          tenantId: actor.tenantId,
          status: AttendanceStatus.PRESENT,
        }),
      }),
    );

    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.presentCount).toBe(1);
    expect(result.summary.absentCount).toBe(1);
    expect(result.summary.attendancePercentage).toBe(50);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].markedByName).toBe('John Doe');
    expect(result.student.fullNameEn).toBe('Erwin Shrestha');
  });

  it('enforces tenant isolation for attendance history', async () => {
    const prisma = buildPrisma({
      studentFindFirstQueue: [null],
    });
    const { service } = buildService(prisma);

    await expect(
      service.getAttendanceHistory('student-other-tenant', {}, actor),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Cross-Tenant Access Hardening', () => {
  it('rejects getStudentProfile for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getStudentProfile('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects updateStudent for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.updateStudent(
        'student-cross-tenant',
        { firstNameEn: 'Aarav' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects getIemisReadiness for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getIemisReadiness('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects getStudentLifecycleTimeline for a student outside the actor tenant', async () => {
    const prisma = buildPrisma({ studentFindFirstQueue: [null] });
    const { service } = buildService(prisma);

    await expect(
      service.getStudentLifecycleTimeline('student-cross-tenant', actor),
    ).rejects.toThrow(NotFoundException);
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
    guardianLinks: {
      guardianId?: string;
      guardian: {
        id?: string;
        fullName: string;
        relation?: string;
        primaryPhone: string | null;
        email: string | null;
        wardNumber: string | null;
      };
      relation: string;
      isPrimary: boolean;
      appLoginLinked?: boolean;
    }[];
    enrollments: {
      id?: string;
      academicYearId?: string;
      academicYear: { name: string };
      classId: string;
      sectionId?: string | null;
      rollNumber?: number | null;
      admissionDate?: Date;
      class?: { name: string };
      section: { name: string } | null;
      status: EnrollmentStatus;
    }[];
    tenant: { name: string };
    documents: unknown[];
    generatedDocuments: unknown[];
    invoices: unknown[];
    attendanceRecords: unknown[];
    identities: unknown[];
    _count?: {
      invoices: number;
      payments: number;
      studentFeeAssignments: number;
    };
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
    documents: overrides.documents ?? [],
    generatedDocuments: overrides.generatedDocuments ?? [],
    invoices: overrides.invoices ?? [],
    attendanceRecords: overrides.attendanceRecords ?? [],
    identities: overrides.identities ?? [],
    tenant: overrides.tenant ?? { name: 'Everest Academy' },
    _count: overrides._count ?? {
      invoices: 0,
      payments: 0,
      studentFeeAssignments: 0,
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const usersService = {
    createManagedUser: jest.fn(),
  };
  const communicationsService = {
    recordDeliveryRecords: jest.fn(),
  };
  const notificationsService = {
    sendEmail: jest.fn(),
    sendSms: jest.fn(),
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
  const fileRegistryService = {
    registerFile: jest.fn().mockResolvedValue({ id: 'generated-file-asset' }),
    markUploaded: jest.fn().mockResolvedValue({ id: 'generated-file-asset' }),
    getSignedUrl: jest.fn(),
    listFilesByEntity: jest.fn().mockResolvedValue([]),
  };
  const usageService = {
    verifyLimit: jest.fn(),
    checkLimit: jest.fn(),
  };

  return {
    service: new StudentsService(
      prisma as never,
      usersService as never,
      communicationsService as never,
      notificationsService as never,
      auditService as never,
      storageService as never,
      fileRegistryService as never,
      usageService as never,
    ),
    prisma,
    auditService,
    notificationsService,
    storageService,
    fileRegistryService,
  };
}

function buildPrisma(options: {
  studentFindFirstQueue?: unknown[];
  studentFindManyResult?: unknown[];
  studentDocumentFindManyResult?: unknown[];
  studentDocumentHistoryFindManyResult?: unknown[];
  guardianFindFirstQueue?: unknown[];
  studentGuardianFindFirstResult?: unknown;
  studentDocumentFindFirstQueue?: unknown[];
  invoiceFindManyQueue?: unknown[];
  classFindFirstResult?: unknown;
  sectionFindFirstResult?: unknown;
  enrollmentFindFirstResult?: unknown;
  generatedStudentDocumentFindFirstQueue?: unknown[];
  generatedStudentDocumentFindManyResult?: unknown[];
  guardianIdentityVerificationCreateResult?: unknown;
  guardianIdentityVerificationFindFirstQueue?: unknown[];
  activityPostFindManyResult?: unknown[];
  transactionGuardianIdentityVerificationUpdateResult?: unknown;
  transactionStudentUpdateResult?: unknown;
  attendanceRecordFindManyResult?: unknown[];
}) {
  const transaction = {
    enrollment: {
      update: jest.fn().mockResolvedValue({ id: 'enrollment-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    student: {
      update: jest
        .fn()
        .mockResolvedValue(options.transactionStudentUpdateResult ?? null),
    },
    studentGuardian: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 'student-guardian-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    guardian: {
      update: jest.fn().mockResolvedValue({ id: 'guardian-updated' }),
    },
    studentDocument: {
      findMany: jest.fn().mockResolvedValue([]),
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
    attendanceRecord: {
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
    studentMergeHistory: {
      create: jest.fn().mockResolvedValue({ id: 'merge-history-1' }),
    },
    guardianIdentityVerification: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockResolvedValue(
          options.transactionGuardianIdentityVerificationUpdateResult ?? null,
        ),
    },
    attendanceCorrectionRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenStudentEnrollment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenMealServing: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    canteenWalletTransaction: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
      findUnique: jest.fn().mockImplementation(async () => {
        const queue = options.studentFindFirstQueue ?? [];
        return queue.length > 0 ? queue[0] : null;
      }),
    },
    class: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.classFindFirstResult ?? { id: 'class-1' }),
    },
    section: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.sectionFindFirstResult ?? null),
    },
    enrollment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.enrollmentFindFirstResult ?? null),
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
    studentGuardian: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.studentGuardianFindFirstResult ?? null),
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
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentDocumentFindManyResult ?? []),
    },
    studentDocumentHistory: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.studentDocumentHistoryFindManyResult ?? []),
      create: jest.fn().mockResolvedValue({ id: 'document-history-1' }),
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
    activityPost: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.activityPostFindManyResult ?? []),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
    },
    attendanceRecord: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.attendanceRecordFindManyResult ?? []),
    },
    reportExport: {
      create: jest.fn().mockResolvedValue({ id: 'export-1' }),
    },
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
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
