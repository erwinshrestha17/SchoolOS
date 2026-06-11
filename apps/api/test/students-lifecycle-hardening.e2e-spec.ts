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
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import {
  StudentLifecycleStatus,
  EnrollmentStatus,
  StudentDocumentKind,
} from '@prisma/client';
import {
  createAuthContextMock,
  createPrismaMock,
  createQueueMock,
} from './test-helpers';
import { getQueueToken } from '@nestjs/bullmq';
import { StudentQrService } from '../src/students/student-qr.service';

describe('Student Lifecycle Hardening (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentsService: StudentsService;

  const tenantId = 'test-tenant-lifecycle';
  const actor = createAuthContextMock({
    tenantId,
    userId: 'test-admin',
    permissions: [
      'students:read',
      'students:qr:resolve_all',
      'students:qr:read',
      'students:qr:generate',
    ],
  });

  beforeAll(async () => {
    const prismaMock = createPrismaMock();
    prismaMock.__state.tenants.push({
      id: tenantId,
      slug: 'test-tenant-lifecycle',
      name: 'Test Tenant Lifecycle',
      plan: 'standard',
      mode: 'MULTI',
      isActive: true,
      createdAt: new Date(),
    });

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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    studentsService = app.get<StudentsService>(StudentsService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  let classId: string;
  let academicYearId: string;

  beforeEach(async () => {
    // Setup basic class and academic year
    const ay = await prisma.academicYear.create({
      data: {
        tenantId,
        name: '2024-2025',
        startsOn: new Date('2024-04-14'),
        endsOn: new Date('2025-04-13'),
        isCurrent: true,
      },
    });
    academicYearId = ay.id;

    const cls = await prisma.class.create({
      data: {
        tenantId,
        name: 'Grade 10',
        level: 10,
      },
    });
    classId = cls.id;
  });

  afterEach(async () => {
    if (!prisma) return;

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
        academicYearId,
        invoiceNumber: 'INV-001',
        issuedAt: new Date(),
        dueDate: new Date(),
        subtotal: 1000,
        vatAmount: 0,
        totalAmount: 1000,
        status: 'ISSUED',
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
    expect(student1After?.lifecycleStatus).toBe(StudentLifecycleStatus.MERGED);

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

  it('should exclude sibling group members from duplicate detection and match on Nepali names, normalized phones, and emails', async () => {
    const s1 = await studentsService.createStudent(
      {
        firstNameEn: 'Duplicate',
        lastNameEn: 'Test',
        firstNameNp: 'प्रतिलिपि',
        lastNameNp: 'परीक्षण',
        dateOfBirth: '2015-05-05',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const s2 = await studentsService.createStudent(
      {
        firstNameEn: 'Duplicate',
        lastNameEn: 'Test',
        firstNameNp: 'प्रतिलिपि',
        lastNameNp: 'परीक्षण',
        dateOfBirth: '2015-05-05',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const guardian = await prisma.guardian.create({
      data: {
        tenantId,
        fullName: 'Parent Test',
        relation: 'FATHER',
        primaryPhone: '+977-9841-111222',
        email: 'parent@example.com',
      },
    });

    await prisma.studentGuardian.createMany({
      data: [
        {
          tenantId,
          studentId: s1.id,
          guardianId: guardian.id,
          relation: 'FATHER',
        },
        {
          tenantId,
          studentId: s2.id,
          guardianId: guardian.id,
          relation: 'FATHER',
        },
      ],
    });

    const res1 = await studentsService.listDuplicateStudentCandidates(
      { studentId: s1.id },
      actor,
    );
    expect(res1.candidates.length).toBeGreaterThan(0);
    expect(res1.candidates[0].candidateStudent.id).toBe(s2.id);
    expect(res1.candidates[0].score).toBe(100);
    expect(res1.candidates[0].reasons).toContain('Similar student Nepali name');
    expect(res1.candidates[0].reasons).toContain('Shared guardian email');

    await prisma.siblingGroup.create({
      data: {
        tenantId,
        name: 'Test Sibling Group',
        members: {
          create: [
            { tenantId, studentId: s1.id, relationship: 'BROTHER' },
            { tenantId, studentId: s2.id, relationship: 'BROTHER' },
          ],
        },
      },
    });

    const res2 = await studentsService.listDuplicateStudentCandidates(
      { studentId: s1.id },
      actor,
    );
    expect(res2.candidates).toHaveLength(0);
  });

  it('should record transition entry when classId changes and retrieve lifecycle timeline', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'Transition',
        lastNameEn: 'User',
        dateOfBirth: '2010-01-01',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const otherClass = await prisma.class.create({
      data: {
        tenantId,
        name: 'Grade 11',
        level: 11,
      },
    });

    await studentsService.updateStudent(
      student.id,
      { classId: otherClass.id, confirmNoDisability: true },
      actor,
    );

    const timeline = await studentsService.getStudentLifecycleTimeline(
      student.id,
      actor,
    );

    expect(timeline.length).toBeGreaterThanOrEqual(2);
    const classChange = timeline.find(
      (t) => t.reason === 'Class placement updated',
    );
    expect(classChange).toBeDefined();
    expect((classChange?.metadata as any).classChange).toBe(true);
    expect((classChange?.metadata as any).fromClassId).toBe(classId);
    expect((classChange?.metadata as any).toClassId).toBe(otherClass.id);
  });

  it('should retrieve student iEMIS readiness diagnostics score and details', async () => {
    const student = await studentsService.createStudent(
      {
        firstNameEn: 'Readiness',
        lastNameEn: 'Tester',
        dateOfBirth: '2010-01-01',
        gender: 'FEMALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const diagnostics = await studentsService.getIemisReadiness(
      student.id,
      actor,
    );

    expect(diagnostics.studentId).toBe(student.id);
    expect(diagnostics.eligible).toBe(false);
    expect(diagnostics.score).toBeLessThan(100);
    expect(diagnostics.issues.some((i) => i.field === 'fullNameNp')).toBe(true);
    expect(diagnostics.issues.some((i) => i.field === 'guardianContact')).toBe(
      true,
    );
  });

  it('should retrieve student QR scan history from audit logs', async () => {
    const qrService = app.get<StudentQrService>(StudentQrService);

    const student = await studentsService.createStudent(
      {
        firstNameEn: 'QRScan',
        lastNameEn: 'Tester',
        dateOfBirth: '2010-01-01',
        gender: 'MALE',
        admissionDate: '2024-04-15',
        classId,
      },
      actor,
    );

    const { rawToken } = await qrService.generateQr(
      tenantId,
      student.id,
      actor,
    );

    await qrService.resolveQr(
      tenantId,
      rawToken!,
      'GENERAL_STUDENT_LOOKUP' as any,
      actor,
    );

    const scans = await qrService.getQrScanHistory(tenantId, student.id, actor);
    expect(scans.map((scan) => scan.action)).toEqual([
      'QR_RESOLVED',
      'QR_GENERATED',
    ]);
    expect(scans[0].purpose).toBe('GENERAL_STUDENT_LOOKUP');
    expect(scans[0].success).toBe(true);
  });
});
