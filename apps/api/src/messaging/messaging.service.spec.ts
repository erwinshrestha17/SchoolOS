import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  const parentActor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'parent-user-1',
    email: 'parent@school.test',
    roles: ['parent'],
    permissions: ['messaging:read', 'messaging:create'],
    authMethod: AuthMethod.PASSWORD,
    tenantSlug: 'green-valley',
  };

  const staffActor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'staff-user-1',
    email: 'teacher@school.test',
    roles: ['teacher'],
    permissions: ['messaging:read', 'messaging:create'],
    authMethod: AuthMethod.PASSWORD,
    tenantSlug: 'green-valley',
  };

  const buildService = () => {
    const prisma = {
      conversation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
      },
      studentGuardian: {
        findMany: jest.fn(),
      },
      guardianConsent: {
        findFirst: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      messageReadReceipt: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      notificationDelivery: {
        create: jest.fn(),
      },
      class: {
        findFirst: jest.fn(),
      },
      section: {
        findFirst: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
      },
    };
    const communicationsService = {
      recordDeliveryRecords: jest.fn(),
    };
    const auditService = {
      record: jest.fn(),
    };
    const eventEmitter = {
      emit: jest.fn(),
    };
    const usageService = {
      checkLimit: jest.fn(),
      incrementUsage: jest.fn(),
    };

    return {
      service: new MessagingService(
        prisma as never,
        communicationsService as never,
        auditService as never,
        eventEmitter as never,
        usageService as never,
      ),
      prisma,
      communicationsService,
      eventEmitter,
      usageService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes parent message reads to live linked children and suppresses raw attachment keys', async () => {
    const { service, prisma } = buildService();
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.studentGuardian.findMany.mockResolvedValue([
      { studentId: 'student-1' },
    ]);
    prisma.message.findMany.mockResolvedValue([
      messageRecord({
        id: 'message-raw',
        attachmentUrl: 'tenant-1/messages/private-object.pdf',
      }),
      messageRecord({
        id: 'message-protected',
        attachmentUrl: '/api/v1/files/file-1/preview',
      }),
    ]);

    const result = await service.listMessages(parentActor);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          conversation: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                studentId: { in: ['student-1'] },
              }),
            ]),
          }),
        },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({ id: 'message-raw', attachmentUrl: null }),
      expect.objectContaining({
        id: 'message-protected',
        attachmentUrl: '/api/v1/files/file-1/preview',
      }),
    ]);
  });

  it('denies parent writes to old child conversations after guardian removal', async () => {
    const { service, prisma } = buildService();
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.studentGuardian.findMany.mockResolvedValue([
      { studentId: 'student-current' },
    ]);
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-old-child',
          body: 'Can I still see this?',
        },
        parentActor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'conversation-old-child',
          tenantId: 'tenant-1',
          OR: expect.arrayContaining([
            expect.objectContaining({
              studentId: { in: ['student-current'] },
            }),
          ]),
        }),
      }),
    );
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('uses the authenticated guardian for parent read receipts instead of caller supplied guardianId', async () => {
    const { service, prisma } = buildService();
    const readAt = new Date('2026-06-01T00:00:00.000Z');
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.studentGuardian.findMany.mockResolvedValue([
      { studentId: 'student-1' },
    ]);
    prisma.message.findFirst.mockResolvedValue(
      messageRecord({ id: 'message-1', conversationId: 'conversation-1' }),
    );
    prisma.messageReadReceipt.create.mockResolvedValue({
      id: 'receipt-1',
      readAt,
    });

    await service.markRead(
      { messageId: 'message-1', guardianId: 'guardian-2' },
      parentActor,
    );

    expect(prisma.messageReadReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guardianId: 'guardian-1',
          readerUserId: 'parent-user-1',
        }),
      }),
    );
    expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ userId: 'parent-user-1' }, { guardianId: 'guardian-1' }],
        }),
      }),
    );
  });

  it('scopes parent unread counts to live guardian conversations', async () => {
    const { service, prisma } = buildService();
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.studentGuardian.findMany.mockResolvedValue([
      { studentId: 'student-1' },
    ]);
    prisma.conversationParticipant.findMany.mockResolvedValue([
      {
        id: 'participant-1',
        conversationId: 'conversation-1',
        lastReadAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);
    prisma.message.count.mockResolvedValue(2);

    const result = await service.getUnreadCount(parentActor);

    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [{ userId: 'parent-user-1' }, { guardianId: 'guardian-1' }],
          conversation: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                studentId: { in: ['student-1'] },
              }),
            ]),
          }),
        }),
      }),
    );
    expect(prisma.message.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: 'conversation-1',
          conversation: expect.any(Object),
        }),
      }),
    );
    expect(result).toEqual({ unreadCount: 2 });
  });

  it('emits only a tenant-scoped change signal after creating a message', async () => {
    const { service, prisma, eventEmitter, usageService } = buildService();
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      tenantId: 'tenant-1',
      type: 'DIRECT',
      classId: null,
      sectionId: null,
      studentId: null,
      guardianId: null,
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    prisma.message.create.mockResolvedValue(
      messageRecord({
        id: 'message-1',
        conversationId: 'conversation-1',
        attachmentUrl: '/api/v1/files/file-1/preview',
      }),
    );
    prisma.conversation.update.mockResolvedValue({ id: 'conversation-1' });

    await service.createMessage(
      {
        conversationId: 'conversation-1',
        body: 'Sensitive body',
        attachmentUrl: '/api/v1/files/file-1/preview',
      },
      staffActor,
    );

    expect(usageService.checkLimit).toHaveBeenCalledWith(
      'tenant-1',
      'messages.sent',
      1,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('message.sent', {
      tenantId: 'tenant-1',
    });
  });

  it('rejects raw object-key attachment URLs on message writes', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.createMessage(
        {
          conversationId: 'conversation-1',
          body: 'Attached',
          attachmentUrl: 'tenant-1/messages/raw-object.pdf',
        },
        staffActor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

function messageRecord(
  overrides: Partial<{
    id: string;
    conversationId: string;
    attachmentUrl: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'message-1',
    tenantId: 'tenant-1',
    conversationId: overrides.conversationId ?? 'conversation-1',
    senderUserId: 'staff-user-1',
    senderStaffId: 'staff-1',
    senderGuardianId: null,
    body: 'Hello',
    attachmentUrl: overrides.attachmentUrl ?? null,
    status: 'SENT',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    conversation: { id: overrides.conversationId ?? 'conversation-1' },
    senderStaff: null,
    senderGuardian: null,
    readReceipts: [],
  };
}
