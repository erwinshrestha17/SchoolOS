import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthMethod, EnrollmentStatus, Gender } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import { StudentsService } from '../students/students.service';
import { UsersService } from '../users/users.service';
import { UsageService } from '../usage/usage.service';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:create', 'enrollments:create', 'guardians:create'],
};

const academicYear = {
  id: 'ay-1',
  startsOn: new Date('2026-04-01T00:00:00.000Z'),
};

const classroom = { id: 'class-1', name: 'Class 1' };
const section = { id: 'section-1', name: 'A', classId: 'class-1' };

describe('AdmissionsService production hardening', () => {
  it('creates the core admission in one tenant-scoped transaction', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const { service, financeService, notificationsService, eventEmitter } =
      buildService(prisma);

    const result = await service.createAdmission(buildAdmissionDto(), actor);

    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith({
      where: { id: 'ay-1', tenantId: actor.tenantId },
      select: { id: true, startsOn: true },
    });

    expect(prisma.class.findFirst).toHaveBeenCalledWith({
      where: { id: 'class-1', tenantId: actor.tenantId },
      select: { id: true, name: true },
    });

    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: { id: 'section-1', tenantId: actor.tenantId },
      select: { id: true, name: true, classId: true },
    });

    expect(tx.student.count).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        studentSystemId: { startsWith: 'SCH-2026-' },
      },
    });

    expect(tx.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        classId: 'class-1',
        sectionId: 'section-1',
      }),
    });

    expect(tx.guardian.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_primaryPhone: {
            tenantId: actor.tenantId,
            primaryPhone: '9800000000',
          },
        },
      }),
    );

    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: 'student-1',
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 4,
      }),
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'create',
        resource: 'admission',
        tenantId: actor.tenantId,
        resourceId: 'enrollment-1',
      }),
    });

    expect(financeService.assignFeePlansForEnrollment).toHaveBeenCalledWith({
      tenantId: actor.tenantId,
      studentId: 'student-1',
      academicYearId: 'ay-1',
      classId: 'class-1',
    });

    expect(financeService.createInitialInvoice).toHaveBeenCalledWith({
      actor,
      studentId: 'student-1',
      academicYearId: 'ay-1',
      enrollmentId: 'enrollment-1',
      dueDate: new Date('2026-04-15'),
    });

    expect(notificationsService.sendSms).not.toHaveBeenCalled();

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'student.admitted',
      expect.objectContaining({
        tenantId: actor.tenantId,
        studentId: 'student-1',
      }),
    );

    expect(result.student.studentSystemId).toBe('SCH-2026-0001');
  });

  it('blocks sections that do not belong to the selected class', async () => {
    const prisma = buildPrisma({
      sectionFindFirstResult: { ...section, classId: 'other-class' },
    });
    const { service } = buildService(prisma);

    await expect(
      service.createAdmission(buildAdmissionDto(), actor),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires at least one guardian with a valid primary phone', async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.createAdmission(
        Object.assign(buildAdmissionDto(), {
          guardians: [
            {
              fullName: 'Maya Shrestha',
              relation: 'mother',
              primaryPhone: 'not-a-phone',
            },
          ],
        }),
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.academicYear.findFirst).not.toHaveBeenCalled();
  });

  it('detects duplicates only within the actor tenant (exact name + DOB)', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [
        {
          id: 'student-existing',
          studentSystemId: 'SCH-2026-0009',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
          dateOfBirth: new Date('2020-01-02'),
          rollNumber: null,
          section: null,
          class: { name: 'Class 1' },
          sectionRef: null,
          guardianLinks: [],
        },
      ],
    });
    const { service } = buildService(prisma);

    const result = await service.checkDuplicateAdmissions(
      {
        firstNameEn: '  Asha ',
        lastNameEn: 'Tamang',
        dateOfBirth: '2020-01-02',
      },
      actor,
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        OR: [
          {
            dateOfBirth: new Date('2020-01-02'),
            OR: [
              {
                firstNameEn: { equals: '  Asha ', mode: 'insensitive' },
                lastNameEn: { equals: 'Tamang', mode: 'insensitive' },
              },
            ],
          },
        ],
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    expect(result.hasWarnings).toBe(true);
    expect(result.matches[0].matchTypes).toContain('exact_name_dob');
  });

  it('detects name + phone duplicate matches (even if DOB differs)', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [
        {
          id: 'student-existing-2',
          studentSystemId: 'SCH-2026-0010',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
          dateOfBirth: new Date('2019-05-05'),
          rollNumber: null,
          section: null,
          class: { name: 'Class 1' },
          sectionRef: null,
          guardianLinks: [
            {
              guardian: {
                primaryPhone: '9801234567',
                secondaryPhone: null,
              },
            },
          ],
        },
      ],
    });
    const { service } = buildService(prisma);

    const result = await service.checkDuplicateAdmissions(
      {
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        dateOfBirth: '2020-01-02',
        guardianPhones: ['9801234567'],
      },
      actor,
    );

    expect(result.hasWarnings).toBe(true);
    expect(result.matches[0].matchTypes).toContain('name_phone');
    expect(result.matches[0].matchTypes).not.toContain('exact_name_dob');
  });

  it('detects sibling matches (same last name + matching guardian phone)', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [
        {
          id: 'sibling-existing',
          studentSystemId: 'SCH-2026-0011',
          firstNameEn: 'Prem',
          lastNameEn: 'Tamang',
          dateOfBirth: new Date('2018-03-03'),
          rollNumber: null,
          section: null,
          class: { name: 'Class 2' },
          sectionRef: null,
          guardianLinks: [
            {
              guardian: {
                primaryPhone: '9801234567',
                secondaryPhone: null,
              },
            },
          ],
        },
      ],
    });
    const { service } = buildService(prisma);

    const result = await service.checkDuplicateAdmissions(
      {
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        dateOfBirth: '2020-01-02',
        guardianPhones: ['9801234567'],
      },
      actor,
    );

    expect(result.hasWarnings).toBe(true);
    expect(result.matches[0].matchTypes).toContain('sibling');
  });

  it('blocks manual roll number conflicts for tenant year class and section', async () => {
    const prisma = buildPrisma({
      enrollmentFindFirstResult: {
        id: 'enrollment-existing',
        studentId: 'student-existing',
        rollNumber: 4,
        student: {
          studentSystemId: 'SCH-2026-0007',
          firstNameEn: 'Asha',
          lastNameEn: 'Tamang',
        },
        class: { name: 'Class 1' },
        section: { name: 'A' },
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.createAdmission(buildAdmissionDto(), actor),
    ).rejects.toThrow(ConflictException);

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 4,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: true,
        class: true,
        section: true,
      },
    });
  });

  it('returns row-level bulk import errors without failing the whole import', async () => {
    const prisma = buildPrisma();
    const tx = buildTransaction();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const { service, auditService } = buildService(prisma);

    const result = await service.bulkImport(
      {
        dryRun: true,
        csvContent: [
          'firstNameEn,lastNameEn,dateOfBirth,gender,admissionDate,academicYearId,classId,guardianFullName,guardianRelation,guardianPhone,confirmNoDisability',
          'Asha,Tamang,2020-01-02,FEMALE,2026-04-15,ay-1,class-1,Maya Tamang,mother,9800000000,true',
          'Bimal,Rai,2020-02-03,MALE,2026-04-15,ay-1,class-1,Mohan Rai,father,,true',
        ].join('\n'),
      },
      actor,
    );

    expect(result.totalRows).toBe(2);
    expect(result.batchId).toBe('import-batch-1');
    expect(result.validated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1]).toEqual(
      expect.objectContaining({
        rowNumber: 3,
        status: 'failed',
        errors: expect.arrayContaining(['guardianPhone is required']),
      }),
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk_import_validate',
        resource: 'admission',
        tenantId: actor.tenantId,
        resourceId: 'import-batch-1',
      }),
    );
    expect(tx.admissionImportRow.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenantId: actor.tenantId,
          batchId: 'import-batch-1',
          rowNumber: 2,
          status: 'VALIDATED',
        }),
        expect.objectContaining({
          tenantId: actor.tenantId,
          batchId: 'import-batch-1',
          rowNumber: 3,
          status: 'FAILED',
        }),
      ]),
    });
    expect(tx.admissionImportBatch.update).toHaveBeenCalledWith({
      where: { id: 'import-batch-1' },
      data: expect.objectContaining({
        status: 'COMPLETED_WITH_ERRORS',
        validatedRows: 1,
        failedRows: 1,
      }),
    });
  });

  it('keeps duplicate candidates structured in bulk import review rows', async () => {
    const existingStudent = {
      id: 'student-existing',
      studentSystemId: 'SCH-2026-0007',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      firstNameNp: null,
      lastNameNp: null,
      dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
      class: { name: 'Class 1' },
      sectionRef: { name: 'A' },
      section: null,
      rollNumber: 7,
      guardianLinks: [
        {
          guardian: {
            primaryPhone: '9800000000',
            secondaryPhone: null,
          },
        },
      ],
    };
    const prisma = buildPrisma({
      studentFindManyResult: [existingStudent],
    });
    const { service } = buildService(prisma);

    const result = await service.bulkImport(
      {
        dryRun: true,
        csvContent: [
          'firstNameEn,lastNameEn,dateOfBirth,gender,admissionDate,academicYearId,classId,guardianFullName,guardianRelation,guardianPhone,confirmNoDisability',
          'Asha,Tamang,2020-01-02,FEMALE,2026-04-15,ay-1,class-1,Maya Tamang,mother,9800000000,true',
        ].join('\n'),
      },
      actor,
    );

    expect(result.failed).toBe(1);
    expect(result.batchId).toBe('import-batch-1');
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        rowNumber: 2,
        status: 'failed',
        errors: expect.arrayContaining([
          'Possible duplicate admission found. Resubmit with confirmDuplicate=true to continue.',
        ]),
        duplicates: [
          expect.objectContaining({
            studentId: 'student-existing',
            studentSystemId: 'SCH-2026-0007',
            fullNameEn: 'Asha Tamang',
            matchTypes: expect.arrayContaining([
              'exact_name_dob',
              'name_phone',
            ]),
          }),
        ],
      }),
    );
    expect(result.errorReportCsv).toContain('SCH-2026-0007 Asha Tamang');
  });

  it('creates a tenant-scoped admission application with duplicate review metadata', async () => {
    const prisma = buildPrisma({
      studentFindManyResult: [],
    });
    const { service, auditService } = buildService(prisma);

    const result = await service.createApplication(
      {
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        dateOfBirth: '2020-01-02',
        gender: Gender.FEMALE,
        guardianFullName: 'Maya Tamang',
        guardianRelation: 'mother',
        guardianPhone: '9800000000',
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
      },
      actor,
    );

    expect(prisma.admissionApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        status: 'INQUIRY',
        firstNameEn: 'Asha',
        guardianPhone: '9800000000',
        duplicateReview: expect.objectContaining({ hasWarnings: false }),
        createdById: actor.userId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_application_create',
        resource: 'admission_application',
        tenantId: actor.tenantId,
        resourceId: 'application-1',
      }),
    );
    expect(result.id).toBe('application-1');
  });

  it('requires a reason when rejecting an admission application', async () => {
    const prisma = buildPrisma({
      admissionApplicationFindFirstResult: {
        ...buildApplication(),
        status: 'APPLICATION',
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateApplicationStatus(
        'application-1',
        { status: 'REJECTED' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks direct ENROLLED status updates because conversion must create a linked student', async () => {
    const prisma = buildPrisma({
      admissionApplicationFindFirstResult: {
        ...buildApplication(),
        status: 'ACCEPTED',
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.updateApplicationStatus(
        'application-1',
        { status: 'ENROLLED' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.admissionApplication.updateMany).not.toHaveBeenCalled();
  });

  it('requires accepted status before enrolling an admission application', async () => {
    const prisma = buildPrisma({
      admissionApplicationFindFirstResult: {
        ...buildApplication(),
        status: 'DOCUMENT_PENDING',
      },
    });
    const { service } = buildService(prisma);

    await expect(
      service.enrollApplication('application-1', buildAdmissionDto(), actor),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('enrolls an accepted application through one tenant-scoped conversion transaction', async () => {
    const prisma = buildPrisma({
      admissionApplicationFindFirstResult: {
        ...buildApplication(),
        status: 'ACCEPTED',
      },
    });
    const tx = buildTransaction();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const { service, auditService } = buildService(prisma);

    const result = await service.enrollApplication(
      'application-1',
      buildAdmissionDto(),
      actor,
    );

    expect(tx.admissionApplication.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'application-1',
        tenantId: actor.tenantId,
        status: 'ACCEPTED',
        convertedStudentId: null,
      },
      data: { updatedById: actor.userId },
    });
    expect(tx.admissionApplication.update).toHaveBeenCalledWith({
      where: { id: 'application-1' },
      data: expect.objectContaining({
        status: 'ENROLLED',
        convertedStudentId: 'student-1',
        updatedById: actor.userId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admission_application_enroll',
        resource: 'admission_application',
        resourceId: 'application-1',
      }),
    );
    expect(result.application.status).toBe('ENROLLED');
    expect(result.admission.student.id).toBe('student-1');
  });

  it('rejects missing tenant-owned references before writing', async () => {
    const prisma = buildPrisma({ academicYearFindFirstResult: null });
    const { service } = buildService(prisma);

    await expect(
      service.createAdmission(buildAdmissionDto(), actor),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

function buildAdmissionDto(): CreateAdmissionDto {
  return {
    firstNameEn: 'Asha',
    lastNameEn: 'Tamang',
    dateOfBirth: '2020-01-02',
    gender: Gender.FEMALE,
    admissionDate: '2026-04-15',
    academicYearId: 'ay-1',
    classId: 'class-1',
    sectionId: 'section-1',
    rollNumber: 4,
    confirmNoDisability: true,
    guardians: [
      {
        fullName: 'Maya Tamang',
        relation: 'mother',
        primaryPhone: '9800000000',
        isPrimary: true,
        receivesAlerts: true,
      },
    ],
  };
}

function buildApplication() {
  return {
    id: 'application-1',
    tenantId: actor.tenantId,
    status: 'INQUIRY',
    firstNameEn: 'Asha',
    lastNameEn: 'Tamang',
    firstNameNp: null,
    lastNameNp: null,
    dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
    gender: Gender.FEMALE,
    guardianFullName: 'Maya Tamang',
    guardianRelation: 'mother',
    guardianPhone: '9800000000',
    guardianEmail: null,
    academicYearId: 'ay-1',
    classId: 'class-1',
    sectionId: 'section-1',
    previousSchool: null,
    source: null,
    notes: null,
    duplicateReview: null,
    convertedStudentId: null,
    rejectedReason: null,
    createdById: actor.userId,
    updatedById: actor.userId,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  };
}

function buildService(prisma = buildPrisma()) {
  const usersService = { createManagedUser: jest.fn() };

  const financeService = {
    assignFeePlansForEnrollment: jest.fn().mockResolvedValue(undefined),
    createInitialInvoice: jest.fn().mockResolvedValue({
      id: 'invoice-1',
      invoiceNumber: 'INV-0001',
      totalAmount: 1000,
    }),
  };

  const studentRecordsService = { uploadDocument: jest.fn() };

  const notificationsService = {
    sendSms: jest.fn().mockResolvedValue(undefined),
  };

  const auditService = { record: jest.fn().mockResolvedValue(undefined) };

  const configService = { medicalEncryptionKey: 'test-key' };

  const eventEmitter = { emit: jest.fn() };

  const studentsService = {
    generateStudentDocumentPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    requestTransfer: jest.fn(),
    exportIemis: jest.fn(),
    deleteStudent: jest.fn(),
    archiveAlumni: jest.fn(),
  };

  const storageService = {
    saveBase64Object: jest.fn(),
    saveBufferObject: jest.fn(),
  };

  const fileRegistryService = {
    registerFile: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  const usageService = {
    checkLimit: jest.fn().mockResolvedValue(undefined),
    incrementUsage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AdmissionsService(
    prisma as unknown as PrismaService,
    usersService as unknown as UsersService,
    financeService as unknown as FinanceService,
    studentRecordsService as unknown as StudentRecordsService,
    notificationsService as unknown as NotificationsService,
    auditService as unknown as AuditService,
    configService as ConfigService,
    eventEmitter as unknown as EventEmitter2,
    studentsService as unknown as StudentsService,
    storageService as unknown as StorageService,
    fileRegistryService as unknown as FileRegistryService,
    usageService as unknown as UsageService,
  );

  return {
    service,
    financeService,
    notificationsService,
    auditService,
    eventEmitter,
  };
}

function buildPrisma(overrides: Partial<PrismaMockOptions> = {}) {
  const tx = buildTransaction();
  return {
    academicYear: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'academicYearFindFirstResult' in overrides
            ? overrides.academicYearFindFirstResult
            : academicYear,
        ),
    },
    class: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'classFindFirstResult' in overrides
            ? overrides.classFindFirstResult
            : classroom,
        ),
    },
    section: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'sectionFindFirstResult' in overrides
            ? overrides.sectionFindFirstResult
            : section,
        ),
    },
    student: {
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.studentFindManyResult ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.studentFindFirstResult ?? null),
    },
    enrollment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.enrollmentFindFirstResult ?? null),
    },
    role: {
      findUnique: jest.fn(),
    },
    admissionImportBatch: {
      create: jest.fn().mockResolvedValue({
        id: 'import-batch-1',
        tenantId: actor.tenantId,
        dryRun: false,
        confirmDuplicates: false,
        status: 'PROCESSING',
        totalRows: 0,
        createdRows: 0,
        validatedRows: 0,
        failedRows: 0,
        sourceFileName: null,
        errorReportCsv: null,
        createdById: actor.userId,
        startedAt: new Date('2026-04-15T00:00:00.000Z'),
        completedAt: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    admissionImportRow: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    admissionApplication: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          overrides.admissionApplicationFindFirstResult ?? null,
        ),
      create: jest.fn().mockResolvedValue(buildApplication()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        ...buildApplication(),
        status: 'ENROLLED',
        convertedStudentId: 'student-1',
      }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
}

function buildTransaction() {
  return {
    student: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Asha',
        lastNameEn: 'Tamang',
        admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        classId: 'class-1',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    siblingGroup: {
      create: jest.fn(),
    },
    siblingGroupMember: {
      create: jest.fn(),
    },
    guardian: {
      upsert: jest.fn().mockResolvedValue({
        id: 'guardian-1',
        fullName: 'Maya Tamang',
        primaryPhone: '9800000000',
      }),
    },
    studentGuardian: {
      create: jest.fn().mockResolvedValue({
        relation: 'mother',
        guardian: {
          id: 'guardian-1',
          fullName: 'Maya Tamang',
          primaryPhone: '9800000000',
        },
      }),
    },
    enrollment: {
      create: jest.fn().mockResolvedValue({
        id: 'enrollment-1',
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        rollNumber: 4,
      }),
    },
    studentLifecycleTransition: {
      create: jest.fn().mockResolvedValue({
        id: 'slt-1',
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    admissionImportRow: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    admissionImportBatch: {
      update: jest.fn().mockResolvedValue({
        id: 'import-batch-1',
      }),
    },
    admissionApplication: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        ...buildApplication(),
        status: 'ENROLLED',
        convertedStudentId: 'student-1',
      }),
    },
  };
}

interface PrismaMockOptions {
  academicYearFindFirstResult: typeof academicYear | null;
  classFindFirstResult: typeof classroom | null;
  sectionFindFirstResult: typeof section | null;
  studentFindManyResult: unknown[];
  studentFindFirstResult: unknown;
  enrollmentFindFirstResult: unknown;
  admissionApplicationFindFirstResult: unknown;
}
