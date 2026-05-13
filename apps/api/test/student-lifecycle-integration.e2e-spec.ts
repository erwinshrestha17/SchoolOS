import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { StudentDocumentKind, StudentLifecycleStatus } from '@prisma/client';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import { AppModule } from '../src/app.module';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { StudentsService } from '../src/students/students.service';
import { UsageService } from '../src/usage/usage.service';
import {
  createAuthContextMock,
  createPrismaMock,
  createQueueMock,
} from './test-helpers';

interface MockStateOwner {
  __state: Record<string, Record<string, unknown>[]>;
}

interface ExportPayload {
  rows?: Record<string, unknown>[];
  csv?: string;
  issues?: Record<string, unknown>[];
}

describe('Student Lifecycle Integration Depth (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentsService: StudentsService;

  const tenantId = 'tenant-student-lifecycle-depth';
  const otherTenantId = 'tenant-student-lifecycle-other';
  const actor = createAuthContextMock({ tenantId, userId: 'student-admin' });
  const otherActor = createAuthContextMock({
    tenantId: otherTenantId,
    userId: 'other-student-admin',
  });

  let classId: string;
  let academicYearId: string;
  let otherClassId: string;

  beforeAll(async () => {
    const prismaMock = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('activity-media'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(NotificationsProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(ActivityMediaProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(FinanceProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(PayrollProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(UsageService)
      .useValue({
        verifyLimit: jest.fn().mockResolvedValue(undefined),
        incrementUsage: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    studentsService = app.get<StudentsService>(StudentsService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    const academicYear = await prisma.academicYear.create({
      data: {
        tenantId,
        name: '2081-2082',
        startsOn: new Date('2024-04-14'),
        endsOn: new Date('2025-04-13'),
        isCurrent: true,
      },
    });
    academicYearId = academicYear.id;

    const classroom = await prisma.class.create({
      data: {
        tenantId,
        name: 'Grade 7',
        level: 7,
      },
    });
    classId = classroom.id;

    const otherClass = await prisma.class.create({
      data: {
        tenantId: otherTenantId,
        name: 'Grade 7 Other',
        level: 7,
      },
    });
    otherClassId = otherClass.id;
  });

  afterEach(() => {
    resetTenantState(tenantId, otherTenantId);
  });

  it('requires fee clearance for transfer, writes transition history, and audits lifecycle action', async () => {
    const student = await createStudent('Transfer', 'Blocked');

    await prisma.invoice.create({
      data: {
        tenantId,
        studentId: student.id,
        academicYearId,
        invoiceNumber: 'TRF-INV-001',
        issuedAt: new Date('2024-05-01'),
        dueDate: new Date('2024-05-15'),
        subtotal: 1500,
        vatAmount: 0,
        totalAmount: 1500,
        status: 'ISSUED',
      },
    });

    await expect(
      studentsService.requestTransfer(
        student.id,
        { reason: 'Family relocation' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    await studentsService.requestTransfer(
      student.id,
      {
        reason: 'Family relocation',
        destinationSchool: 'New School',
        waiveFeeClearance: true,
      },
      actor,
    );

    const updated = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updated?.lifecycleStatus).toBe(StudentLifecycleStatus.TRANSFERRED);
    expect(updated?.feeClearanceWaivedAt).toBeDefined();

    const transition = await prisma.studentLifecycleTransition.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        toStatus: StudentLifecycleStatus.TRANSFERRED,
      },
    });
    expect(transition).toEqual(
      expect.objectContaining({
        reason: 'Family relocation',
        feeClearanceWaived: true,
      }),
    );

    expectLifecycleAudit(student.id, 'transfer');
  });

  it('preserves lifecycle status in roster export for active and non-active students', async () => {
    const active = await createStudent('Active', 'Roster');
    const transferred = await createStudent('Transferred', 'Roster');
    const inactive = await createStudent('Inactive', 'Roster');
    const graduated = await createStudent('Graduated', 'Roster');

    await studentsService.requestTransfer(
      transferred.id,
      { reason: 'Moved abroad', waiveFeeClearance: true },
      actor,
    );
    await studentsService.archiveStudent(
      inactive.id,
      { reason: 'Inactive record cleanup' },
      actor,
    );
    await studentsService.archiveAlumni(
      graduated.id,
      { reason: 'Graduated from school' },
      actor,
    );

    const roster = stringifyExport(
      await studentsService.exportRoster({ classId }, actor),
    );

    expect(roster).toContain(active.studentSystemId);
    expect(roster).toContain(transferred.studentSystemId);
    expect(roster).toContain(inactive.studentSystemId);
    expect(roster).toContain(graduated.studentSystemId);
    expect(roster).toContain(StudentLifecycleStatus.ACTIVE);
    expect(roster).toContain(StudentLifecycleStatus.TRANSFERRED);
    expect(roster).toContain(StudentLifecycleStatus.EXITED);
    expect(roster).toContain(StudentLifecycleStatus.ALUMNI);
  });

  it('retains student documents and document history after lifecycle changes', async () => {
    const student = await createStudent('Document', 'Retention');

    const document = await studentsService.uploadStudentDocument(
      student.id,
      {
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        title: 'Birth Certificate',
        fileName: 'birth.pdf',
        base64Content: Buffer.from('birth-certificate').toString('base64'),
        reason: 'Admission evidence',
      },
      actor,
    );

    await studentsService.requestTransfer(
      student.id,
      { reason: 'School change', waiveFeeClearance: true },
      actor,
    );

    const retainedDocuments = await prisma.studentDocument.findMany({
      where: { tenantId, studentId: student.id },
    });
    expect(retainedDocuments).toEqual([
      expect.objectContaining({
        id: document.id,
        title: 'Birth Certificate',
      }),
    ]);

    const history = await prisma.studentDocumentHistory.findMany({
      where: { tenantId, documentId: document.id },
    });
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'UPLOAD',
          documentId: document.id,
          reason: 'Admission evidence',
        }),
      ]),
    );
  });

  it('preserves document history and audits duplicate merge into canonical student', async () => {
    const source = await createStudent('Duplicate', 'Student');
    const target = await createStudent('Duplicate', 'Student');

    const document = await studentsService.uploadStudentDocument(
      source.id,
      {
        kind: StudentDocumentKind.OTHER,
        title: 'Prior School Record',
        fileName: 'prior-school.pdf',
        base64Content: Buffer.from('prior-school-record').toString('base64'),
        reason: 'Uploaded before merge',
      },
      actor,
    );

    await studentsService.mergeDuplicateStudent(
      {
        sourceStudentId: source.id,
        targetStudentId: target.id,
        reason: 'Duplicate admission discovered',
      },
      actor,
    );

    const sourceAfter = await prisma.student.findUnique({
      where: { id: source.id },
    });
    expect(sourceAfter?.lifecycleStatus).toBe(StudentLifecycleStatus.MERGED);

    const targetDocuments = await prisma.studentDocument.findMany({
      where: { tenantId, studentId: target.id },
    });
    expect(targetDocuments).toEqual([
      expect.objectContaining({
        id: document.id,
        title: 'Prior School Record',
      }),
    ]);

    const movedHistory = await prisma.studentDocumentHistory.findFirst({
      where: {
        tenantId,
        documentId: document.id,
        action: 'MOVE_MERGE',
      },
    });
    expect(movedHistory).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          sourceStudentId: source.id,
          targetStudentId: target.id,
        }),
        reason: expect.stringContaining(source.studentSystemId),
      }),
    );

    expectLifecycleAudit(source.id, 'merge');
  });

  it('blocks duplicate merge across tenant boundaries', async () => {
    const source = await createStudent('Tenant', 'Source');
    const target = await createStudent(
      'Tenant',
      'Target',
      otherActor,
      otherClassId,
    );

    await expect(
      studentsService.mergeDuplicateStudent(
        {
          sourceStudentId: source.id,
          targetStudentId: target.id,
          reason: 'Cross tenant merge attempt',
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);

    const sourceAfter = await prisma.student.findUnique({
      where: { id: source.id },
    });
    const targetAfter = await prisma.student.findUnique({
      where: { id: target.id },
    });
    expect(sourceAfter?.lifecycleStatus).toBe(StudentLifecycleStatus.ACTIVE);
    expect(targetAfter?.lifecycleStatus).toBe(StudentLifecycleStatus.ACTIVE);
  });

  it('marks archived and deleted students as non-exportable in iEMIS diagnostics', async () => {
    const active = await createStudent('Iemis', 'Active');
    const archived = await createStudent('Iemis', 'Archived');
    const deleted = await createStudent('Iemis', 'Deleted');

    await studentsService.archiveStudent(
      archived.id,
      { reason: 'Inactive before iEMIS export' },
      actor,
    );
    await studentsService.deleteStudent(
      deleted.id,
      { reason: 'Duplicate bad record before iEMIS export' },
      actor,
    );

    const iemis = (await studentsService.exportIemis(actor)) as ExportPayload;

    expect(stringifyExport(iemis)).toContain(active.studentSystemId);
    expect(iemis.csv ?? '').not.toContain(archived.studentSystemId);
    expect(iemis.csv ?? '').not.toContain(deleted.studentSystemId);
    expect(iemis.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentSystemId: archived.studentSystemId,
          field: 'lifecycleStatus',
          message: 'Only active students are exportable to iEMIS',
        }),
        expect.objectContaining({
          studentSystemId: deleted.studentSystemId,
          field: 'lifecycleStatus',
          message: 'Only active students are exportable to iEMIS',
        }),
      ]),
    );
  });

  async function createStudent(
    firstNameEn: string,
    lastNameEn: string,
    auth = actor,
    targetClassId = classId,
  ) {
    return studentsService.createStudent(
      {
        firstNameEn,
        lastNameEn,
        dateOfBirth: '2012-01-01',
        gender: 'OTHER',
        admissionDate: '2024-04-20',
        classId: targetClassId,
      },
      auth,
    );
  }

  function stringifyExport(value: unknown) {
    if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  function expectLifecycleAudit(studentId: string, actionFragment: string) {
    expect(getMockState().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId,
          resource: 'student',
          resourceId: studentId,
          action: expect.stringContaining(actionFragment),
        }),
      ]),
    );
  }

  function resetTenantState(...tenantIds: string[]) {
    const state = getMockState();
    for (const key of Object.keys(state)) {
      state[key] = state[key].filter(
        (item) =>
          typeof item.tenantId !== 'string' ||
          !tenantIds.includes(item.tenantId),
      );
    }
  }

  function getMockState() {
    return (prisma as unknown as MockStateOwner).__state;
  }
});
