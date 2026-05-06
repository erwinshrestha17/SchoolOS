import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  MessageStatus,
  ParentTeacherMessagePriority,
  ParentTeacherSenderRole,
  ParentTeacherThreadStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthContext } from '../auth/auth.types';
import { CreateParentTeacherMessageDto } from './dto/parent-teacher-chat.dto';
import { ParentTeacherChatService } from './parent-teacher-chat.service';

describe('ParentTeacherChatService', () => {
  let prisma: any;
  let communicationsService: any;
  let auditService: any;
  let service: ParentTeacherChatService;

  const parentActor: AuthContext = {
    userId: 'guardian-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'parent@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['parent'],
    permissions: ['messaging:read', 'messaging:create'],
  };

  const teacherActor: AuthContext = {
    ...parentActor,
    userId: 'teacher-user-1',
    email: 'teacher@school.test',
    roles: ['teacher'],
  };

  const adminActor: AuthContext = {
    ...parentActor,
    userId: 'admin-1',
    email: 'admin@school.test',
    roles: ['admin'],
  };

  const thread: {
    id: string;
    tenantId: string;
    academicYearId: string;
    studentId: string;
    guardianId: string;
    classTeacherId: string;
    status: ParentTeacherThreadStatus;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
    closedByUserId: string | null;
    closeReason: string | null;
  } = {
    id: 'thread-1',
    tenantId: 'tenant-1',
    academicYearId: 'year-1',
    studentId: 'student-1',
    guardianId: 'guardian-1',
    classTeacherId: 'staff-1',
    status: ParentTeacherThreadStatus.OPEN,
    createdAt: new Date('2026-05-06T10:00:00.000Z'),
    updatedAt: new Date('2026-05-06T10:00:00.000Z'),
    closedAt: null,
    closedByUserId: null,
    closeReason: null,
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) =>
        typeof input === 'function'
          ? input(prisma)
          : Promise.all(input as Promise<unknown>[]),
      ),
      parentTeacherThread: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      parentTeacherMessage: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      chatAvailabilityRule: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      chatEscalation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      chatAbuseReport: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      student: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      guardian: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      staff: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentGuardian: {
        findFirst: jest.fn(),
      },
      subjectTeacherAssignment: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        create: jest.fn(),
      },
    };

    communicationsService = {
      recordDeliveryRecords: jest.fn(),
    };
    auditService = {
      record: jest.fn(),
    };
    service = new ParentTeacherChatService(
      prisma,
      communicationsService,
      auditService,
    );
  });

  it('scopes parent thread lists to the linked guardian only', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.parentTeacherThread.count.mockResolvedValue(1);
    prisma.parentTeacherThread.findMany.mockResolvedValue([thread]);
    mockEnrichment();

    const result = await service.listThreads({}, parentActor);

    expect(prisma.parentTeacherThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          guardianId: 'guardian-1',
        }),
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('rejects a parent trying to open a thread with an arbitrary teacher', async () => {
    mockCurrentYearAndStudent();
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.studentGuardian.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.createOrGetThread(
        { studentId: 'student-1', classTeacherId: 'staff-2' },
        parentActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows teachers to read only their assigned thread', async () => {
    prisma.parentTeacherThread.findFirst.mockResolvedValue(thread);
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1' });
    mockEnrichment();

    const result = await service.getThread('thread-1', teacherActor);

    expect(result.id).toBe('thread-1');
  });

  it('lets admin close tenant-scoped threads for moderation', async () => {
    prisma.parentTeacherThread.findFirst
      .mockResolvedValueOnce(thread)
      .mockResolvedValueOnce({
        ...thread,
        status: ParentTeacherThreadStatus.CLOSED,
        closeReason: 'Resolved at school office',
      });
    prisma.parentTeacherThread.update.mockResolvedValue({
      ...thread,
      status: ParentTeacherThreadStatus.CLOSED,
      closeReason: 'Resolved at school office',
    });
    mockEnrichment();

    await service.closeThread(
      'thread-1',
      { reason: 'Resolved at school office' },
      adminActor,
    );

    expect(prisma.parentTeacherThread.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'thread-1' },
        data: expect.objectContaining({
          status: ParentTeacherThreadStatus.CLOSED,
          closedByUserId: 'admin-1',
        }),
      }),
    );
  });

  it('rejects cross-tenant thread access through tenant-scoped lookup', async () => {
    prisma.parentTeacherThread.findFirst.mockResolvedValue(null);

    await expect(service.getThread('thread-1', parentActor)).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.parentTeacherThread.findFirst).toHaveBeenCalledWith({
      where: { id: 'thread-1', tenantId: 'tenant-1' },
    });
  });

  it('returns outside-hours queued metadata when parents send after hours', async () => {
    prisma.parentTeacherThread.findFirst.mockResolvedValue(thread);
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.chatAvailabilityRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-1',
        dayOfWeek: new Date(Date.now() + 345 * 60_000).getUTCDay(),
        enabled: false,
        startTime: '00:00',
        endTime: '00:00',
        appliesToRole: 'BOTH',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prisma.parentTeacherMessage.create.mockResolvedValue({
      id: 'message-1',
      threadId: 'thread-1',
      senderUserId: 'guardian-user-1',
      senderRole: ParentTeacherSenderRole.PARENT,
      message: 'Please call me after school.',
      priority: ParentTeacherMessagePriority.NORMAL,
      status: MessageStatus.SENT,
    });
    prisma.parentTeacherThread.update.mockResolvedValue(thread);
    prisma.notificationDelivery.create.mockResolvedValue({ id: 'delivery-1' });

    const result = await service.sendMessage(
      'thread-1',
      { message: 'Please call me after school.' },
      parentActor,
    );

    expect(result.queuedNotice).toContain('school chat hours');
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'QUEUED',
          errorMessage: expect.stringContaining('school chat hours'),
        }),
      }),
    );
  });

  it('updates read receipts on visible unread messages', async () => {
    prisma.parentTeacherThread.findFirst.mockResolvedValue(thread);
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
    prisma.parentTeacherMessage.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markThreadRead('thread-1', parentActor);

    expect(result.count).toBe(2);
    expect(prisma.parentTeacherMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          threadId: 'thread-1',
          senderUserId: { not: 'guardian-user-1' },
        }),
        data: expect.objectContaining({ status: MessageStatus.READ }),
      }),
    );
  });

  it('rejects new normal messages on closed threads', async () => {
    prisma.parentTeacherThread.findFirst.mockResolvedValue({
      ...thread,
      status: ParentTeacherThreadStatus.CLOSED,
    });
    prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });

    await expect(
      service.sendMessage('thread-1', { message: 'Hello' }, parentActor),
    ).rejects.toThrow('Closed parent-teacher threads reject new messages');
  });

  it('validates empty and oversized message DTOs', async () => {
    const empty = plainToInstance(CreateParentTeacherMessageDto, {
      message: '',
    });
    const oversized = plainToInstance(CreateParentTeacherMessageDto, {
      message: 'x'.repeat(2001),
    });

    await expect(validate(empty)).resolves.not.toHaveLength(0);
    await expect(validate(oversized)).resolves.not.toHaveLength(0);
  });

  function mockCurrentYearAndStudent() {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
  }

  function mockEnrichment(overrides: Partial<typeof thread> = {}) {
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        firstNameEn: 'Asha',
        lastNameEn: 'Shrestha',
        studentSystemId: 'SOS-001',
        class: { name: 'Class 2' },
        sectionRef: { name: 'A' },
      },
    ]);
    prisma.guardian.findMany.mockResolvedValue([
      { id: 'guardian-1', fullName: 'Maya Shrestha', relation: 'Mother' },
    ]);
    prisma.staff.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        firstName: 'Sita',
        lastName: 'Adhikari',
        userId: 'teacher-user-1',
      },
    ]);
    prisma.academicYear.findMany.mockResolvedValue([
      { id: 'year-1', name: '2082' },
    ]);
    prisma.parentTeacherMessage.findMany.mockResolvedValue([]);
    if (Object.keys(overrides).length > 0) {
      prisma.parentTeacherThread.findFirst.mockResolvedValue({
        ...thread,
        ...overrides,
      });
    }
  }
});
