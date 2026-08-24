import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthMethod, FileStatus, GuardianCapability } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobileService } from './mobile.service';
import { ParentScopeContextService } from './parent-scope-context.service';
import { createPassThroughRequestCache } from '../../test/helpers/request-cache';

/**
 * `StudentGuardian.capabilities` is a scalar list, so PostgreSQL always returns
 * it on the relationship row. Guardian-scope checks read the column directly
 * rather than filtering on it in SQL, so fixtures representing an authorized
 * relationship must carry it. Tests that exercise capability *denial* set a
 * narrower list explicitly — see the capability-scope describe block.
 */
const ALL_GUARDIAN_CAPABILITIES = Object.values(GuardianCapability);

const EMERGENCY_NOTIFICATION_SOURCE_FILTER = {
  contains: 'emergency',
  mode: 'insensitive',
};

function expectedNotificationRecipientScope(
  userId: string,
  schoolCommunicationStudentIds: string[] = [],
  emergencyAlertStudentIds: string[] = [],
) {
  return [
    { recipientUserId: userId, studentId: null },
    ...(schoolCommunicationStudentIds.length > 0
      ? [
          {
            recipientUserId: userId,
            studentId: { in: schoolCommunicationStudentIds },
            NOT: { sourceType: EMERGENCY_NOTIFICATION_SOURCE_FILTER },
          },
        ]
      : []),
    ...(emergencyAlertStudentIds.length > 0
      ? [
          {
            recipientUserId: userId,
            studentId: { in: emergencyAlertStudentIds },
            sourceType: EMERGENCY_NOTIFICATION_SOURCE_FILTER,
          },
        ]
      : []),
  ];
}

interface NotificationVisibilityWhere {
  AND: { OR?: unknown[] }[];
}

function notificationVisibilityWhere(
  mock: jest.Mock,
  callIndex = 0,
): NotificationVisibilityWhere {
  const calls = mock.mock.calls as unknown as {
    where: NotificationVisibilityWhere;
  }[][];
  const query = calls[callIndex]?.[0];
  if (!query) {
    throw new Error(`Expected notification query call ${String(callIndex)}`);
  }
  return query.where;
}

describe('MobileService', () => {
  type MockModel<TMethods extends string> = Record<TMethods, jest.Mock>;
  interface MobileServicePrismaMock {
    guardian: MockModel<'findFirst'>;
    student: MockModel<'findFirst' | 'findMany'>;
    studentDocument: MockModel<'findMany' | 'findFirst'>;
    studentQrCredential: MockModel<'findFirst'>;
    invoice: MockModel<'findMany'>;
    invoiceLine: MockModel<'findMany'>;
    payment: MockModel<'findMany'>;
    paymentAllocation: MockModel<'findMany'>;
    receipt: MockModel<'findMany'>;
    feeHead: MockModel<'findMany'>;
    feeWaiver: MockModel<'findMany'>;
    paymentRefund: MockModel<'findMany'>;
    notificationDelivery: MockModel<'findMany' | 'findFirst' | 'count'>;
    notificationReadReceipt: MockModel<'upsert' | 'createMany'>;
    homeworkAssignment: MockModel<'findMany' | 'findFirst'>;
    reportCard: MockModel<'findMany' | 'findFirst'>;
    examTimetableSlot: MockModel<'findMany'>;
    activityPost: MockModel<'findMany'>;
    activityAttachment: MockModel<'findMany'>;
    activityReaction: MockModel<'findMany'>;
    canteenWallet: MockModel<'findFirst'>;
    canteenStudentEnrollment: MockModel<'findMany'>;
    canteenWalletTransaction: MockModel<'findMany'>;
    canteenMenuItem: MockModel<'findMany'>;
    canteenMealPlan: MockModel<'findMany'>;
    canteenMealServing: MockModel<'findMany'>;
    transportStudentAssignment: MockModel<'findFirst'>;
    transportEnrollment: MockModel<'findFirst'>;
    transportTripStudentStatus: MockModel<'findFirst'>;
    transportTrip: MockModel<'findFirst'>;
    transportRoute: MockModel<'findMany'>;
    transportStop: MockModel<'findMany'>;
    transportVehicle: MockModel<'findFirst'>;
    transportLocationPing: MockModel<'findFirst'>;
  }

  let prisma: MobileServicePrismaMock;
  let attendanceService: {
    getParentSummary: jest.Mock;
    listParentCorrectionRequests: jest.Mock;
    createParentCorrectionRequest: jest.Mock;
    cancelParentCorrectionRequest: jest.Mock;
  };
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
  let serviceRequestsService: {
    listParentRequests: jest.Mock;
    createParentRequest: jest.Mock;
    getParentRequest: jest.Mock;
    cancelParentRequest: jest.Mock;
    confirmParentResolution: jest.Mock;
    reopenParentRequest: jest.Mock;
    uploadParentAttachment: jest.Mock;
    downloadAttachment: jest.Mock;
  };
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoiceLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      receipt: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      feeHead: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      feeWaiver: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentRefund: {
        findMany: jest.fn().mockResolvedValue([]),
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
      activityAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      activityReaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      canteenWallet: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      canteenStudentEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      canteenWalletTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      canteenMenuItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      canteenMealPlan: {
        findMany: jest.fn().mockResolvedValue([]),
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
      transportTrip: {
        findFirst: jest.fn(),
      },
      transportRoute: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      transportStop: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      transportVehicle: {
        findFirst: jest.fn(),
      },
      transportLocationPing: {
        findFirst: jest.fn(),
      },
    };
    attendanceService = {
      getParentSummary: jest.fn(),
      listParentCorrectionRequests: jest.fn(),
      createParentCorrectionRequest: jest.fn(),
      cancelParentCorrectionRequest: jest.fn(),
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
    serviceRequestsService = {
      listParentRequests: jest.fn(),
      createParentRequest: jest.fn(),
      getParentRequest: jest.fn(),
      cancelParentRequest: jest.fn(),
      confirmParentResolution: jest.fn(),
      reopenParentRequest: jest.fn(),
      uploadParentAttachment: jest.fn(),
      downloadAttachment: jest.fn(),
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
      serviceRequestsService as never,
      // Real context service over the same Prisma mock, with memoization
      // disabled (no CLS context). Every existing assertion on the mock's call
      // counts therefore still sees each underlying query, so this spec keeps
      // testing the queries themselves rather than the cache.
      new ParentScopeContextService(
        prisma as never,
        createPassThroughRequestCache(),
      ),
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
      studentLinks: [
        {
          studentId: 'student-active',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
          where: expect.objectContaining({
            status: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            approvalStatus: 'APPROVED',
            student: expect.objectContaining({
              lifecycleStatus: 'ACTIVE',
              enrollments: {
                some: { status: 'ACTIVE' },
              },
            }),
          }),
          // `capabilities` is now selected so capability filtering happens in
          // memory against one query, instead of one query per capability.
          // The security predicates above are unchanged.
          select: { studentId: true, capabilities: true },
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

  it('returns the linked guardian relationship and primary status', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-active',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-active',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: { id: 'section-1', name: 'A' },
        section: null,
        sectionId: 'section-1',
        rollNumber: 7,
        guardianLinks: [
          {
            relation: 'Father',
            isPrimary: true,
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
            verificationStatus: 'VERIFIED',
            status: 'ACTIVE',
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            effectiveUntil: null,
            approvalStatus: 'APPROVED',
            emergencyContactPriority: 1,
            guardian: { id: 'guardian-1', userId: 'parent-1' },
          },
        ],
        enrollments: [
          {
            academicYear: {
              name: '2083',
              startsOn: new Date('2026-04-14T00:00:00.000Z'),
              endsOn: new Date('2027-04-13T00:00:00.000Z'),
            },
          },
        ],
      },
    ]);

    const result = await service.listMyStudents(actor);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        relationship: 'Father',
        isPrimaryGuardian: true,
      }),
    );
  });

  it('denies parent access to students outside their guardian links', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-other' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [],
    });

    await expect(
      service.getStudentFeesSummary('student-other', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });

  it('delegates linked-child attendance corrections through the M2 service', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    attendanceService.listParentCorrectionRequests.mockResolvedValue({
      items: [],
      total: 0,
    });
    attendanceService.createParentCorrectionRequest.mockResolvedValue({
      id: 'correction-1',
      status: 'PENDING',
    });
    attendanceService.cancelParentCorrectionRequest.mockResolvedValue({
      id: 'correction-1',
      status: 'CANCELLED',
    });

    await service.listStudentAttendanceCorrections('student-1', actor);
    await service.createStudentAttendanceCorrection(
      'student-1',
      {
        confirmStudentId: 'student-1',
        attendanceDate: '2026-07-24',
        requestedStatus: 'PRESENT',
        reason: 'The child attended the full school day.',
      },
      actor,
    );
    await service.cancelStudentAttendanceCorrection(
      'student-1',
      'correction-1',
      {
        confirmStudentId: 'student-1',
        reason: 'The original request was submitted by mistake.',
      },
      actor,
    );

    expect(attendanceService.listParentCorrectionRequests).toHaveBeenCalledWith(
      'student-1',
      actor,
    );
    expect(
      attendanceService.createParentCorrectionRequest,
    ).toHaveBeenCalledWith(
      {
        studentId: 'student-1',
        attendanceDate: '2026-07-24',
        requestedStatus: 'PRESENT',
        reason: 'The child attended the full school day.',
      },
      actor,
    );
    expect(
      attendanceService.cancelParentCorrectionRequest,
    ).toHaveBeenCalledWith(
      'correction-1',
      'The original request was submitted by mistake.',
      actor,
    );
  });

  it('fails closed immediately after a guardian link is removed', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst
      .mockResolvedValueOnce({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'guardian-1',
        studentLinks: [],
      });
    prisma.invoice.findMany.mockResolvedValue([]);

    await expect(
      service.getStudentFeesSummary('student-1', actor),
    ).resolves.toEqual(expect.objectContaining({ totalOutstanding: '0.00' }));
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    financeService.initiateParentOnlinePayment.mockResolvedValue({
      id: 'intent-1',
      status: 'READY',
    });
    const dto = {
      confirmStudentId: 'student-1',
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

  it('rejects parent payment initiation when confirmStudentId mismatches the route child', async () => {
    const dto = {
      confirmStudentId: 'student-2',
      invoiceId: 'invoice-1',
      amount: 500,
      provider: 'NEPAL_GATEWAY',
      idempotencyKey: 'parent-payment-test-mismatch',
    };

    await expect(
      service.initiateStudentPayment('student-1', dto, actor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'GUARDIAN_CHILD_CONFIRMATION_MISMATCH',
        expectedStudentId: 'student-1',
      }),
    });
    expect(financeService.initiateParentOnlinePayment).not.toHaveBeenCalled();
  });

  it('collects a linked-child fee through the sandbox finance boundary', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    financeService.collectParentSandboxPayment.mockResolvedValue({
      sandbox: true,
      status: 'SUCCEEDED',
      provider: 'ESEWA',
      receipt: { receiptNumber: 'REC-001' },
    });
    const dto = {
      confirmStudentId: 'student-1',
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      confirmStudentId: 'student-1',
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        status: 'PARTIAL',
        dueDate: new Date('2026-01-10T00:00:00.000Z'),
        issuedAt: new Date('2025-12-20T00:00:00.000Z'),
        subtotal: 200,
        vatAmount: 0,
        totalAmount: 200,
      },
      {
        id: 'invoice-2',
        invoiceNumber: 'INV-002',
        status: 'ISSUED',
        dueDate: new Date('2026-12-10T00:00:00.000Z'),
        issuedAt: new Date('2026-11-20T00:00:00.000Z'),
        subtotal: 25.25,
        vatAmount: 0,
        totalAmount: 25.25,
      },
      {
        id: 'invoice-3',
        invoiceNumber: 'INV-003',
        status: 'PAID',
        dueDate: new Date('2026-02-10T00:00:00.000Z'),
        issuedAt: new Date('2026-01-20T00:00:00.000Z'),
        subtotal: 100,
        vatAmount: 0,
        totalAmount: 100,
      },
    ]);
    prisma.invoiceLine.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        invoiceId: 'invoice-1',
        amount: 50,
        method: 'CASH',
        paidAt: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        id: 'payment-3',
        invoiceId: 'invoice-3',
        amount: 100,
        method: 'CASH',
        paidAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);
    prisma.receipt.findMany.mockResolvedValue([
      {
        id: 'receipt-3',
        paymentId: 'payment-3',
        receiptNumber: 'REC-003',
        issuedAt: new Date('2026-02-01T00:01:00.000Z'),
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
      totalAmount: '325.25',
      paidAmount: '150.00',
      totalOutstanding: '175.25',
      overdueCount: 1,
      nextDueDate: '2026-01-10T00:00:00.000Z',
      recentInvoices: [
        expect.objectContaining({
          id: 'invoice-1',
          paidAmount: '50.00',
          outstandingAmount: '150.00',
          isOverdue: true,
          receipts: [],
        }),
        expect.objectContaining({
          id: 'invoice-2',
          paidAmount: '0.00',
          outstandingAmount: '25.25',
          isOverdue: false,
          receipts: [],
        }),
        expect.objectContaining({
          id: 'invoice-3',
          paidAmount: '100.00',
          outstandingAmount: '0.00',
          isOverdue: false,
          receipts: [
            {
              id: 'receipt-3',
              receiptNumber: 'REC-003',
              invoiceId: 'invoice-3',
              invoiceNumber: 'INV-003',
              paymentId: 'payment-3',
              amount: '100.00',
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
          amount: '100.00',
          method: 'CASH',
          paidAt: '2026-02-01T00:00:00.000Z',
          issuedAt: '2026-02-01T00:01:00.000Z',
        },
      ],
      recentRefunds: [],
    });
  });

  it('itemises each bill so a parent can see what a charge is for', async () => {
    // The printed receipt has always listed the fee heads. The app sent only a
    // total, so a parent could not tell tuition from transport without the
    // paper copy.
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        status: 'ISSUED',
        dueDate: new Date('2026-08-08T00:00:00.000Z'),
        issuedAt: new Date('2026-07-10T00:00:00.000Z'),
        subtotal: '4200.00',
        vatAmount: '300.00',
        totalAmount: '4500.00',
      },
    ]);
    prisma.invoiceLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        invoiceId: 'invoice-1',
        feeHeadId: 'head-tuition',
        description: 'Monthly tuition',
        quantity: 1,
        unitAmount: 3000,
        vatAmount: 0,
        totalAmount: 3000,
        createdAt: new Date('2026-07-10T00:00:00.000Z'),
      },
      {
        id: 'line-2',
        invoiceId: 'invoice-1',
        feeHeadId: 'head-transport',
        description: 'Route A',
        quantity: 1,
        unitAmount: 1200,
        vatAmount: 300,
        totalAmount: 1500,
        createdAt: new Date('2026-07-10T00:00:01.000Z'),
      },
    ]);
    prisma.feeHead.findMany.mockResolvedValue([
      { id: 'head-tuition', code: 'TUITION', name: 'Tuition Fee' },
      { id: 'head-transport', code: 'TRANSPORT', name: 'Transport Fee' },
    ]);
    prisma.payment.findMany.mockResolvedValue([]);

    const summary = await service.getStudentFeesSummary('student-1', actor);

    expect(prisma.feeHead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          id: {
            in: expect.arrayContaining(['head-tuition', 'head-transport']),
          },
        }),
      }),
    );
    expect(summary.recentInvoices[0]).toEqual(
      expect.objectContaining({
        subtotal: '4200.00',
        vatAmount: '300.00',
        totalAmount: '4500.00',
        lines: [
          {
            id: 'line-1',
            description: 'Monthly tuition',
            feeHead: { code: 'TUITION', name: 'Tuition Fee' },
            quantity: 1,
            unitAmount: '3000.00',
            vatAmount: '0.00',
            totalAmount: '3000.00',
          },
          {
            id: 'line-2',
            description: 'Route A',
            feeHead: { code: 'TRANSPORT', name: 'Transport Fee' },
            quantity: 1,
            unitAmount: '1200.00',
            vatAmount: '300.00',
            totalAmount: '1500.00',
          },
        ],
      }),
    );
  });

  it('keeps every field the fee summary already published', async () => {
    // The addition must be additive: an older app build still reads these.
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        status: 'ISSUED',
        dueDate: new Date('2026-08-08T00:00:00.000Z'),
        issuedAt: new Date('2026-07-10T00:00:00.000Z'),
        subtotal: 100,
        vatAmount: 0,
        totalAmount: 100,
      },
    ]);
    prisma.invoiceLine.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);

    const summary = await service.getStudentFeesSummary('student-1', actor);

    for (const key of [
      'status',
      'totalAmount',
      'paidAmount',
      'totalOutstanding',
      'overdueCount',
      'nextDueDate',
      'recentInvoices',
      'recentReceipts',
    ]) {
      expect(summary).toHaveProperty(key);
    }
    for (const key of [
      'id',
      'invoiceNumber',
      'status',
      'dueDate',
      'issuedAt',
      'totalAmount',
      'paidAmount',
      'outstandingAmount',
      'isOverdue',
      'receipts',
    ]) {
      expect(summary.recentInvoices[0]).toHaveProperty(key);
    }
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'notice-1',
        title: 'Fee reminder',
        body: 'Term fee due.',
        sourceType: 'NOTICE',
        sourceId: 'source-1',
        noticeId: 'source-1',
        channel: 'PUSH',
        status: 'SENT',
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
        sentAt: new Date('2026-05-01T08:01:00.000Z'),
        readReceipts: [],
        notice: {
          audienceType: 'ALL',
          category: 'FEES',
          priority: 'URGENT',
          isPinned: true,
          requiresAcknowledgement: true,
          acknowledgements: [
            {
              firstAcknowledgedAt: new Date('2026-05-01T08:30:00.000Z'),
            },
          ],
          class: null,
          section: null,
        },
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
          AND: [
            {
              OR: expectedNotificationRecipientScope(
                'parent-1',
                ['student-1'],
                ['student-1'],
              ),
            },
            {
              OR: [
                { noticeId: null },
                { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
              ],
            },
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
        noticeCategory: 'FEES',
        noticePriority: 'URGENT',
        isPinned: true,
        requiresAcknowledgement: true,
        acknowledgedAt: '2026-05-01T08:30:00.000Z',
      }),
      expect.objectContaining({
        id: 'notice-2',
        readAt: '2026-05-01T10:00:00.000Z',
        isRead: true,
      }),
    ]);
  });

  it('hides child-linked notifications after guardian access is revoked', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);

    await service.listNotifications(actor);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          AND: [
            {
              OR: expectedNotificationRecipientScope('parent-1'),
            },
            {
              OR: [
                { noticeId: null },
                { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it("does not let recipient A see recipient B's delivery for the same child and requires live capabilities", async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-communication',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.SCHOOL_COMMUNICATE],
        },
        {
          studentId: 'student-emergency',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.EMERGENCY_ALERT_RECEIVE],
        },
        {
          studentId: 'student-academics-only',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
        },
      ],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);

    await service.listNotifications(actor);

    const recipientScope =
      notificationVisibilityWhere(prisma.notificationDelivery.findMany).AND[0]
        ?.OR ?? [];
    expect(recipientScope).toEqual(
      expectedNotificationRecipientScope(
        'parent-1',
        ['student-communication'],
        ['student-emergency'],
      ),
    );
    for (const branch of recipientScope) {
      expect(branch).toEqual(
        expect.objectContaining({ recipientUserId: 'parent-1' }),
      );
    }
    expect(recipientScope).not.toContainEqual(
      expect.objectContaining({ recipientUserId: 'parent-2' }),
    );
    expect(JSON.stringify(recipientScope)).not.toContain(
      'student-academics-only',
    );
  });

  it('intersects a dashboard child request with live communication and emergency scope', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-communication',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.SCHOOL_COMMUNICATE],
        },
        {
          studentId: 'student-emergency',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.EMERGENCY_ALERT_RECEIVE],
        },
      ],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);

    await service.listNotifications(actor, {}, [
      'student-emergency',
      'student-not-linked',
    ]);

    expect(
      notificationVisibilityWhere(prisma.notificationDelivery.findMany).AND[0]
        ?.OR,
    ).toEqual(
      expectedNotificationRecipientScope('parent-1', [], ['student-emergency']),
    );
  });

  it('applies capability revocation to list, count, detail, read, and attachment paths on the next request', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
        },
      ],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);
    prisma.notificationDelivery.findFirst.mockResolvedValue(null);

    await service.listNotifications(actor);
    await service.getNotificationUnreadCount(actor);
    await service.markAllNotificationsRead(actor);
    await expect(
      service.markNotificationRead('delivery-other-guardian', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getNotificationDetail('delivery-other-guardian', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getNotificationAttachment('delivery-other-guardian', actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    const assertGlobalRecipientOnly = (where: NotificationVisibilityWhere) => {
      expect(where.AND[0]?.OR).toEqual(
        expectedNotificationRecipientScope('parent-1'),
      );
    };
    for (
      let callIndex = 0;
      callIndex < prisma.notificationDelivery.findMany.mock.calls.length;
      callIndex += 1
    ) {
      assertGlobalRecipientOnly(
        notificationVisibilityWhere(
          prisma.notificationDelivery.findMany,
          callIndex,
        ),
      );
    }
    for (
      let callIndex = 0;
      callIndex < prisma.notificationDelivery.count.mock.calls.length;
      callIndex += 1
    ) {
      assertGlobalRecipientOnly(
        notificationVisibilityWhere(
          prisma.notificationDelivery.count,
          callIndex,
        ),
      );
    }
    for (
      let callIndex = 0;
      callIndex < prisma.notificationDelivery.findFirst.mock.calls.length;
      callIndex += 1
    ) {
      assertGlobalRecipientOnly(
        notificationVisibilityWhere(
          prisma.notificationDelivery.findFirst,
          callIndex,
        ),
      );
    }
    expect(prisma.notificationReadReceipt.upsert).not.toHaveBeenCalled();
    expect(fileRegistryService.listFilesByEntity).not.toHaveBeenCalled();
    expect(storageService.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('scopes parent dashboard notifications to the active child and global parent items', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    prisma.notificationDelivery.count.mockResolvedValue(0);

    await service.listNotifications(actor, {}, ['student-1']);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          AND: [
            {
              OR: expectedNotificationRecipientScope(
                'parent-1',
                ['student-1'],
                ['student-1'],
              ),
            },
            {
              OR: [
                { noticeId: null },
                { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
              ],
            },
          ],
        }),
      }),
    );
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        AND: [
          {
            OR: expectedNotificationRecipientScope(
              'parent-1',
              ['student-1'],
              ['student-1'],
            ),
          },
          {
            OR: [
              { noticeId: null },
              { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
            ],
          },
        ],
      }),
    });
  });

  it('returns a parent-scoped unread count without loading notification bodies', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.notificationDelivery.count.mockResolvedValue(3);

    await expect(service.getNotificationUnreadCount(actor)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        AND: [
          {
            OR: expectedNotificationRecipientScope(
              'parent-1',
              ['student-1'],
              ['student-1'],
            ),
          },
          {
            OR: [
              { noticeId: null },
              { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
            ],
          },
        ],
        readReceipts: {
          none: { tenantId: 'tenant-1', userId: 'parent-1' },
        },
      },
    });
  });

  it('counts a staff members own notifications instead of denying them', async () => {
    // Notification visibility is "addressed to me" OR "about my children".
    // Only the second half is parent-specific, but resolving it through the
    // parent student scope made every notification route 403 for staff, which
    // broke the unread count on the teacher dashboard.
    const teacherActor: AuthContext = {
      ...actor,
      userId: 'teacher-user',
      email: 'teacher@school.test',
      roles: ['teacher'],
    };
    prisma.notificationDelivery.count.mockResolvedValue(2);

    await expect(
      service.getNotificationUnreadCount(teacherActor),
    ).resolves.toEqual({ unreadCount: 2 });
    expect(prisma.notificationDelivery.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        AND: [
          { OR: expectedNotificationRecipientScope('teacher-user') },
          {
            OR: [
              { noticeId: null },
              { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
            ],
          },
        ],
        readReceipts: {
          none: { tenantId: 'tenant-1', userId: 'teacher-user' },
        },
      },
    });
    expect(prisma.guardian.findFirst).not.toHaveBeenCalled();
  });

  it('still denies staff the parent student surfaces', async () => {
    // Widening notification scope must not widen anything else.
    const teacherActor: AuthContext = {
      ...actor,
      userId: 'teacher-user',
      roles: ['teacher'],
    };

    await expect(service.listMyStudents(teacherActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('marks only the signed-in parents visible unread notifications as read', async () => {
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
        AND: [
          {
            OR: expectedNotificationRecipientScope(
              'parent-1',
              ['student-1'],
              ['student-1'],
            ),
          },
          {
            OR: [
              { noticeId: null },
              { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
            ],
          },
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
          AND: [
            {
              OR: expectedNotificationRecipientScope(
                'parent-1',
                ['student-1'],
                ['student-1'],
              ),
            },
            {
              OR: [
                { noticeId: null },
                { notice: { is: { lifecycleStatus: 'PUBLISHED' } } },
              ],
            },
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
          isPrimaryGuardian: true,
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          relationshipState: null,
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
      library: false,
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
    expect(prisma.canteenWallet.findFirst).not.toHaveBeenCalled();
    expect(prisma.transportStudentAssignment.findFirst).not.toHaveBeenCalled();
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
          isPrimaryGuardian: true,
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          relationshipState: null,
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

  it('returns backend-owned linked-child actions with honest source coverage', async () => {
    const child = {
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
      isPrimaryGuardian: true,
      guardianId: 'guardian-1',
      capabilities: [
        GuardianCapability.ACADEMICS_VIEW,
        GuardianCapability.ATTENDANCE_VIEW,
        GuardianCapability.FEES_VIEW,
        GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
      ],
      relationshipState: null,
    };
    jest.spyOn(service, 'listMyStudents').mockResolvedValue({ items: [child] });
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students', 'attendance', 'fees', 'homework', 'academics'],
      features: [],
      addOns: [],
      tier: null,
    });
    jest.spyOn(service, 'listNotifications').mockResolvedValue({
      unreadCount: 2,
      nextCursor: null,
      items: [
        {
          id: 'delivery-required',
          title: 'Trip consent',
          message: 'Please review.',
          sourceType: 'notice',
          sourceId: 'notice-1',
          childId: 'student-1',
          noticeId: 'notice-1',
          eventId: null,
          activityPostId: null,
          route: '/notices/delivery-required',
          channel: 'IN_APP',
          status: 'SENT',
          createdAt: '2026-07-26T00:00:00.000Z',
          sentAt: '2026-07-26T00:00:00.000Z',
          readAt: null,
          isRead: false,
          requiresAcknowledgement: true,
          acknowledgedAt: null,
          audience: {},
        },
        {
          id: 'delivery-confirmed',
          title: 'Already confirmed',
          message: 'No action.',
          sourceType: 'notice',
          sourceId: 'notice-2',
          childId: 'student-1',
          noticeId: 'notice-2',
          eventId: null,
          activityPostId: null,
          route: '/notices/delivery-confirmed',
          channel: 'IN_APP',
          status: 'SENT',
          createdAt: '2026-07-26T00:00:00.000Z',
          sentAt: '2026-07-26T00:00:00.000Z',
          readAt: null,
          isRead: false,
          requiresAcknowledgement: true,
          acknowledgedAt: '2026-07-26T01:00:00.000Z',
          audience: {},
        },
      ],
    } as never);
    jest.spyOn(service, 'getStudentHomework').mockResolvedValue({
      items: [
        {
          id: 'homework-1',
          title: 'Fractions practice',
          subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
          status: 'ASSIGNED',
          assignedDate: '2026-07-25T00:00:00.000Z',
          dueDate: '2026-07-27T00:00:00.000Z',
          dueAt: '2026-07-27T00:00:00.000Z',
          submissionRequired: true,
          submissionStatus: 'NOT_SUBMITTED',
          submittedAt: null,
          score: null,
          maxScore: null,
          feedback: null,
          attachmentCount: 0,
          assignedBy: null,
        },
      ],
    });
    jest.spyOn(service, 'getStudentFeesSummary').mockResolvedValue({
      status: 'DUE',
      totalAmount: '1000.00',
      paidAmount: '0.00',
      totalOutstanding: '1000.00',
      overdueCount: 1,
      nextDueDate: '2026-07-20T00:00:00.000Z',
      recentReceipts: [],
      recentRefunds: [],
      recentInvoices: [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-1',
          status: 'ISSUED',
          dueDate: '2026-07-20T00:00:00.000Z',
          issuedAt: '2026-07-01T00:00:00.000Z',
          subtotal: '1000.00',
          vatAmount: '0.00',
          totalAmount: '1000.00',
          paidAmount: '0.00',
          outstandingAmount: '1000.00',
          isOverdue: true,
          lines: [],
          receipts: [],
          waivers: [],
          refunds: [],
          allocationHistory: [],
        },
      ],
    });
    jest.spyOn(service, 'listStudentAttendanceCorrections').mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'correction-1',
          attendanceDate: '2026-07-20T00:00:00.000Z',
          previousStatus: 'ABSENT',
          requestedStatus: 'PRESENT',
          reason: 'Present at school',
          status: 'REJECTED',
          requestedAt: '2026-07-21T00:00:00.000Z',
          reviewedAt: '2026-07-22T00:00:00.000Z',
          reviewReason: 'Please add more detail.',
          canCancel: false,
          canResubmit: true,
        },
      ],
    } as never);
    jest.spyOn(service, 'listStudentServiceRequests').mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'request-1',
          status: 'RESOLVED',
          subject: 'Bus stop concern',
          responseDeadline: '2026-07-25T00:00:00.000Z',
          isOverdue: true,
          actions: { confirmResolution: true },
        },
      ],
    } as never);
    jest.spyOn(service, 'getStudentExamSchedule').mockResolvedValue({
      academicYear: { id: 'year-1', name: '2082' },
      items: [
        {
          id: 'exam-1',
          examTerm: { id: 'term-1', name: 'First Term' },
          subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
          startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          endsAt: new Date(
            Date.now() + 2 * 86_400_000 + 3_600_000,
          ).toISOString(),
          room: '4A',
          publishedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
    });

    const result = await service.getParentActionCentre(actor, 'student-1');

    expect(result.dataState).toBe('LIVE');
    expect(result.summary.isPartial).toBe(false);
    expect(result.items.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        'NOTICE_ACKNOWLEDGEMENT',
        'HOMEWORK_DUE',
        'FEE_DUE',
        'ATTENDANCE_CORRECTION_REJECTED',
        'SERVICE_REQUEST_CONFIRMATION',
        'UPCOMING_EXAM',
      ]),
    );
    expect(result.items.some((item) => item.id === 'notice-ack:notice-2')).toBe(
      false,
    );
    expect(result.items[0]?.priority).toBe('URGENT');
    expect(service.listNotifications).toHaveBeenCalledWith(
      actor,
      { limit: 100 },
      ['student-1'],
    );
  });

  it('keeps disabled parent action sources locked and never queries them', async () => {
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
          academicYearStartsOn: null,
          academicYearEndsOn: null,
          relationship: 'Daughter',
          isPrimaryGuardian: true,
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          relationshipState: null,
        },
      ],
    });
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students'],
      features: [],
      addOns: [],
      tier: null,
    });
    jest.spyOn(service, 'listNotifications').mockResolvedValue({
      unreadCount: 0,
      items: [],
      nextCursor: null,
    });
    jest.spyOn(service, 'listStudentServiceRequests').mockResolvedValue({
      total: 0,
      items: [],
    } as never);
    const homework = jest.spyOn(service, 'getStudentHomework');
    const fees = jest.spyOn(service, 'getStudentFeesSummary');
    const corrections = jest.spyOn(service, 'listStudentAttendanceCorrections');
    const exams = jest.spyOn(service, 'getStudentExamSchedule');

    const result = await service.getParentActionCentre(actor);

    expect(result.summary.isPartial).toBe(true);
    expect(result.sources).toEqual(
      expect.objectContaining({
        homework: expect.objectContaining({ status: 'locked' }),
        fees: expect.objectContaining({ status: 'locked' }),
        attendance: expect.objectContaining({ status: 'locked' }),
        exams: expect.objectContaining({ status: 'locked' }),
      }),
    );
    expect(homework).not.toHaveBeenCalled();
    expect(fees).not.toHaveBeenCalled();
    expect(corrections).not.toHaveBeenCalled();
    expect(exams).not.toHaveBeenCalled();
  });

  it('loads only capability-authorized action sources for a financial guardian', async () => {
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
          academicYearStartsOn: null,
          academicYearEndsOn: null,
          relationship: 'Financial sponsor',
          isPrimaryGuardian: false,
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.FEES_VIEW],
          relationshipState: null,
        },
      ],
    });
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students', 'attendance', 'fees', 'homework', 'academics'],
      features: [],
      addOns: [],
      tier: null,
    });
    jest.spyOn(service, 'listNotifications').mockResolvedValue({
      unreadCount: 0,
      items: [],
      nextCursor: null,
    });
    const fees = jest
      .spyOn(service, 'getStudentFeesSummary')
      .mockResolvedValue({
        status: 'PAID',
        totalAmount: '0.00',
        paidAmount: '0.00',
        totalOutstanding: '0.00',
        overdueCount: 0,
        nextDueDate: null,
        recentReceipts: [],
        recentRefunds: [],
        recentInvoices: [],
      });
    const homework = jest.spyOn(service, 'getStudentHomework');
    const corrections = jest.spyOn(service, 'listStudentAttendanceCorrections');
    const requests = jest.spyOn(service, 'listStudentServiceRequests');
    const exams = jest.spyOn(service, 'getStudentExamSchedule');

    const result = await service.getParentActionCentre(actor, 'student-1');

    expect(result.sources.fees.status).toBe('available');
    expect(result.sources.homework.status).toBe('locked');
    expect(result.sources.attendance.status).toBe('locked');
    expect(result.sources.serviceRequests.status).toBe('locked');
    expect(result.sources.exams.status).toBe('locked');
    expect(fees).toHaveBeenCalledWith('student-1', actor);
    expect(homework).not.toHaveBeenCalled();
    expect(corrections).not.toHaveBeenCalled();
    expect(requests).not.toHaveBeenCalled();
    expect(exams).not.toHaveBeenCalled();
  });

  it('rejects an unlinked action-centre child before loading any source', async () => {
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
          academicYearStartsOn: null,
          academicYearEndsOn: null,
          relationship: 'Daughter',
          isPrimaryGuardian: true,
          guardianId: 'guardian-1',
          capabilities: [GuardianCapability.ACADEMICS_VIEW],
          relationshipState: null,
        },
      ],
    });
    const notifications = jest.spyOn(service, 'listNotifications');

    await expect(
      service.getParentActionCentre(actor, 'student-other'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(entitlementsService.getEntitlements).not.toHaveBeenCalled();
    expect(notifications).not.toHaveBeenCalled();
  });

  it('builds a linked-child weekly digest from bounded source-owned evidence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-26T10:00:00.000Z'));
    try {
      jest.spyOn(service as never, 'getAccessibleStudent').mockResolvedValue({
        id: 'student-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { id: 'class-1', name: 'Grade 4' },
        sectionRef: { id: 'section-1', name: 'A' },
        guardianLinks: [
          {
            guardian: { userId: actor.userId },
            capabilities: [
              GuardianCapability.ACADEMICS_VIEW,
              GuardianCapability.ATTENDANCE_VIEW,
            ],
          },
        ],
        enrollments: [],
      } as never);
      entitlementsService.getEntitlements.mockResolvedValue({
        modules: ['students', 'attendance', 'homework', 'academics'],
        features: [],
        addOns: [],
        tier: null,
      });
      jest.spyOn(service, 'getStudentAttendanceSummary').mockResolvedValue({
        recentHistory: [
          {
            date: new Date('2026-07-25T00:00:00.000Z'),
            status: 'PRESENT',
          },
          {
            date: new Date('2026-07-24T00:00:00.000Z'),
            status: 'LATE',
          },
          {
            date: new Date('2026-07-23T00:00:00.000Z'),
            status: 'ABSENT',
          },
          {
            date: new Date('2026-07-01T00:00:00.000Z'),
            status: 'PRESENT',
          },
        ],
      } as never);
      prisma.homeworkAssignment.findMany.mockResolvedValue([
        {
          id: 'homework-reviewed',
          title: 'Fractions review',
          dueAt: new Date('2026-07-24T00:00:00.000Z'),
          submissionRequired: true,
          subject: { id: 'subject-1', name: 'Mathematics' },
          submissions: [
            {
              status: 'REVIEWED',
              feedback: 'Clear working and good improvement.',
              reviewedAt: new Date('2026-07-25T00:00:00.000Z'),
              returnedAt: null,
              updatedAt: new Date('2026-07-25T00:00:00.000Z'),
            },
          ],
        },
        {
          id: 'homework-missing',
          title: 'Reading response',
          dueAt: new Date('2026-07-22T00:00:00.000Z'),
          submissionRequired: true,
          subject: { id: 'subject-2', name: 'English' },
          submissions: [],
        },
      ]);
      jest.spyOn(service, 'getStudentReportCards').mockResolvedValue({
        items: [
          {
            id: 'report-current',
            academicYear: { id: 'year-1', name: '2083' },
            examTerm: { id: 'term-2', name: 'Second Term' },
            percentage: 80,
            publishedAt: '2026-07-20T00:00:00.000Z',
            subjects: [
              { subjectId: 'subject-1', maxMarks: 100 },
              { subjectId: 'subject-2', maxMarks: 100 },
            ],
          },
          {
            id: 'report-previous',
            academicYear: { id: 'year-1', name: '2083' },
            examTerm: { id: 'term-1', name: 'First Term' },
            percentage: 75,
            publishedAt: '2026-05-20T00:00:00.000Z',
            subjects: [
              { subjectId: 'subject-1', maxMarks: 100 },
              { subjectId: 'subject-2', maxMarks: 100 },
            ],
          },
        ],
      } as never);
      jest.spyOn(service, 'getParentActionCentre').mockResolvedValue({
        summary: { isPartial: false },
        items: [
          {
            id: 'exam:exam-1',
            type: 'UPCOMING_EXAM',
            title: 'Mathematics exam',
            detail: 'Second term',
            priority: 'UPCOMING',
            studentId: 'student-1',
            studentName: 'Asha Rai',
            dueAt: '2026-07-28T00:00:00.000Z',
            createdAt: '2026-07-20T00:00:00.000Z',
            route: '/parent/more/calendar',
            actionLabel: 'View calendar',
          },
        ],
      } as never);

      const result = await service.getStudentWeeklyProgress('student-1', actor);

      expect(result.period.days).toBe(7);
      expect(result.attendance).toEqual(
        expect.objectContaining({
          availability: 'AVAILABLE',
          recordedDays: 3,
          presentDays: 2,
          absentDays: 1,
          lateDays: 1,
          attendanceRate: 66.67,
        }),
      );
      expect(result.homework).toEqual({
        availability: 'AVAILABLE',
        requiredCount: 2,
        completedCount: 1,
        needsFollowUpCount: 1,
        completionRate: 50,
      });
      expect(result.academicTrend).toEqual(
        expect.objectContaining({
          availability: 'AVAILABLE',
          direction: 'IMPROVED',
          changePoints: 5,
        }),
      );
      expect(result.teacherComments).toEqual([
        expect.objectContaining({
          subject: 'Mathematics',
          comment: 'Clear working and good improvement.',
        }),
      ]);
      expect(result.upcomingDeadlines).toHaveLength(1);
      expect(result.requiredActions).toHaveLength(1);
      expect(result.isPartial).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not claim an academic trend from non-comparable published results', async () => {
    jest.spyOn(service as never, 'getAccessibleStudent').mockResolvedValue({
      id: 'student-1',
      firstNameEn: 'Asha',
      lastNameEn: 'Rai',
      classId: 'class-1',
      sectionId: 'section-1',
      class: { id: 'class-1', name: 'Grade 4' },
      sectionRef: { id: 'section-1', name: 'A' },
      guardianLinks: [],
      enrollments: [],
    } as never);
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students', 'academics'],
      features: [],
      addOns: [],
      tier: null,
    });
    jest.spyOn(service, 'getStudentReportCards').mockResolvedValue({
      items: [
        {
          id: 'report-current',
          academicYear: { id: 'year-2', name: '2084' },
          examTerm: { id: 'term-2', name: 'Second Term' },
          percentage: 85,
          publishedAt: '2026-07-20T00:00:00.000Z',
          subjects: [{ subjectId: 'subject-1', maxMarks: 100 }],
        },
        {
          id: 'report-previous',
          academicYear: { id: 'year-1', name: '2083' },
          examTerm: { id: 'term-1', name: 'First Term' },
          percentage: 70,
          publishedAt: '2026-05-20T00:00:00.000Z',
          subjects: [{ subjectId: 'subject-1', maxMarks: 100 }],
        },
      ],
    } as never);
    jest.spyOn(service, 'getParentActionCentre').mockResolvedValue({
      summary: { isPartial: false },
      items: [],
    } as never);

    const result = await service.getStudentWeeklyProgress('student-1', actor);

    expect(result.academicTrend).toEqual(
      expect.objectContaining({
        availability: 'UNAVAILABLE',
        direction: null,
        changePoints: null,
      }),
    );
    expect(result.sources.academics).toEqual(
      expect.objectContaining({ status: 'empty' }),
    );
  });

  it('keeps disabled weekly digest sources locked without querying them', async () => {
    jest.spyOn(service as never, 'getAccessibleStudent').mockResolvedValue({
      id: 'student-1',
      firstNameEn: 'Asha',
      lastNameEn: 'Rai',
      classId: 'class-1',
      sectionId: 'section-1',
      class: { id: 'class-1', name: 'Grade 4' },
      sectionRef: { id: 'section-1', name: 'A' },
      guardianLinks: [],
      enrollments: [],
    } as never);
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students'],
      features: [],
      addOns: [],
      tier: null,
    });
    const attendance = jest.spyOn(service, 'getStudentAttendanceSummary');
    const reports = jest.spyOn(service, 'getStudentReportCards');
    jest.spyOn(service, 'getParentActionCentre').mockResolvedValue({
      summary: { isPartial: true },
      items: [],
    } as never);

    const result = await service.getStudentWeeklyProgress('student-1', actor);

    expect(result.attendance).toEqual(
      expect.objectContaining({
        availability: 'LOCKED',
        attendanceRate: null,
      }),
    );
    expect(result.homework).toEqual(
      expect.objectContaining({
        availability: 'LOCKED',
        completionRate: null,
      }),
    );
    expect(result.academicTrend).toEqual(
      expect.objectContaining({
        availability: 'LOCKED',
        direction: null,
      }),
    );
    expect(result.isPartial).toBe(true);
    expect(attendance).not.toHaveBeenCalled();
    expect(prisma.homeworkAssignment.findMany).not.toHaveBeenCalled();
    expect(reports).not.toHaveBeenCalled();
  });

  it('marks both homework and teacher comments unavailable when their shared source fails', async () => {
    jest.spyOn(service as never, 'getAccessibleStudent').mockResolvedValue({
      id: 'student-1',
      firstNameEn: 'Asha',
      lastNameEn: 'Rai',
      classId: 'class-1',
      sectionId: 'section-1',
      class: { id: 'class-1', name: 'Grade 4' },
      sectionRef: { id: 'section-1', name: 'A' },
      guardianLinks: [],
      enrollments: [],
    } as never);
    entitlementsService.getEntitlements.mockResolvedValue({
      modules: ['students', 'homework'],
      features: [],
      addOns: [],
      tier: null,
    });
    prisma.homeworkAssignment.findMany.mockRejectedValue(
      new Error('source unavailable'),
    );
    jest.spyOn(service, 'getParentActionCentre').mockResolvedValue({
      summary: { isPartial: false },
      items: [],
    } as never);

    const result = await service.getStudentWeeklyProgress('student-1', actor);

    expect(result.sources.homework).toEqual(
      expect.objectContaining({ status: 'unavailable' }),
    );
    expect(result.sources.comments).toEqual(
      expect.objectContaining({ status: 'unavailable' }),
    );
    expect(result.homework).toEqual(
      expect.objectContaining({
        availability: 'UNAVAILABLE',
        completionRate: null,
      }),
    );
    expect(result.teacherComments).toEqual([]);
    expect(result.isPartial).toBe(true);
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    prisma.activityPost.findMany.mockResolvedValue([
      {
        id: 'post-1',
        title: 'Science day',
        caption: 'Students built models.',
        category: 'LEARNING',
        publishedAt: new Date('2026-06-29T00:00:00.000Z'),
        createdAt: new Date('2026-06-29T00:00:00.000Z'),
      },
    ]);
    prisma.activityAttachment.findMany.mockResolvedValue([
      {
        id: 'attachment-1',
        activityPostId: 'post-1',
        fileName: 'science.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        processingStatus: 'READY',
        thumbnailFileAssetId: null,
        optimizedObjectKey: 'must-not-leak-optimized-key',
        sortOrder: 0,
      },
    ]);
    prisma.activityReaction.findMany.mockResolvedValue([
      {
        activityPostId: 'post-1',
        guardianId: 'guardian-1',
        reaction: 'SEEN',
        createdAt: new Date('2026-07-01T06:30:00.000Z'),
      },
      {
        activityPostId: 'post-1',
        guardianId: 'guardian-2',
        reaction: 'THANK_YOU',
        createdAt: new Date('2026-07-01T07:30:00.000Z'),
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
        seenAt: '2026-07-01T06:30:00.000Z',
        attachments: [
          {
            id: 'attachment-1',
            fileName: 'science.jpg',
            contentType: 'image/jpeg',
            sizeBytes: 2048,
            processingStatus: 'READY',
            thumbnailPath: '/activity-feed/attachments/attachment-1/thumbnail',
            previewPath: '/activity-feed/attachments/attachment-1/preview',
          },
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'APPROVED',
          softDeletedAt: null,
          parentVisible: true,
        }),
        select: expect.objectContaining({
          id: true,
          title: true,
          caption: true,
        }),
      }),
    );
    expect(prisma.activityAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', activityPostId: { in: ['post-1'] } },
      }),
    );
    expect(result.items[0].reactionCount).toBe(2);
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
        maxScore: 20,
        assignedByStaff: {
          id: 'staff-1',
          firstName: 'Mina',
          lastName: 'Shrestha',
        },
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
        maxScore: 20,
        attachmentCount: 2,
        assignedBy: {
          id: 'staff-1',
          name: 'Mina Shrestha',
        },
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
    // Root rows now carry foreign keys; routes, stops, the vehicle and the
    // latest ping are resolved by batched follow-up queries. The assertions
    // below are unchanged — the response contract is what this test pins.
    prisma.transportStudentAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      routeId: 'route-1',
      stopId: 'stop-1',
      pickupDirection: 'PICKUP',
      status: 'ACTIVE',
    });
    prisma.transportEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      routeId: 'route-1',
      stopId: 'stop-1',
      feeAmount: 1200,
      status: 'ACTIVE',
    });
    prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
      id: 'trip-status-1',
      tripId: 'trip-1',
      stopId: 'stop-1',
      status: 'BOARDED',
    });
    prisma.transportTrip.findFirst.mockResolvedValue({
      id: 'trip-1',
      routeId: 'route-1',
      vehicleId: 'vehicle-1',
      direction: 'PICKUP',
      status: 'ACTIVE',
      isDelayed: true,
      delayMinutes: 12,
      delayReason: 'Traffic near Ring Road',
    });
    prisma.transportRoute.findMany.mockResolvedValue([
      { id: 'route-1', name: 'Route A', code: 'R-A' },
    ]);
    prisma.transportStop.findMany.mockResolvedValue([
      { id: 'stop-1', name: 'Gate 2', sequence: 3 },
    ]);
    prisma.transportVehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      registrationNumber: 'BA-1-PA-1234',
      model: 'Bus 3',
      capacity: 32,
    });
    prisma.transportLocationPing.findFirst.mockResolvedValue({
      latitude: 27.7101,
      longitude: 85.3222,
      speedKph: 18.5,
      recordedAt: new Date('2026-06-02T07:45:00.000Z'),
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

  describe('parent transport summary', () => {
    /** Authorize `studentId` for the acting parent with every capability. */
    function authorizeChild(studentId = 'student-1') {
      prisma.student.findFirst.mockResolvedValue({ id: studentId });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId,
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
    }

    /** No transport records of any kind for this child. */
    function noTransport() {
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);
    }

    it('returns empty transport state without touching reference tables', async () => {
      authorizeChild();
      noTransport();

      await expect(
        service.getStudentTransport('student-1', actor),
      ).resolves.toEqual({
        assignment: null,
        enrollment: null,
        activeTrip: null,
      });

      // This is the optimization: a child with no transport must not trigger
      // route, stop, vehicle, trip or ping lookups. The previous
      // `include`-based version issued all of them regardless.
      expect(prisma.transportRoute.findMany).not.toHaveBeenCalled();
      expect(prisma.transportStop.findMany).not.toHaveBeenCalled();
      expect(prisma.transportVehicle.findFirst).not.toHaveBeenCalled();
      expect(prisma.transportLocationPing.findFirst).not.toHaveBeenCalled();
      expect(prisma.transportTrip.findFirst).not.toHaveBeenCalled();
    });

    it('resolves route and stop for an assignment with one batched query each', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        routeId: 'route-1',
        stopId: 'stop-1',
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      prisma.transportEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        routeId: 'route-1',
        stopId: 'stop-1',
        feeAmount: 900,
        status: 'ACTIVE',
      });
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);
      prisma.transportRoute.findMany.mockResolvedValue([
        { id: 'route-1', name: 'Route A', code: 'R-A' },
      ]);
      prisma.transportStop.findMany.mockResolvedValue([
        { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      ]);

      const result = await service.getStudentTransport('student-1', actor);

      expect(result.assignment).toEqual({
        id: 'assignment-1',
        route: { id: 'route-1', name: 'Route A', code: 'R-A' },
        stop: { id: 'stop-1', name: 'Gate 2', sequence: 3 },
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      // Assignment and enrollment share a route and a stop; each must be
      // fetched once, not once per referencing row.
      expect(prisma.transportRoute.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.transportStop.findMany).toHaveBeenCalledTimes(1);
    });

    it('deduplicates and sorts the batched id lists', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        routeId: 'route-b',
        stopId: 'stop-b',
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      prisma.transportEnrollment.findFirst.mockResolvedValue({
        id: 'enrollment-1',
        routeId: 'route-a',
        stopId: 'stop-b',
        feeAmount: 0,
        status: 'ACTIVE',
      });
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);

      await service.getStudentTransport('student-1', actor);

      // Stable, deduplicated ordering keeps the generated IN(...) list — and
      // therefore the query plan — identical across requests.
      expect(prisma.transportRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            id: { in: ['route-a', 'route-b'] },
          }),
        }),
      );
      expect(prisma.transportStop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['stop-b'] } }),
        }),
      );
    });

    it('scopes every batched lookup to the acting tenant', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        routeId: 'route-1',
        stopId: 'stop-1',
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);

      await service.getStudentTransport('student-1', actor);

      for (const call of [
        prisma.transportRoute.findMany,
        prisma.transportStop.findMany,
      ]) {
        expect(call).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: 'tenant-1' }),
          }),
        );
      }
    });

    it('renders a null route when the reference resolves to another tenant', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        routeId: 'route-of-other-tenant',
        stopId: 'stop-1',
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);
      // The tenant-scoped batch simply does not return the foreign row.
      prisma.transportRoute.findMany.mockResolvedValue([]);
      prisma.transportStop.findMany.mockResolvedValue([
        { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      ]);

      const result = await service.getStudentTransport('student-1', actor);

      expect(result.assignment?.route).toBeNull();
      expect(JSON.stringify(result)).not.toContain('route-of-other-tenant');
    });

    it('omits the active trip when the trip row does not resolve', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        id: 'trip-status-1',
        tripId: 'trip-of-other-tenant',
        stopId: 'stop-1',
        status: 'BOARDED',
      });
      prisma.transportTrip.findFirst.mockResolvedValue(null);

      const result = await service.getStudentTransport('student-1', actor);

      expect(result.activeTrip).toBeNull();
      expect(prisma.transportVehicle.findFirst).not.toHaveBeenCalled();
      expect(prisma.transportLocationPing.findFirst).not.toHaveBeenCalled();
    });

    it('reports a delayed trip with its delay detail', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        id: 'trip-status-1',
        tripId: 'trip-1',
        stopId: 'stop-1',
        status: 'PENDING',
      });
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        direction: 'DROP',
        status: 'ACTIVE',
        isDelayed: true,
        delayMinutes: 20,
        delayReason: 'Roadworks',
      });
      prisma.transportRoute.findMany.mockResolvedValue([
        { id: 'route-1', name: 'Route A', code: 'R-A' },
      ]);
      prisma.transportStop.findMany.mockResolvedValue([
        { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      ]);
      prisma.transportVehicle.findFirst.mockResolvedValue({
        id: 'vehicle-1',
        registrationNumber: 'BA-1-PA-1234',
        model: 'Bus 3',
        capacity: 32,
      });
      prisma.transportLocationPing.findFirst.mockResolvedValue(null);

      const result = await service.getStudentTransport('student-1', actor);

      expect(result.activeTrip).toEqual(
        expect.objectContaining({
          isDelayed: true,
          delayMinutes: 20,
          delayReason: 'Roadworks',
          studentStatus: 'PENDING',
        }),
      );
    });

    it('reports an unavailable location when no ping exists', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        id: 'trip-status-1',
        tripId: 'trip-1',
        stopId: 'stop-1',
        status: 'BOARDED',
      });
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        direction: 'PICKUP',
        status: 'ACTIVE',
        isDelayed: false,
        delayMinutes: null,
        delayReason: null,
      });
      prisma.transportVehicle.findFirst.mockResolvedValue({
        id: 'vehicle-1',
        registrationNumber: 'BA-1-PA-1234',
        model: 'Bus 3',
        capacity: 32,
      });
      prisma.transportLocationPing.findFirst.mockResolvedValue(null);

      const result = await service.getStudentTransport('student-1', actor);

      expect(result.activeTrip?.latestLocation).toBeNull();
    });

    it('marks a fresh location as fresh and an old one as stale', async () => {
      const setUpTripWithPing = (recordedAt: Date) => {
        authorizeChild();
        prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
        prisma.transportEnrollment.findFirst.mockResolvedValue(null);
        prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
          id: 'trip-status-1',
          tripId: 'trip-1',
          stopId: 'stop-1',
          status: 'BOARDED',
        });
        prisma.transportTrip.findFirst.mockResolvedValue({
          id: 'trip-1',
          routeId: 'route-1',
          vehicleId: 'vehicle-1',
          direction: 'PICKUP',
          status: 'ACTIVE',
          isDelayed: false,
          delayMinutes: null,
          delayReason: null,
        });
        prisma.transportVehicle.findFirst.mockResolvedValue({
          id: 'vehicle-1',
          registrationNumber: 'BA-1-PA-1234',
          model: 'Bus 3',
          capacity: 32,
        });
        prisma.transportLocationPing.findFirst.mockResolvedValue({
          latitude: 27.7101,
          longitude: 85.3222,
          speedKph: null,
          recordedAt,
        });
      };

      setUpTripWithPing(new Date());
      const fresh = await service.getStudentTransport('student-1', actor);
      expect(fresh.activeTrip?.latestLocation).toEqual(
        expect.objectContaining({ confidence: 'fresh', isStale: false }),
      );

      setUpTripWithPing(new Date(Date.now() - 3_600_000));
      const stale = await service.getStudentTransport('student-1', actor);
      expect(stale.activeTrip?.latestLocation).toEqual(
        expect.objectContaining({ confidence: 'stale', isStale: true }),
      );
    });

    it('requests only the latest ping, never GPS history', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        id: 'trip-status-1',
        tripId: 'trip-1',
        stopId: 'stop-1',
        status: 'BOARDED',
      });
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        direction: 'PICKUP',
        status: 'ACTIVE',
        isDelayed: false,
        delayMinutes: null,
        delayReason: null,
      });
      prisma.transportVehicle.findFirst.mockResolvedValue(null);
      prisma.transportLocationPing.findFirst.mockResolvedValue(null);

      await service.getStudentTransport('student-1', actor);

      expect(prisma.transportLocationPing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', tripId: 'trip-1' },
          orderBy: [{ recordedAt: 'desc' }],
        }),
      );
    });

    it('never selects driver personal information', async () => {
      authorizeChild();
      prisma.transportStudentAssignment.findFirst.mockResolvedValue(null);
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        id: 'trip-status-1',
        tripId: 'trip-1',
        stopId: 'stop-1',
        status: 'BOARDED',
      });
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-1',
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        direction: 'PICKUP',
        status: 'ACTIVE',
        isDelayed: false,
        delayMinutes: null,
        delayReason: null,
      });
      prisma.transportVehicle.findFirst.mockResolvedValue(null);
      prisma.transportLocationPing.findFirst.mockResolvedValue(null);

      await service.getStudentTransport('student-1', actor);

      const tripSelect = prisma.transportTrip.findFirst.mock.calls[0][0].select;
      expect(tripSelect).not.toHaveProperty('driverAssignment');
      expect(tripSelect).not.toHaveProperty('driverAssignmentId');
      expect(tripSelect).not.toHaveProperty('createdBy');
      expect(tripSelect).not.toHaveProperty('notes');
    });

    it('denies a child the parent has no active relationship with', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-9' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [],
      });

      await expect(
        service.getStudentTransport('student-9', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        prisma.transportStudentAssignment.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('denies when the guardian relationship lacks the alert capability', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            // Transport requires EMERGENCY_ALERT_RECEIVE; a second guardian
            // linked to the same child with a narrower capability set must not
            // see the transport summary.
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
          },
        ],
      });

      await expect(
        service.getStudentTransport('student-1', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        prisma.transportStudentAssignment.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('denies a student that does not exist in this tenant', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentTransport('student-from-other-tenant', actor),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        prisma.transportStudentAssignment.findFirst,
      ).not.toHaveBeenCalled();
    });

    it('filters root rows to ACTIVE records for the requested child only', async () => {
      authorizeChild();
      noTransport();

      await service.getStudentTransport('student-1', actor);

      expect(prisma.transportStudentAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            studentId: 'student-1',
            status: 'ACTIVE',
          },
        }),
      );
      expect(prisma.transportEnrollment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            studentId: 'student-1',
            status: 'ACTIVE',
          },
        }),
      );
      expect(prisma.transportTripStudentStatus.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            studentId: 'student-1',
            trip: { status: 'ACTIVE' },
          },
        }),
      );
    });

    it('keeps each child independent for a parent with several children', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
      prisma.transportStudentAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        routeId: 'route-1',
        stopId: 'stop-1',
        pickupDirection: 'PICKUP',
        status: 'ACTIVE',
      });
      prisma.transportEnrollment.findFirst.mockResolvedValue(null);
      prisma.transportTripStudentStatus.findFirst.mockResolvedValue(null);
      prisma.transportRoute.findMany.mockResolvedValue([
        { id: 'route-1', name: 'Route A', code: 'R-A' },
      ]);
      prisma.transportStop.findMany.mockResolvedValue([
        { id: 'stop-1', name: 'Gate 2', sequence: 3 },
      ]);

      const transported = await service.getStudentTransport('student-1', actor);
      expect(transported.assignment?.route).toEqual(
        expect.objectContaining({ id: 'route-1' }),
      );

      // Second child, same parent, no transport — must not inherit the first
      // child's route or assignment.
      prisma.student.findFirst.mockResolvedValue({ id: 'student-2' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-2',
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
      noTransport();

      const notTransported = await service.getStudentTransport(
        'student-2',
        actor,
      );
      expect(notTransported).toEqual({
        assignment: null,
        enrollment: null,
        activeTrip: null,
      });
    });
  });

  describe('parent activity summary', () => {
    function authorizeChild(studentId = 'student-1') {
      prisma.student.findFirst
        .mockResolvedValueOnce({ id: studentId })
        .mockResolvedValueOnce({
          id: studentId,
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
        studentLinks: [
          {
            studentId,
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
    }

    function mockPost(overrides: Record<string, unknown> = {}) {
      return {
        id: 'post-1',
        title: 'Science day',
        caption: 'Students built models.',
        category: 'LEARNING',
        publishedAt: new Date('2026-06-29T00:00:00.000Z'),
        createdAt: new Date('2026-06-29T00:00:00.000Z'),
        ...overrides,
      };
    }

    it('returns an empty feed without attachment or reaction lookups', async () => {
      authorizeChild();
      prisma.activityPost.findMany.mockResolvedValue([]);

      await expect(
        service.getStudentActivityFeed('student-1', actor, '1'),
      ).resolves.toEqual({ items: [] });

      expect(prisma.activityAttachment.findMany).not.toHaveBeenCalled();
      expect(prisma.activityReaction.findMany).not.toHaveBeenCalled();
    });

    it('loads a populated preview with at most three activity queries', async () => {
      authorizeChild();
      prisma.activityPost.findMany.mockResolvedValue([mockPost()]);
      prisma.activityAttachment.findMany.mockResolvedValue([]);
      prisma.activityReaction.findMany.mockResolvedValue([]);

      const result = await service.getStudentActivityFeed(
        'student-1',
        actor,
        '1',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'post-1',
          attachmentCount: 0,
          reactionCount: 0,
          seenAt: null,
        }),
      );
      expect(prisma.activityPost.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.activityAttachment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.activityReaction.findMany).toHaveBeenCalledTimes(1);
    });

    it('preserves audience OR predicates for class and section posts', async () => {
      authorizeChild();
      prisma.activityPost.findMany.mockResolvedValue([]);

      await service.getStudentActivityFeed('student-1', actor, '5');

      expect(prisma.activityPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { audienceType: 'ALL' },
              {
                audienceType: 'STUDENT',
                studentTags: { some: { studentId: 'student-1' } },
              },
              { audienceType: 'CLASS', classId: 'class-1' },
              {
                audienceType: 'SECTION',
                classId: 'class-1',
                sectionId: 'section-1',
              },
            ]),
          }),
        }),
      );
    });

    it('maps seenAt from the guardian SEEN reaction and counts all reactions', async () => {
      authorizeChild();
      prisma.activityPost.findMany.mockResolvedValue([mockPost()]);
      prisma.activityAttachment.findMany.mockResolvedValue([
        {
          id: 'attachment-1',
          activityPostId: 'post-1',
          fileName: 'science.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          processingStatus: 'READY',
          thumbnailFileAssetId: 'thumb-1',
          optimizedObjectKey: null,
          sortOrder: 0,
        },
      ]);
      prisma.activityReaction.findMany.mockResolvedValue([
        {
          activityPostId: 'post-1',
          guardianId: 'guardian-1',
          reaction: 'SEEN',
          createdAt: new Date('2026-07-01T06:30:00.000Z'),
        },
        {
          activityPostId: 'post-1',
          guardianId: 'guardian-2',
          reaction: 'THANK_YOU',
          createdAt: new Date('2026-07-01T07:30:00.000Z'),
        },
      ]);

      const result = await service.getStudentActivityFeed(
        'student-1',
        actor,
        '1',
      );

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          seenAt: '2026-07-01T06:30:00.000Z',
          attachmentCount: 1,
          reactionCount: 2,
          attachments: [
            expect.objectContaining({
              thumbnailPath:
                '/activity-feed/attachments/attachment-1/thumbnail',
              previewPath: '/activity-feed/attachments/attachment-1/preview',
            }),
          ],
        }),
      );
      expect(JSON.stringify(result)).not.toContain('optimizedObjectKey');
    });

    it('exposes latestActivity on the dashboard from the first feed item', async () => {
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
            isPrimaryGuardian: true,
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
            relationshipState: null,
          },
        ],
      });
      jest.spyOn(service, 'getStudentProfile').mockResolvedValue({
        child: { id: 'student-1', name: 'Asha Rai' },
        profile: {},
      } as never);
      jest.spyOn(service, 'getStudentActivityFeed').mockResolvedValue({
        items: [
          {
            id: 'post-1',
            title: 'Science day',
            caption: 'Students built models.',
            category: 'LEARNING',
            publishedAt: '2026-06-29T00:00:00.000Z',
            seenAt: null,
            attachmentCount: 0,
            reactionCount: 0,
            attachments: [],
          },
        ],
      });
      jest.spyOn(service, 'listNotifications').mockResolvedValue({
        unreadCount: 0,
        items: [],
        nextCursor: null,
      });
      entitlementsService.getEntitlements.mockResolvedValue({
        modules: ['students', 'activity'],
        features: [],
        addOns: [],
        tier: null,
      });

      const dashboard = await service.getDashboard(actor);

      expect(dashboard.latestActivity).toEqual(
        expect.objectContaining({
          id: 'post-1',
          title: 'Science day',
        }),
      );
      expect(service.getStudentActivityFeed).toHaveBeenCalledWith(
        'student-1',
        actor,
        '1',
      );
    });

    it('denies activity reads without ACADEMICS_VIEW capability', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            capabilities: [GuardianCapability.ATTENDANCE_VIEW],
          },
        ],
      });

      await expect(
        service.getStudentActivityFeed('student-1', actor, '1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.activityPost.findMany).not.toHaveBeenCalled();
    });
  });

  describe('parent canteen summary', () => {
    function authorizeChild(studentId = 'student-1') {
      prisma.student.findFirst.mockResolvedValue({ id: studentId });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId,
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
    }

    function noWalletOrEnrollment() {
      prisma.canteenWallet.findFirst.mockResolvedValue(null);
      prisma.canteenStudentEnrollment.findMany.mockResolvedValue([]);
    }

    it('returns menu items without wallet, transaction, or serving lookups', async () => {
      authorizeChild();
      noWalletOrEnrollment();
      prisma.canteenMenuItem.findMany.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Samosa',
          category: 'Snacks',
          description: null,
          unitPrice: 25,
          isMealItem: false,
          allergenTags: [],
        },
      ]);

      await expect(
        service.getStudentCanteen('student-1', actor),
      ).resolves.toEqual({
        wallet: null,
        activeMealPlans: [],
        recentTransactions: [],
        menuItems: [
          expect.objectContaining({
            id: 'menu-1',
            name: 'Samosa',
            unitPrice: 25,
          }),
        ],
        recentServings: [],
      });

      expect(prisma.canteenWalletTransaction.findMany).not.toHaveBeenCalled();
      expect(prisma.canteenMealServing.findMany).not.toHaveBeenCalled();
      expect(prisma.canteenMealPlan.findMany).not.toHaveBeenCalled();
    });

    it('loads wallet activity with batched meal plans and no include fan-out', async () => {
      authorizeChild();
      prisma.canteenWallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        balance: 450,
        lowBalanceThreshold: 100,
      });
      prisma.canteenStudentEnrollment.findMany.mockResolvedValue([
        {
          id: 'enrollment-1',
          mealPlanId: 'plan-1',
          status: 'ACTIVE',
          startsOn: new Date('2026-04-01T00:00:00.000Z'),
          endsOn: null,
        },
      ]);
      prisma.canteenMenuItem.findMany.mockResolvedValue([]);
      prisma.canteenWalletTransaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          type: 'TOP_UP',
          source: 'MANUAL',
          amount: 500,
          balanceAfter: 450,
          transactionDate: new Date('2026-07-01T00:00:00.000Z'),
          note: 'Top-up',
        },
      ]);
      prisma.canteenMealServing.findMany.mockResolvedValue([
        {
          id: 'serving-1',
          mealType: 'LUNCH',
          mealDate: new Date('2026-07-01T00:00:00.000Z'),
          servedAt: new Date('2026-07-01T06:00:00.000Z'),
          status: 'SERVED',
          notes: null,
          mealPlanId: 'plan-1',
        },
      ]);
      prisma.canteenMealPlan.findMany.mockResolvedValue([
        {
          id: 'plan-1',
          name: 'Daily Lunch',
          mealType: 'LUNCH',
          price: 3500,
          billingFrequency: 'MONTHLY',
        },
      ]);

      const result = await service.getStudentCanteen('student-1', actor);

      expect(result.wallet).toEqual({
        id: 'wallet-1',
        balance: 450,
        lowBalanceThreshold: 100,
        isLowBalance: false,
      });
      expect(result.activeMealPlans[0]?.mealPlan).toEqual({
        id: 'plan-1',
        name: 'Daily Lunch',
        mealType: 'LUNCH',
        price: 3500,
        billingFrequency: 'MONTHLY',
      });
      expect(result.recentServings[0]?.mealPlanName).toBe('Daily Lunch');
      expect(prisma.canteenMealPlan.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.canteenMealPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            id: { in: ['plan-1'] },
          }),
        }),
      );
    });

    it('denies canteen reads without FEES_VIEW capability', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
          },
        ],
      });

      await expect(
        service.getStudentCanteen('student-1', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.canteenWallet.findFirst).not.toHaveBeenCalled();
    });

    it('resolves a cross-tenant meal plan id to null instead of leaking it', async () => {
      authorizeChild();
      prisma.canteenWallet.findFirst.mockResolvedValue(null);
      prisma.canteenStudentEnrollment.findMany.mockResolvedValue([
        {
          id: 'enrollment-1',
          mealPlanId: 'plan-of-other-tenant',
          status: 'ACTIVE',
          startsOn: new Date('2026-04-01T00:00:00.000Z'),
          endsOn: null,
        },
      ]);
      prisma.canteenMenuItem.findMany.mockResolvedValue([]);
      prisma.canteenWalletTransaction.findMany.mockResolvedValue([]);
      prisma.canteenMealServing.findMany.mockResolvedValue([]);
      prisma.canteenMealPlan.findMany.mockResolvedValue([]);

      const result = await service.getStudentCanteen('student-1', actor);

      expect(result.activeMealPlans[0]?.mealPlan).toBeNull();
      expect(JSON.stringify(result)).not.toContain('plan-of-other-tenant');
    });

    it('marks low-balance wallets using the configured threshold', async () => {
      authorizeChild();
      prisma.canteenWallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        balance: 80,
        lowBalanceThreshold: 100,
      });
      prisma.canteenStudentEnrollment.findMany.mockResolvedValue([]);
      prisma.canteenMenuItem.findMany.mockResolvedValue([]);
      prisma.canteenWalletTransaction.findMany.mockResolvedValue([]);
      prisma.canteenMealServing.findMany.mockResolvedValue([]);

      const result = await service.getStudentCanteen('student-1', actor);

      expect(result.wallet).toEqual(
        expect.objectContaining({
          balance: 80,
          lowBalanceThreshold: 100,
          isLowBalance: true,
        }),
      );
    });
  });

  describe('parent fees summary', () => {
    function authorizeChild(studentId = 'student-1') {
      prisma.student.findFirst.mockResolvedValue({ id: studentId });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId,
            guardianId: 'guardian-1',
            capabilities: ALL_GUARDIAN_CAPABILITIES,
          },
        ],
      });
    }

    it('returns an empty summary without line, payment, or receipt lookups', async () => {
      authorizeChild();
      prisma.invoice.findMany.mockResolvedValue([]);

      await expect(
        service.getStudentFeesSummary('student-1', actor),
      ).resolves.toEqual({
        status: 'PAID',
        totalAmount: '0.00',
        paidAmount: '0.00',
        totalOutstanding: '0.00',
        overdueCount: 0,
        nextDueDate: null,
        recentInvoices: [],
        recentReceipts: [],
        recentRefunds: [],
      });

      expect(prisma.invoiceLine.findMany).not.toHaveBeenCalled();
      expect(prisma.paymentAllocation.findMany).not.toHaveBeenCalled();
      expect(prisma.receipt.findMany).not.toHaveBeenCalled();
      expect(prisma.feeHead.findMany).not.toHaveBeenCalled();
    });

    it('loads a populated summary with batched fee heads and receipts', async () => {
      authorizeChild();
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-001',
          status: 'PAID',
          dueDate: new Date('2026-07-01T00:00:00.000Z'),
          issuedAt: new Date('2026-06-01T00:00:00.000Z'),
          subtotal: 1000,
          vatAmount: 0,
          totalAmount: 1000,
        },
      ]);
      prisma.invoiceLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          invoiceId: 'invoice-1',
          feeHeadId: 'head-1',
          description: 'Tuition',
          quantity: 1,
          unitAmount: 1000,
          vatAmount: 0,
          totalAmount: 1000,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ]);
      prisma.paymentAllocation.findMany.mockResolvedValue([
        {
          id: 'allocation-1',
          invoiceId: 'invoice-1',
          amount: 1000,
          allocationType: 'INVOICE',
          allocatedAt: new Date('2026-06-15T00:00:00.000Z'),
          payment: {
            id: 'payment-1',
            method: 'CASH',
            paidAt: new Date('2026-06-15T00:00:00.000Z'),
          },
        },
      ]);
      prisma.feeHead.findMany.mockResolvedValue([
        { id: 'head-1', code: 'TUITION', name: 'Tuition Fee' },
      ]);
      prisma.receipt.findMany.mockResolvedValue([
        {
          id: 'receipt-1',
          paymentId: 'payment-1',
          receiptNumber: 'REC-001',
          issuedAt: new Date('2026-06-15T00:01:00.000Z'),
        },
      ]);

      const result = await service.getStudentFeesSummary('student-1', actor);

      expect(result.status).toBe('PAID');
      expect(result.recentInvoices[0]?.lines[0]?.feeHead).toEqual({
        code: 'TUITION',
        name: 'Tuition Fee',
      });
      expect(result.recentReceipts[0]?.receiptNumber).toBe('REC-001');
      expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.invoiceLine.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.paymentAllocation.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.feeHead.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.receipt.findMany).toHaveBeenCalledTimes(1);
    });

    it('denies fee reads without FEES_VIEW capability', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          {
            studentId: 'student-1',
            guardianId: 'guardian-1',
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
          },
        ],
      });

      await expect(
        service.getStudentFeesSummary('student-1', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it('omits cross-tenant fee heads rather than leaking them', async () => {
      authorizeChild();
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-001',
          status: 'ISSUED',
          dueDate: new Date('2026-08-01T00:00:00.000Z'),
          issuedAt: new Date('2026-07-01T00:00:00.000Z'),
          subtotal: 500,
          vatAmount: 0,
          totalAmount: 500,
        },
      ]);
      prisma.invoiceLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          invoiceId: 'invoice-1',
          feeHeadId: 'head-other-tenant',
          description: 'Mystery charge',
          quantity: 1,
          unitAmount: 500,
          vatAmount: 0,
          totalAmount: 500,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ]);
      prisma.paymentAllocation.findMany.mockResolvedValue([]);
      prisma.feeHead.findMany.mockResolvedValue([]);

      const result = await service.getStudentFeesSummary('student-1', actor);

      expect(result.recentInvoices[0]?.lines[0]?.feeHead).toEqual({
        code: '',
        name: '',
      });
      expect(JSON.stringify(result)).not.toContain('head-other-tenant');
    });
  });

  it('streams receipt PDFs only after linked-child access is verified', async () => {
    const pdf = Buffer.from('%PDF parent receipt');
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
    prisma.guardian.findFirst.mockResolvedValue({
      id: 'guardian-1',
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
    });
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
      studentLinks: [
        {
          studentId: 'student-1',
          guardianId: 'guardian-1',
          capabilities: ALL_GUARDIAN_CAPABILITIES,
        },
      ],
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
          confirmStudentId: 'student-1',
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
          confirmStudentId: 'student-1',
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
