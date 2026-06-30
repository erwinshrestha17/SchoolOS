import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, FileStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobileService } from './mobile.service';

describe('MobileService', () => {
  type MockModel<TMethods extends string> = Record<TMethods, jest.Mock>;
  interface MobileServicePrismaMock {
    guardian: MockModel<'findFirst'>;
    student: MockModel<'findFirst' | 'findMany'>;
    studentDocument: MockModel<'findMany' | 'findFirst'>;
    studentQrCredential: MockModel<'findFirst'>;
    invoice: MockModel<'findMany'>;
    notificationDelivery: MockModel<'findMany' | 'findFirst' | 'count'>;
    notificationReadReceipt: MockModel<'upsert' | 'createMany'>;
    homeworkAssignment: MockModel<'findMany' | 'findFirst'>;
    reportCard: MockModel<'findMany' | 'findFirst'>;
    examTimetableSlot: MockModel<'findMany'>;
    activityPost: MockModel<'findMany'>;
    canteenMealServing: MockModel<'findMany'>;
    transportStudentAssignment: MockModel<'findFirst'>;
    transportEnrollment: MockModel<'findFirst'>;
    transportTripStudentStatus: MockModel<'findFirst'>;
  }

  let prisma: MobileServicePrismaMock;
  let attendanceService: { getParentSummary: jest.Mock };
  let financeService: {
    getReceiptPdfForStudent: jest.Mock;
    getParentPaymentGatewayReadiness: jest.Mock;
    initiateParentOnlinePayment: jest.Mock;
    collectParentSandboxPayment: jest.Mock;
  };
  let canteenService: { topUpWallet: jest.Mock };
  let entitlementsService: { getEntitlements: jest.Mock };
  let reportCardPdfService: { getReportCardPdf: jest.Mock };
  let communicationsService: {
    getGuardianConsentStatus: jest.Mock;
    captureConsent: jest.Mock;
  };
  let homeworkAttachmentAccessService: { getAttachmentAccessUrl: jest.Mock };
  let fileRegistryService: {
    listFilesByEntity: jest.Mock;
    assertFileAccessForAuth: jest.Mock;
    auditAccess: jest.Mock;
    getFileMetadata: jest.Mock;
    getSignedUrl: jest.Mock;
  };
  let storageService: { getObjectBuffer: jest.Mock };
  let service: MobileService;
  let actor: AuthContext;

  beforeEach(() => {
    prisma = {
      guardian: {
        findFirst: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      studentQrCredential: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      invoice: {
        findMany: jest.fn(),
      },
      notificationDelivery: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      notificationReadReceipt: {
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
      homeworkAssignment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      reportCard: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      examTimetableSlot: {
        findMany: jest.fn(),
      },
      activityPost: {
        findMany: jest.fn(),
      },
      canteenMealServing: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      transportStudentAssignment: {
        findFirst: jest.fn(),
      },
      transportEnrollment: {
        findFirst: jest.fn(),
      },
      transportTripStudentStatus: {
        findFirst: jest.fn(),
      },
    };
    attendanceService = {
      getParentSummary: jest.fn(),
    };
    financeService = {
      getReceiptPdfForStudent: jest.fn(),
      getParentPaymentGatewayReadiness: jest.fn(),
      initiateParentOnlinePayment: jest.fn(),
      collectParentSandboxPayment: jest.fn(),
    };
    entitlementsService = {
      getEntitlements: jest.fn().mockResolvedValue({
        modules: [
          'students',
          'attendance',
          'fees',
          'homework',
          'activity',
          'transport',
          'canteen',
        ],
        features: [],
        addOns: [],
        tier: null,
      }),
    };
    reportCardPdfService = {
      getReportCardPdf: jest.fn(),
    };
    communicationsService = {
      getGuardianConsentStatus: jest.fn(),
      captureConsent: jest.fn(),
    };
    homeworkAttachmentAccessService = {
      getAttachmentAccessUrl: jest.fn(),
    };
    fileRegistryService = {
      listFilesByEntity: jest.fn().mockResolvedValue([]),
      assertFileAccessForAuth: jest.fn(),
      auditAccess: jest.fn(),
      getFileMetadata: jest.fn(),
      getSignedUrl: jest.fn(),
    };
    storageService = {
      getObjectBuffer: jest.fn(),
    };
    canteenService = {
      topUpWallet: jest.fn(),
    };
    service = new MobileService(
      prisma as never,
      attendanceService as never,
      financeService as never,
      entitlementsService as never,
      reportCardPdfService as never,
      communicationsService as never,
      homeworkAttachmentAccessService as never,
      fileRegistryService as never,
      storageService as never,
      canteenService as never,
    );
    actor = {
      userId: 'parent-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'parent@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['parent'],
      permissions: [],
    };
  });

  it('lists only linked students with an active lifecycle and enrollment', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-active' }],
    });
    prisma.student.findMany.mockResolvedValue([]);

    await expect(service.listMyStudents(actor)).resolves.toEqual({ items: [] });

    expect(prisma.guardian.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'parent-1',
      },
      select: {
        studentLinks: {
          where: {
            student: {
              lifecycleStatus: 'ACTIVE',
              enrollments: {
                some: { status: 'ACTIVE' },
              },
            },
          },
          select: { studentId: true },
        },
      },
    });
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          id: { in: ['student-active'] },
          lifecycleStatus: 'ACTIVE',
          enrollments: {
            some: { status: 'ACTIVE' },
          },
        },
      }),
    );
  });

  it('denies parent access to students outside their guardian links', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-other' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-allowed' }],
    });

    await expect(
      service.getStudentFeesSummary('student-other', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('fails closed immediately after a guardian link is removed', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst
      .mockResolvedValueOnce({
        id: 'guardian-1',
        studentLinks: [{ studentId: 'student-1' }],
      })
      .mockResolvedValueOnce({
        id: 'guardian-1',
        studentLinks: [],
      });
    prisma.invoice.findMany.mockResolvedValue([]);

    await expect(
      service.getStudentFeesSummary('student-1', actor),
    ).resolves.toEqual(expect.objectContaining({ totalOutstanding: 0 }));
    await expect(
      service.getStudentFeesSummary('student-1', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
  });

  it('denies student-only actors from generic parent mobile student surfaces', async () => {
    const studentActor: AuthContext = {
      ...actor,
      userId: 'student-user',
      email: 'student@school.test',
      roles: ['student'],
    };
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });

    await expect(service.listMyStudents(studentActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.getStudentAttendanceSummary('student-1', studentActor, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getStudentHomework('student-1', studentActor, '10'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getStudentTimetable('student-1', studentActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getStudentReportCards('student-1', studentActor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(attendanceService.getParentSummary).not.toHaveBeenCalled();
    expect(prisma.homeworkAssignment.findMany).not.toHaveBeenCalled();
    expect(prisma.reportCard.findMany).not.toHaveBeenCalled();
  });

  it('returns gateway readiness only after linked-child authorization', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    financeService.getParentPaymentGatewayReadiness.mockResolvedValue({
      enabled: true,
      status: 'ready',
      provider: { name: 'NEPAL_GATEWAY' },
    });

    await expect(
      service.getStudentPaymentGatewayReadiness('student-1', actor),
    ).resolves.toEqual(
      expect.objectContaining({ enabled: true, status: 'ready' }),
    );
  });

  it('initiates a linked-child payment through the purpose-limited finance boundary', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    financeService.initiateParentOnlinePayment.mockResolvedValue({
      id: 'intent-1',
      status: 'READY',
    });
    const dto = {
      invoiceId: 'invoice-1',
      amount: 500,
      provider: 'NEPAL_GATEWAY',
      idempotencyKey: 'parent-payment-test-0003',
    };

    await expect(
      service.initiateStudentPayment('student-1', dto, actor),
    ).resolves.toEqual({ id: 'intent-1', status: 'READY' });
    expect(financeService.initiateParentOnlinePayment).toHaveBeenCalledWith(
      'student-1',
      dto,
      actor,
    );
  });

  it('collects a linked-child fee through the sandbox finance boundary', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    financeService.collectParentSandboxPayment.mockResolvedValue({
      sandbox: true,
      status: 'SUCCEEDED',
      provider: 'ESEWA',
      receipt: { receiptNumber: 'REC-001' },
    });
    const dto = {
      invoiceId: 'invoice-1',
      amount: 500,
      provider: 'ESEWA' as const,
      idempotencyKey: 'parent-sandbox-fee-0001',
    };

    await expect(
      service.collectStudentSandboxFeePayment('student-1', dto, actor),
    ).resolves.toEqual(
      expect.objectContaining({ sandbox: true, status: 'SUCCEEDED' }),
    );
    expect(financeService.collectParentSandboxPayment).toHaveBeenCalledWith(
      'student-1',
      dto,
      actor,
    );
  });

  it('persists a linked-child sandbox canteen top-up as a mobile payment', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    financeService.getParentPaymentGatewayReadiness.mockResolvedValue({
      enabled: true,
      sandbox: true,
      providers: ['KHALTI'],
    });
    canteenService.topUpWallet.mockResolvedValue({
      wallet: { id: 'wallet-1', balance: 1500 },
      transaction: { id: 'transaction-1' },
    });
    const dto = {
      amount: 1000,
      provider: 'KHALTI' as const,
      idempotencyKey: 'parent-sandbox-canteen-0001',
    };

    await expect(
      service.topUpStudentCanteenSandbox('student-1', dto, actor),
    ).resolves.toEqual({
      sandbox: true,
      status: 'SUCCEEDED',
      provider: 'KHALTI',
      amount: 1000,
      wallet: { id: 'wallet-1', balance: 1500 },
      transactionId: 'transaction-1',
    });
    expect(canteenService.topUpWallet).toHaveBeenCalledWith(
      'student-1',
      {
        amount: 1000,
        note: 'Parent sandbox top-up via KHALTI',
        idempotencyKey: 'parent-sandbox-canteen:parent-sandbox-canteen-0001',
        paymentMethod: 'MOBILE',
      },
      actor,
    );
  });

  it('returns a parent-safe fee summary with paid and overdue totals', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        status: 'PARTIAL',
        dueDate: new Date('2026-01-10T00:00:00.000Z'),
        issuedAt: new Date('2025-12-20T00:00:00.000Z'),
        totalAmount: 200,
        payments: [{ amount: 50 }],
      },
      {
        id: 'invoice-2',
        invoiceNumber: 'INV-002',
        status: 'ISSUED',
        dueDate: new Date('2026-12-10T00:00:00.000Z'),
        issuedAt: new Date('2026-11-20T00:00:00.000Z'),
        totalAmount: 25.25,
        payments: [],
      },
      {
        id: 'invoice-3',
        invoiceNumber: 'INV-003',
        status: 'PAID',
        dueDate: new Date('2026-02-10T00:00:00.000Z'),
        issuedAt: new Date('2026-01-20T00:00:00.000Z'),
        totalAmount: 100,
        payments: [
          {
            id: 'payment-3',
            amount: 100,
            method: 'CASH',
            paidAt: new Date('2026-02-01T00:00:00.000Z'),
            receipt: {
              id: 'receipt-3',
              receiptNumber: 'REC-003',
              issuedAt: new Date('2026-02-01T00:01:00.000Z'),
            },
          },
        ],
      },
    ]);

    const summary = await service.getStudentFeesSummary('student-1', actor);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: 'student-1',
        }),
      }),
    );
    expect(summary).toEqual({
      status: 'PARTIAL',
      totalAmount: 325.25,
      paidAmount: 150,
      totalOutstanding: 175.25,
      overdueCount: 1,
      nextDueDate: '2026-01-10T00:00:00.000Z',
      recentInvoices: [
        expect.objectContaining({
          id: 'invoice-1',
          paidAmount: 50,
          outstandingAmount: 150,
          isOverdue: true,
          receipts: [],
        }),
        expect.objectContaining({
          id: 'invoice-2',
          paidAmount: 0,
          outstandingAmount: 25.25,
          isOverdue: false,
          receipts: [],
        }),
        expect.objectContaining({
          id: 'invoice-3',
          paidAmount: 100,
          outstandingAmount: 0,
          isOverdue: false,
          receipts: [
            {
              id: 'receipt-3',
              receiptNumber: 'REC-003',
              invoiceId: 'invoice-3',
              invoiceNumber: 'INV-003',
              paymentId: 'payment-3',
              amount: 100,
              method: 'CASH',
              paidAt: '2026-02-01T00:00:00.000Z',
              issuedAt: '2026-02-01T00:01:00.000Z',
            },
          ],
        }),
      ],
      recentReceipts: [
        {
          id: 'receipt-3',
          receiptNumber: 'REC-003',
          invoiceId: 'invoice-3',
          invoiceNumber: 'INV-003',
          paymentId: 'payment-3',
          amount: 100,
          method: 'CASH',
          paidAt: '2026-02-01T00:00:00.000Z',
          issuedAt: '2026-02-01T00:01:00.000Z',
        },
      ],
    });
  });

  it('returns class teacher details on linked-child profiles', async () => {
    const createdAt = new Date('2026-04-01T00:00:00.000Z');
    const verifiedAt = new Date('2026-04-02T00:00:00.000Z');
    const qrCreatedAt = new Date('2026-04-03T00:00:00.000Z');
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        section: null,
        rollNumber: 7,
        studentSystemId: 'SCH-001',
        admissionNumber: 'ADM-001',
        admissionDate: new Date('2026-04-01T00:00:00.000Z'),
        dateOfBirth: new Date('2017-02-03T00:00:00.000Z'),
        gender: 'FEMALE',
        bloodGroup: 'O+',
        nationality: 'Nepali',
        lifecycleStatus: 'ENROLLED',
        emergencyName: null,
        emergencyPhone: null,
        medicalConsentAt: null,
        medicalConditions: null,
        severeAllergies: null,
        specialNeeds: null,
        photoUsageConsentAt: new Date('2026-04-01T00:00:00.000Z'),
        dataProcessingConsentedAt: new Date('2026-04-01T00:00:00.000Z'),
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: {
          id: 'section-1',
          name: 'A',
          classTeacher: {
            id: 'staff-1',
            firstName: 'Mina',
            lastName: 'Shrestha',
          },
        },
        guardianLinks: [{ relation: 'Daughter' }],
        enrollments: [{ academicYear: { name: '2083' } }],
      });
    prisma.studentDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        kind: 'BIRTH_CERTIFICATE',
        status: 'VERIFIED',
        title: 'Birth certificate',
        fileName: 'birth.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1200,
        expiryDate: null,
        verifiedAt,
        createdAt,
        objectKey: 'private/object-key-is-not-selected',
        publicUrl: 'https://example.invalid/public.pdf',
      },
    ]);
    prisma.studentQrCredential.findFirst.mockResolvedValue({
      id: 'qr-1',
      status: 'ACTIVE',
      createdAt: qrCreatedAt,
      expiresAt: null,
      lastScannedAt: null,
      rotatedAt: null,
      revokedAt: null,
      tokenHash: 'hidden-hash',
    });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });

    const result = await service.getStudentProfile('student-1', actor);

    expect(result.profile.classTeacher).toEqual({
      id: 'staff-1',
      name: 'Mina Shrestha',
    });
    expect(result.child.classSection).toBe('Grade 4 - A');
    expect(result.profile.documents).toEqual([
      {
        id: 'doc-1',
        kind: 'BIRTH_CERTIFICATE',
        status: 'VERIFIED',
        title: 'Birth certificate',
        fileName: 'birth.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1200,
        expiryDate: null,
        verifiedAt: verifiedAt.toISOString(),
        uploadedAt: createdAt.toISOString(),
        downloadPath: '/mobile/students/student-1/documents/doc-1/download-url',
      },
    ]);
    expect(JSON.stringify(result.profile.documents)).not.toContain(
      'object-key',
    );
    expect(JSON.stringify(result.profile.documents)).not.toContain('public');
    expect(result.profile.qrStatus).toEqual({
      status: 'ACTIVE',
      credentialId: 'qr-1',
      createdAt: qrCreatedAt.toISOString(),
      expiresAt: null,
      lastScannedAt: null,
      rotatedAt: null,
      revokedAt: null,
    });
    expect(JSON.stringify(result.profile.qrStatus)).not.toContain(
      'hidden-hash',
    );
  });

  it('returns a protected parent document download URL after linked-child authorization', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.studentDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      studentId: 'student-1',
      fileId: 'file-1',
      kind: 'BIRTH_CERTIFICATE',
      status: 'ACTIVE',
      fileName: 'birth.pdf',
    });
    fileRegistryService.getFileMetadata.mockResolvedValue({
      id: 'file-1',
      tenantId: 'tenant-1',
      module: 'students',
      entityId: 'student-1',
      status: FileStatus.UPLOADED,
      originalFilename: 'birth.pdf',
    });
    fileRegistryService.getSignedUrl.mockResolvedValue(
      'https://signed.example/birth.pdf',
    );

    await expect(
      service.getStudentDocumentDownloadUrl('student-1', 'doc-1', actor),
    ).resolves.toEqual({
      documentId: 'doc-1',
      studentId: 'student-1',
      fileName: 'birth.pdf',
      kind: 'BIRTH_CERTIFICATE',
      url: 'https://signed.example/birth.pdf',
      expiresInSeconds: 60,
    });
    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      'tenant-1',
      'file-1',
      'parent-1',
      'download',
    );
  });

  it('returns subject grade summaries for published linked-child report cards', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.reportCard.findMany.mockResolvedValue([
      {
        id: 'report-card-1',
        examTermId: 'term-1',
        academicYear: { id: 'year-1', name: '2083' },
        examTerm: { id: 'term-1', name: 'First Terminal Examination' },
        totalMarks: 170,
        maxMarks: 200,
        percentage: 85,
        grade: 'A',
        gpa: 3.7,
        remarks: 'Strong progress',
        publishedAt: new Date('2026-06-01T00:00:00.000Z'),
        fileId: 'file-1',
        version: 2,
        subjectResults: [
          {
            version: 1,
            subjectId: 'subject-old',
            subjectName: 'Stale draft',
            subjectCode: 'OLD',
            marksObtained: 10,
            maxMarks: 100,
            percentage: 10,
            grade: 'NG',
          },
          {
            version: 2,
            subjectId: 'subject-1',
            subjectName: 'Mathematics',
            subjectCode: 'MATH',
            marksObtained: 85,
            maxMarks: 100,
            percentage: 85,
            grade: 'A',
          },
          {
            version: 2,
            subjectId: 'subject-2',
            subjectName: 'English',
            subjectCode: 'ENG',
            marksObtained: 35,
            maxMarks: 50,
            percentage: 70,
            grade: 'B+',
          },
        ],
      },
    ]);

    const result = await service.getStudentReportCards('student-1', actor);

    expect(prisma.reportCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          subjectResults: expect.any(Object),
        }),
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: 'student-1',
          publishStatus: 'PUBLISHED',
        }),
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'report-card-1',
        classTeacherRemark: 'Strong progress',
        subjects: [
          {
            subjectId: 'subject-1',
            subjectName: 'Mathematics',
            marksObtained: 85,
            maxMarks: 100,
            percentage: 85,
            grade: 'A',
          },
          {
            subjectId: 'subject-2',
            subjectName: 'English',
            marksObtained: 35,
            maxMarks: 50,
            percentage: 70,
            grade: 'B+',
          },
        ],
      }),
    );
  });

  it('returns only published exam slots for the linked child current enrollment', async () => {
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { id: 'class-1', name: 'Grade 5' },
        sectionRef: { id: 'section-1', name: 'A' },
        guardianLinks: [{ guardian: { userId: 'parent-1' } }],
        enrollments: [
          {
            academicYearId: 'year-1',
            academicYear: {
              id: 'year-1',
              name: '2083/84',
              startsOn: new Date('2026-04-14T00:00:00.000Z'),
              endsOn: new Date('2027-04-13T00:00:00.000Z'),
            },
          },
        ],
      });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.examTimetableSlot.findMany.mockResolvedValue([
      {
        id: 'exam-slot-1',
        startsAt: new Date('2026-07-10T03:30:00.000Z'),
        endsAt: new Date('2026-07-10T04:30:00.000Z'),
        room: 'Room 4',
        publishedAt: new Date('2026-07-01T00:00:00.000Z'),
        examTerm: { id: 'term-1', name: 'First Terminal' },
        subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
      },
    ]);

    const result = await service.getStudentExamSchedule('student-1', actor);

    expect(prisma.examTimetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          publishedAt: { not: null },
          OR: [{ sectionId: null }, { sectionId: 'section-1' }],
        },
        take: 100,
      }),
    );
    expect(result).toEqual({
      academicYear: { id: 'year-1', name: '2083/84' },
      items: [
        expect.objectContaining({
          id: 'exam-slot-1',
          room: 'Room 4',
          subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
        }),
      ],
    });
  });

  it('lists notifications for the signed-in parent and linked students with read state', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'notice-1',
        title: 'Fee reminder',
        body: 'Term fee due.',
        sourceType: 'NOTICE',
        sourceId: 'source-1',
        channel: 'PUSH',
        status: 'SENT',
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
        sentAt: new Date('2026-05-01T08:01:00.000Z'),
        readReceipts: [],
      },
      {
        id: 'notice-2',
        title: 'Trip update',
        body: 'Bus delayed.',
        sourceType: 'TRANSPORT',
        sourceId: 'trip-1',
        channel: 'PUSH',
        status: 'SENT',
        createdAt: new Date('2026-05-01T09:00:00.000Z'),
        sentAt: null,
        readReceipts: [{ readAt: new Date('2026-05-01T10:00:00.000Z') }],
      },
    ]);
    prisma.notificationDelivery.count.mockResolvedValue(1);

    const result = await service.listNotifications(actor);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { recipientUserId: 'parent-1' },
            { studentId: { in: ['student-1'] } },
          ],
        },
      }),
    );
    expect(result.unreadCount).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'notice-1',
        message: 'Term fee due.',
        isRead: false,
      }),
      expect.objectContaining({
        id: 'notice-2',
        readAt: '2026-05-01T10:00:00.000Z',
        isRead: true,
      }),
    ]);
  });

  it('scopes parent dashboard notifications to the active child and global parent items', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);

    await service.listNotifications(actor, {}, ['student-1']);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [
            { recipientUserId: 'parent-1', studentId: null },
            { studentId: { in: ['student-1'] } },
          ],
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        OR: [
          { recipientUserId: 'parent-1', studentId: null },
          { studentId: { in: ['student-1'] } },
        ],
      }),
    });
  });

  it('returns a parent-scoped unread count without loading notification bodies', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.count.mockResolvedValue(3);

    await expect(service.getNotificationUnreadCount(actor)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        OR: [
          { recipientUserId: 'parent-1' },
          { studentId: { in: ['student-1'] } },
        ],
        readReceipts: {
          none: { tenantId: 'tenant-1', userId: 'parent-1' },
        },
      },
    });
  });

  it('marks only the signed-in parents visible unread notifications as read', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'delivery-1' },
      { id: 'delivery-2' },
    ]);
    prisma.notificationReadReceipt.createMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllNotificationsRead(actor)).resolves.toEqual({
      success: true,
      markedCount: 2,
    });
    expect(prisma.notificationReadReceipt.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-1',
          userId: 'parent-1',
        },
        {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-2',
          userId: 'parent-1',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('marks only parent-visible mobile notifications as read', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
    });
    prisma.notificationReadReceipt.upsert.mockResolvedValue({
      notificationDeliveryId: 'delivery-1',
    });

    await expect(
      service.markNotificationRead('delivery-1', actor),
    ).resolves.toEqual({ success: true });

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'delivery-1',
        tenantId: 'tenant-1',
        OR: [
          { recipientUserId: 'parent-1' },
          { studentId: { in: ['student-1'] } },
        ],
      },
      select: { id: true },
    });
    expect(prisma.notificationReadReceipt.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_notificationDeliveryId_userId: {
          tenantId: 'tenant-1',
          notificationDeliveryId: 'delivery-1',
          userId: 'parent-1',
        },
      },
      create: {
        tenantId: 'tenant-1',
        notificationDeliveryId: 'delivery-1',
        userId: 'parent-1',
      },
      update: { readAt: expect.any(Date) },
    });
  });

  it('returns only an exact parent-visible notification detail', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      title: 'Bus update',
      body: 'The bus has arrived.',
      sourceType: 'TRANSPORT',
      sourceId: 'trip-1',
      channel: 'PUSH',
      status: 'SENT',
      createdAt: new Date('2026-05-01T08:00:00.000Z'),
      sentAt: new Date('2026-05-01T08:01:00.000Z'),
      readReceipts: [],
    });

    await expect(
      service.getNotificationDetail('delivery-1', actor),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'delivery-1',
        message: 'The bus has arrived.',
        isRead: false,
      }),
    );
    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'delivery-1',
          tenantId: 'tenant-1',
          OR: [
            { recipientUserId: 'parent-1' },
            { studentId: { in: ['student-1'] } },
          ],
        },
      }),
    );
    expect(fileRegistryService.listFilesByEntity).not.toHaveBeenCalled();
  });

  it('returns a parent-safe notice attachment descriptor and streams through File Registry', async () => {
    const fileContent = Buffer.from('%PDF notice');
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-1',
      title: 'Circular',
      body: 'Please read the attachment.',
      sourceType: 'NOTICE',
      sourceId: 'notice-1',
      noticeId: 'notice-1',
      studentId: 'student-1',
      channel: 'PUSH',
      status: 'SENT',
      createdAt: new Date('2026-05-01T08:00:00.000Z'),
      sentAt: new Date('2026-05-01T08:01:00.000Z'),
      readReceipts: [],
    });
    fileRegistryService.listFilesByEntity.mockResolvedValue([
      {
        id: 'file-1',
        originalFilename: 'circular.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(1024),
        objectKey: 'tenant-1/notices/circular.pdf',
      },
    ]);
    storageService.getObjectBuffer.mockResolvedValue(fileContent);

    await expect(
      service.getNotificationDetail('delivery-1', actor),
    ).resolves.toEqual(
      expect.objectContaining({
        attachment: {
          id: 'file-1',
          fileName: 'circular.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          downloadPath: '/mobile/me/notifications/delivery-1/attachment',
        },
      }),
    );

    await expect(
      service.getNotificationAttachment('delivery-1', actor),
    ).resolves.toEqual({
      fileName: 'circular.pdf',
      mimeType: 'application/pdf',
      content: fileContent,
    });
    expect(fileRegistryService.assertFileAccessForAuth).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-1' }),
      actor,
    );
    expect(fileRegistryService.auditAccess).toHaveBeenCalledWith(
      'tenant-1',
      'file-1',
      'parent-1',
      'download',
    );
    expect(storageService.getObjectBuffer).toHaveBeenCalledWith(
      'tenant-1/notices/circular.pdf',
    );
  });

  it('does not query disabled module data for the parent dashboard', async () => {
    jest.spyOn(service, 'listMyStudents').mockResolvedValue({
      items: [
        {
          id: 'student-1',
          name: 'Asha Rai',
          classSection: 'Grade 4 - A',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: '7',
          academicYear: '2082',
          academicYearStartsOn: '2025-04-14T00:00:00.000Z',
          academicYearEndsOn: '2026-04-13T00:00:00.000Z',
          relationship: 'Daughter',
        },
      ],
    });
    jest.spyOn(service, 'getStudentProfile').mockResolvedValue({
      child: { id: 'student-1' },
      profile: {},
    } as never);
    jest.spyOn(service, 'listNotifications').mockResolvedValue({
      unreadCount: 0,
      items: [],
      nextCursor: null,
    });
    const attendanceSpy = jest.spyOn(service, 'getStudentAttendanceSummary');
    const feesSpy = jest.spyOn(service, 'getStudentFeesSummary');
    const homeworkSpy = jest.spyOn(service, 'getStudentHomework');
    const transportSpy = jest.spyOn(service, 'getStudentTransport');
    const canteenSpy = jest.spyOn(service, 'getStudentCanteen');
    const activitySpy = jest.spyOn(service, 'getStudentActivityFeed');
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students'],
      features: [],
      addOns: [],
      tier: null,
    });

    const result = await service.getDashboard(actor, 'student-1');

    expect(result.modules).toEqual({
      attendance: false,
      fees: false,
      homework: false,
      activity: false,
      transport: false,
      canteen: false,
    });
    expect(result.attendance).toBeNull();
    expect(result.fees).toBeNull();
    expect(result.homework).toBeNull();
    expect(service.listNotifications).toHaveBeenCalledWith(actor, {}, [
      'student-1',
    ]);
    expect(attendanceSpy).not.toHaveBeenCalled();
    expect(feesSpy).not.toHaveBeenCalled();
    expect(homeworkSpy).not.toHaveBeenCalled();
    expect(transportSpy).not.toHaveBeenCalled();
    expect(canteenSpy).not.toHaveBeenCalled();
    expect(activitySpy).not.toHaveBeenCalled();
  });

  it('rejects an unlinked dashboard child before loading any child-scoped module', async () => {
    jest.spyOn(service, 'listMyStudents').mockResolvedValue({
      items: [
        {
          id: 'student-allowed',
          name: 'Asha Rai',
          classSection: 'Grade 4 - A',
          classId: 'class-1',
          sectionId: 'section-1',
          rollNumber: '7',
          academicYear: '2082',
          academicYearStartsOn: '2025-04-14T00:00:00.000Z',
          academicYearEndsOn: '2026-04-13T00:00:00.000Z',
          relationship: 'Daughter',
        },
      ],
    });
    const notificationsSpy = jest.spyOn(service, 'listNotifications');

    await expect(
      service.getDashboard(actor, 'student-other'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(entitlementsService.getEntitlements).not.toHaveBeenCalled();
    expect(notificationsSpy).not.toHaveBeenCalled();
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    expect(prisma.homeworkAssignment.findMany).not.toHaveBeenCalled();
  });

  it('returns protected activity preview paths without storage internals', async () => {
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        tenantId: 'tenant-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: { id: 'section-1', name: 'A' },
        guardianLinks: [],
        enrollments: [],
      });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.activityPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Science day',
        caption: 'Students built models.',
        category: 'LEARNING',
        publishedAt: new Date('2026-06-29T00:00:00.000Z'),
        createdAt: new Date('2026-06-29T00:00:00.000Z'),
        attachments: [
          {
            id: 'attachment-1',
            fileName: 'science.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 2048,
            processingStatus: 'READY',
            objectKey: 'must-not-leak',
          },
        ],
        _count: { attachments: 1, reactions: 2 },
      },
    ]);

    const result = await service.getStudentActivityFeed(
      'student-1',
      actor,
      '10',
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'post-1',
        attachments: [
          {
            id: 'attachment-1',
            fileName: 'science.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 2048,
            processingStatus: 'READY',
            previewPath: '/activity-feed/attachments/attachment-1/preview',
          },
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('returns homework scoped to the linked child class and section', async () => {
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        tenantId: 'tenant-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        section: null,
        rollNumber: 7,
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: { id: 'section-1', name: 'A' },
        guardianLinks: [],
        enrollments: [],
      });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.homeworkAssignment.findMany.mockResolvedValue([
      {
        id: 'homework-1',
        title: 'Fractions worksheet',
        subject: { id: 'subject-1', name: 'Math', code: 'MATH' },
        status: 'ASSIGNED',
        assignedDate: new Date('2026-05-01T00:00:00.000Z'),
        dueDate: new Date('2026-05-03T00:00:00.000Z'),
        dueAt: new Date('2026-05-03T18:00:00.000Z'),
        submissionRequired: true,
        submissions: [
          {
            id: 'submission-1',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-05-02T12:00:00.000Z'),
            score: 18.5,
            feedback: 'Good work',
            returnedAt: null,
          },
        ],
        _count: { attachments: 2 },
      },
    ]);

    const result = await service.getStudentHomework('student-1', actor, '10');

    expect(prisma.homeworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          classId: 'class-1',
          OR: [{ sectionId: null }, { sectionId: 'section-1' }],
        }),
        take: 10,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'homework-1',
        submissionStatus: 'SUBMITTED',
        score: 18.5,
        attachmentCount: 2,
      }),
    ]);
  });

  it('lists homework attachments only for linked-child visible assignments', async () => {
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        tenantId: 'tenant-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        section: null,
        rollNumber: 7,
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: { id: 'section-1', name: 'A' },
        guardianLinks: [],
        enrollments: [],
      });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.homeworkAssignment.findFirst.mockResolvedValue({
      id: 'homework-1',
      attachments: [
        {
          id: 'attachment-1',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          fileAsset: {
            originalFilename: 'worksheet.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
          },
        },
      ],
    });

    await expect(
      service.getStudentHomeworkAttachments('student-1', 'homework-1', actor),
    ).resolves.toEqual({
      homeworkId: 'homework-1',
      items: [
        {
          id: 'attachment-1',
          fileName: 'worksheet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    expect(prisma.homeworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'homework-1',
          tenantId: 'tenant-1',
          classId: 'class-1',
          OR: [{ sectionId: null }, { sectionId: 'section-1' }],
        }),
      }),
    );
  });

  it('delegates homework attachment download after linked-child visibility check', async () => {
    prisma.student.findFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce({
        id: 'student-1',
        tenantId: 'tenant-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: null,
        section: null,
        rollNumber: 7,
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: null,
        guardianLinks: [],
        enrollments: [],
      });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.homeworkAssignment.findFirst.mockResolvedValue({
      id: 'homework-1',
      attachments: [
        {
          id: 'attachment-1',
          createdAt: new Date(),
          fileAsset: {
            originalFilename: 'worksheet.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
          },
        },
      ],
    });
    homeworkAttachmentAccessService.getAttachmentAccessUrl.mockResolvedValue({
      attachmentId: 'attachment-1',
      url: 'signed-url',
    });

    await expect(
      service.getStudentHomeworkAttachmentDownloadUrl(
        'student-1',
        'homework-1',
        'attachment-1',
        actor,
      ),
    ).resolves.toEqual({ attachmentId: 'attachment-1', url: 'signed-url' });
    expect(
      homeworkAttachmentAccessService.getAttachmentAccessUrl,
    ).toHaveBeenCalledWith('attachment-1', actor, 'download');
  });

  it('returns parent-safe transport route, vehicle, and latest location detail', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.transportStudentAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      route: { id: 'route-1', name: 'Route A', code: 'R-A' },
      stop: { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      pickupDirection: 'PICKUP',
      status: 'ACTIVE',
    });
    prisma.transportEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      route: { id: 'route-1', name: 'Route A', code: 'R-A' },
      stop: { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      feeAmount: 1200,
      status: 'ACTIVE',
    });
    prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
      status: 'BOARDED',
      stop: { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      trip: {
        id: 'trip-1',
        route: { id: 'route-1', name: 'Route A', code: 'R-A' },
        vehicle: {
          id: 'vehicle-1',
          registrationNumber: 'BA-1-PA-1234',
          model: 'Bus 3',
          capacity: 32,
        },
        direction: 'PICKUP',
        status: 'ACTIVE',
        isDelayed: true,
        delayMinutes: 12,
        delayReason: 'Traffic near Ring Road',
        locationPings: [
          {
            latitude: 27.7101,
            longitude: 85.3222,
            speedKph: 18.5,
            recordedAt: new Date('2026-06-02T07:45:00.000Z'),
          },
        ],
      },
    });

    const result = await service.getStudentTransport('student-1', actor);

    expect(prisma.transportTripStudentStatus.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: 'student-1',
        }),
      }),
    );
    expect(result.activeTrip).toEqual(
      expect.objectContaining({
        id: 'trip-1',
        direction: 'PICKUP',
        status: 'ACTIVE',
        studentStatus: 'BOARDED',
        isDelayed: true,
        delayMinutes: 12,
        delayReason: 'Traffic near Ring Road',
        vehicle: expect.objectContaining({
          registrationNumber: 'BA-1-PA-1234',
          model: 'Bus 3',
          capacity: 32,
        }),
        latestLocation: {
          latitude: 27.7101,
          longitude: 85.3222,
          speedKph: 18.5,
          recordedAt: '2026-06-02T07:45:00.000Z',
          ageSeconds: expect.any(Number),
          confidence: 'stale',
          isStale: true,
        },
      }),
    );
  });

  it('streams receipt PDFs only after linked-child access is verified', async () => {
    const pdf = Buffer.from('%PDF parent receipt');
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    financeService.getReceiptPdfForStudent.mockResolvedValue(pdf);

    const result = await service.getStudentReceiptPdf(
      'student-1',
      'REC-001',
      actor,
    );

    expect(result).toBe(pdf);
    expect(financeService.getReceiptPdfForStudent).toHaveBeenCalledWith(
      'REC-001',
      'student-1',
      actor,
    );
  });

  it('streams only published linked-child report-card PDFs', async () => {
    const pdf = Buffer.from('%PDF report card');
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    prisma.reportCard.findFirst.mockResolvedValue({ id: 'report-card-1' });
    reportCardPdfService.getReportCardPdf.mockResolvedValue(pdf);

    await expect(
      service.getStudentReportCardPdf('student-1', 'report-card-1', actor),
    ).resolves.toBe(pdf);
    expect(prisma.reportCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'report-card-1',
        tenantId: 'tenant-1',
        studentId: 'student-1',
        isCurrent: true,
        publishStatus: 'PUBLISHED',
      },
      select: { id: true },
    });
    expect(reportCardPdfService.getReportCardPdf).toHaveBeenCalledWith(
      'report-card-1',
      actor,
    );
  });

  it('returns signed-in guardian consent status through the communications module', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    communicationsService.getGuardianConsentStatus.mockResolvedValue([
      {
        guardianId: 'guardian-1',
        consentType: 'PHOTO_USAGE',
        granted: true,
        latestConsentId: 'consent-1',
        version: 'v1',
        capturedAt: new Date('2026-06-01T00:00:00.000Z'),
        revokedAt: null,
      },
    ]);

    await expect(service.getMyConsentStatus(actor)).resolves.toEqual({
      guardianId: 'guardian-1',
      items: [
        {
          guardianId: 'guardian-1',
          consentType: 'PHOTO_USAGE',
          granted: true,
          latestConsentId: 'consent-1',
          version: 'v1',
          capturedAt: '2026-06-01T00:00:00.000Z',
          revokedAt: null,
        },
      ],
    });
    expect(communicationsService.getGuardianConsentStatus).toHaveBeenCalledWith(
      'guardian-1',
      actor,
    );
  });

  it('captures signed-in guardian consent decisions through the communications module', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [{ studentId: 'student-1' }],
    });
    communicationsService.captureConsent.mockResolvedValue({
      consentType: 'MESSAGING',
      granted: true,
      version: 'policy-v2',
      capturedAt: new Date('2026-06-20T00:00:00.000Z'),
      revokedAt: null,
    });

    await expect(
      service.decideMyConsent(
        {
          consentType: 'MESSAGING',
          version: 'policy-v2',
          granted: true,
        },
        actor,
      ),
    ).resolves.toEqual({
      consentType: 'MESSAGING',
      granted: true,
      version: 'policy-v2',
      capturedAt: '2026-06-20T00:00:00.000Z',
      revokedAt: null,
    });
    expect(communicationsService.captureConsent).toHaveBeenCalledWith(
      {
        guardianId: 'guardian-1',
        consentType: 'MESSAGING',
        version: 'policy-v2',
        granted: true,
        metadata: {
          source: 'mobile_guardian',
          childLinkVerified: true,
        },
      },
      actor,
    );
  });

  it('denies guardian consent decisions without a linked child', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [],
    });

    await expect(
      service.decideMyConsent(
        {
          consentType: 'MESSAGING',
          version: 'policy-v2',
          granted: false,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(communicationsService.captureConsent).not.toHaveBeenCalled();
  });
});
