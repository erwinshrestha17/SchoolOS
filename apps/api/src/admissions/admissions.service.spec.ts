import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthMethod, EnrollmentStatus, Gender } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import { StudentsService } from '../students/students.service';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
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
        {
          ...buildAdmissionDto(),
          guardians: [
            {
              fullName: 'Maya Shrestha',
              relation: 'mother',
              primaryPhone: 'not-a-phone',
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.academicYear.findFirst).not.toHaveBeenCalled();
  });

  it('detects duplicates only within the actor tenant', async () => {
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
        dateOfBirth: new Date('2020-01-02'),
      },
      include: {
        class: true,
        sectionRef: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    expect(result.hasWarnings).toBe(true);
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
      }),
    );
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

  const storageService = { saveBase64Object: jest.fn(), saveBufferObject: jest.fn() };
  const fileRegistryService = { registerFile: jest.fn(), getSignedUrl: jest.fn() };

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
    $transaction: jest.fn(),
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
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };
}

type PrismaMockOptions = {
  academicYearFindFirstResult: typeof academicYear | null;
  classFindFirstResult: typeof classroom | null;
  sectionFindFirstResult: typeof section | null;
  studentFindManyResult: unknown[];
  studentFindFirstResult: unknown;
  enrollmentFindFirstResult: unknown;
};
