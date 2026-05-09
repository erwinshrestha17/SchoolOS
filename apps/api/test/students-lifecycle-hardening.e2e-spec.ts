import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StudentsService } from '../src/students/students.service';
import {
  StudentLifecycleStatus,
  EnrollmentStatus,
  StudentDocumentKind,
} from '@prisma/client';
import { createAuthContextMock } from './test-helpers';

describe('Student Lifecycle Hardening (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentsService: StudentsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    studentsService = app.get<StudentsService>(StudentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantId = 'test-tenant-lifecycle';
  const actor = createAuthContextMock({ tenantId, userId: 'test-admin' });

  let classId: string;
  let academicYearId: string;

  beforeEach(async () => {
    // Setup basic class and academic year
    const ay = await prisma.academicYear.create({
      data: {
        tenantId,
        name: '2024-2025',
        startDate: new Date('2024-04-14'),
        endDate: new Date('2025-04-13'),
        status: 'ACTIVE',
      },
    });
    academicYearId = ay.id;

    const cls = await prisma.class.create({
      data: {
        tenantId,
        name: 'Grade 10',
      },
    });
    classId = cls.id;
  });

  afterEach(async () => {
    // Clean up
    await prisma.studentLifecycleTransition.deleteMany({ where: { tenantId } });
    await prisma.studentDocumentHistory.deleteMany({ where: { tenantId } });
    await prisma.studentDocument.deleteMany({ where: { tenantId } });
    await prisma.student.deleteMany({ where: { tenantId } });
    await prisma.class.deleteMany({ where: { tenantId } });
    await prisma.academicYear.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
  });

  it('should record initial lifecycle transition upon student creation', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const transitions = await prisma.studentLifecycleTransition.findMany({
      where: { studentId: student.id },
    });

    expect(transitions).toHaveLength(1);
    expect(transitions[0].toStatus).toBe(StudentLifecycleStatus.ACTIVE);
    expect(transitions[0].fromStatus).toBeNull();
    expect(transitions[0].reason).toBe('Initial enrollment');
  });

  it('should enforce fee clearance for transfer and record transition', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'Jane',
        lastNameEn: 'Smith',
        dateOfBirth: '2010-05-05',
        gender: 'FEMALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    // Add an unpaid invoice
    await prisma.invoice.create({
      data: {
        tenantId,
        studentId: student.id,
        invoiceNumber: 'INV-001',
        issueDate: new Date(),
        dueDate: new Date(),
        totalAmount: 1000,
        outstandingAmount: 1000,
        status: 'PARTIAL',
      },
    });

    // Attempt transfer without waiver -> should fail
    await expect(
      studentsService.requestTransfer(
        student.id,
        { reason: 'Relocation' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    // Attempt transfer with waiver -> should succeed
    await studentsService.requestTransfer(
      student.id,
      { reason: 'Relocation', waiveFeeClearance: true },
      actor,
    );

    const updated = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(updated?.lifecycleStatus).toBe(StudentLifecycleStatus.TRANSFERRED);
    expect(updated?.feeClearanceWaivedAt).toBeDefined();

    const transitions = await prisma.studentLifecycleTransition.findMany({
      where: {
        studentId: student.id,
        toStatus: StudentLifecycleStatus.TRANSFERRED,
      },
    });
    expect(transitions).toHaveLength(1);
    expect(transitions[0].feeClearanceWaived).toBe(true);
  });

  it('should generate and verify student QR code', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'QR',
        lastNameEn: 'Tester',
        dateOfBirth: '2012-12-12',
        gender: 'OTHER',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const { qrCode } = await studentsService.generateStudentQrCode(
      student.id,
      actor,
    );
    expect(qrCode).toContain(`schoolos:std:${tenantId}`);

    const verified = await studentsService.verifyStudentQrCode(qrCode!, actor);
    expect(verified.id).toBe(student.id);
    expect(verified.studentSystemId).toBe(student.studentSystemId);
  });

  it('should manage student documents and history', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'Doc',
        lastNameEn: 'Manager',
        dateOfBirth: '2011-11-11',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const doc = await studentsService.uploadStudentDocument(
      student.id,
      {
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        title: 'Birth Cert',
        fileName: 'birth.pdf',
        base64Content: Buffer.from('fake-pdf').toString('base64'),
        reason: 'Initial admission doc',
      },
      actor,
    );

    expect(doc.kind).toBe(StudentDocumentKind.BIRTH_CERTIFICATE);

    const history = await prisma.studentDocumentHistory.findMany({
      where: { documentId: doc.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('UPLOAD');
    expect(history[0].reason).toBe('Initial admission doc');

    await studentsService.deleteStudentDocument(
      student.id,
      doc.id,
      { reason: 'Correction' },
      actor,
    );

    const historyAfter = await prisma.studentDocumentHistory.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    expect(historyAfter).toHaveLength(2);
    expect(historyAfter[0].action).toBe('DELETE');
    expect(historyAfter[0].documentId).toBeNull();
    expect(historyAfter[0].documentTitle).toBe('Birth Cert');
    expect(historyAfter[0].reason).toBe('Correction');

    expect(historyAfter[1].action).toBe('UPLOAD');
    expect(historyAfter[1].documentId).toBeNull(); // Was set to null by cascade
    expect(historyAfter[1].documentTitle).toBe('Birth Cert');
  });

  it('should handle duplicate student merge and move document history', async () => {
    const student1 = await studentsService.createStudent(
      {
        firstNameEn: 'Dup',
        lastNameEn: 'One',
        dateOfBirth: '2010-01-01',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const student2 = await studentsService.createStudent(
      {
        firstNameEn: 'Dup',
        lastNameEn: 'One',
        dateOfBirth: '2010-01-01',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    await studentsService.uploadStudentDocument(
      student1.id,
      {
        kind: StudentDocumentKind.BIRTH_CERTIFICATE,
        title: 'Original Birth Cert',
        fileName: 'birth1.pdf',
        base64Content: 'fake',
      },
      actor,
    );

    await studentsService.mergeDuplicateStudent(
      {
        sourceStudentId: student1.id,
        targetStudentId: student2.id,
        reason: 'Duplicate entry',
      },
      actor,
    );

    const student1After = await prisma.student.findUnique({
      where: { id: student1.id },
    });
    expect(student1After?.lifecycleStatus).toBe(StudentLifecycleStatus.DELETED);

    const docsAtTarget = await prisma.studentDocument.findMany({
      where: { studentId: student2.id },
    });
    expect(docsAtTarget).toHaveLength(1);
    expect(docsAtTarget[0].title).toBe('Original Birth Cert');

    const history = await prisma.studentDocumentHistory.findFirst({
      where: { action: 'MOVE_MERGE', documentId: docsAtTarget[0].id },
    });
    expect(history).toBeDefined();
    expect(history?.reason).toContain(student1.studentSystemId);
  });
});
