import { ForbiddenException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobileService } from './mobile.service';

describe('MobileService', () => {
  type MockModel<TMethods extends string> = Record<TMethods, jest.Mock>;
  interface MobileServicePrismaMock {
    guardian: MockModel<'findFirst'>;
    student: MockModel<'findFirst' | 'findMany'>;
    invoice: MockModel<'findMany'>;
    notificationDelivery: MockModel<'findMany' | 'findFirst' | 'count'>;
    notificationReadReceipt: MockModel<'upsert' | 'createMany'>;
    homeworkAssignment: MockModel<'findMany'>;
    transportStudentAssignment: MockModel<'findFirst'>;
    transportEnrollment: MockModel<'findFirst'>;
    transportTripStudentStatus: MockModel<'findFirst'>;
  }

  let prisma: MobileServicePrismaMock;
  let attendanceService: { getParentSummary: jest.Mock };
  let financeService: { getReceiptPdfForStudent: jest.Mock };
  let entitlementsService: { getEntitlements: jest.Mock };
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
    service = new MobileService(
      prisma as never,
      attendanceService as never,
      financeService as never,
      entitlementsService as never,
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
    expect(attendanceSpy).not.toHaveBeenCalled();
    expect(feesSpy).not.toHaveBeenCalled();
    expect(homeworkSpy).not.toHaveBeenCalled();
    expect(transportSpy).not.toHaveBeenCalled();
    expect(canteenSpy).not.toHaveBeenCalled();
    expect(activitySpy).not.toHaveBeenCalled();
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
});
