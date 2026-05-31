import { ForbiddenException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobileService } from './mobile.service';

describe('MobileService', () => {
  let prisma: any;
  let attendanceService: any;
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
      },
      homeworkAssignment: {
        findMany: jest.fn(),
      },
    };
    attendanceService = {
      getParentSummary: jest.fn(),
    };
    service = new MobileService(prisma, attendanceService);
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
});
