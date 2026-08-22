import { AuthMethod, NoticeLifecycleStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { NoticeDetailService } from './notice-detail.service';

describe('NoticeDetailService', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['notices:read', 'notices:read_reports'],
    tenantSlug: 'green-valley',
  };

  const buildService = () => {
    const prisma = {
      notice: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'delivery-1' }),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      approvalRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      noticeAcknowledgement: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const fileRegistry = {
      listFilesByEntity: jest.fn().mockResolvedValue([]),
      getSignedUrl: jest.fn(),
    };

    return {
      service: new NoticeDetailService(prisma as never, fileRegistry as never),
      prisma,
      fileRegistry,
    };
  };

  it('refreshes notice attachment URLs from linked File Registry assets', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: 'https://expired.example/notice.pdf',
      }),
    );
    fileRegistry.listFilesByEntity.mockResolvedValue([
      { id: 'file-1', status: 'UPLOADED' },
    ]);
    fileRegistry.getSignedUrl.mockResolvedValue(
      'http://localhost:4000/api/v1/files/file-1/preview',
    );

    const detail = await service.getNoticeDetail('notice-1', actor);

    expect(prisma.notice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice-1', tenantId: actor.tenantId },
      }),
    );
    expect(fileRegistry.listFilesByEntity).toHaveBeenCalledWith(
      actor.tenantId,
      'notices',
      'notice-1',
    );
    expect(fileRegistry.getSignedUrl).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
    );
    expect(detail.attachmentUrl).toBe(
      'http://localhost:4000/api/v1/files/file-1/preview',
    );
    expect(detail.attachmentFileId).toBe('file-1');
    expect(detail.auditHistory).toEqual([]);
    expect(detail.approvalHistory).toEqual([]);
  });

  it('returns a published support projection without recipient, history, or file metadata reads', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: 'https://expired.example/notice.pdf',
      }),
    );
    fileRegistry.listFilesByEntity.mockResolvedValue([
      { id: 'file-1', status: 'UPLOADED' },
    ]);

    const detail = await service.getNoticeDetail('notice-1', {
      ...actor,
      isSupportOverride: true,
    });

    expect(detail.attachmentFileId).toBeNull();
    expect(detail.attachmentUrl).toBeNull();
    expect(detail.createdBy).toBeNull();
    expect(detail.requiresAcknowledgement).toBe(false);
    expect(detail.templateId).toBeNull();
    expect(detail.roleNames).toEqual([]);
    expect(detail.staffIds).toEqual([]);
    expect(detail.studentIds).toEqual([]);
    expect(detail.guardianIds).toEqual([]);
    expect(detail.recipientUserIds).toEqual([]);
    expect(detail.approvalRequestId).toBeNull();
    expect(detail.auditHistory).toEqual([]);
    expect(detail.approvalHistory).toEqual([]);
    expect(prisma.notice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'notice-1',
          tenantId: actor.tenantId,
          lifecycleStatus: {
            in: [
              NoticeLifecycleStatus.PUBLISHED,
              NoticeLifecycleStatus.EXPIRED,
            ],
          },
        },
      }),
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.approvalRequest.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.noticeAcknowledgement.findUnique).not.toHaveBeenCalled();
    expect(fileRegistry.listFilesByEntity).not.toHaveBeenCalled();
    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
  });

  it('keeps stale support report permission outside draft notice details', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(null);

    await expect(
      service.getNoticeDetail('draft-notice', {
        ...actor,
        isSupportOverride: true,
      }),
    ).rejects.toThrow('Notice not found');

    expect(prisma.notice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'draft-notice',
          tenantId: actor.tenantId,
          lifecycleStatus: {
            in: [
              NoticeLifecycleStatus.PUBLISHED,
              NoticeLifecycleStatus.EXPIRED,
            ],
          },
        },
      }),
    );
    expect(prisma.notificationDelivery.findFirst).not.toHaveBeenCalled();
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.approvalRequest.findFirst).not.toHaveBeenCalled();
    expect(fileRegistry.listFilesByEntity).not.toHaveBeenCalled();
  });

  it('suppresses legacy notice attachment URLs during support override', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: 'https://legacy.example/notice.pdf',
      }),
    );

    const detail = await service.getNoticeDetail('notice-1', {
      ...actor,
      isSupportOverride: true,
    });

    expect(detail.attachmentFileId).toBeNull();
    expect(detail.attachmentUrl).toBeNull();
    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
  });

  it('falls back to legacy attachmentUrl when no linked File Registry asset exists', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: 'https://legacy.example/notice.pdf',
      }),
    );
    fileRegistry.listFilesByEntity.mockResolvedValue([]);

    const detail = await service.getNoticeDetail('notice-1', actor);

    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
    expect(detail.attachmentUrl).toBe('https://legacy.example/notice.pdf');
  });

  it('does not expose raw legacy object keys when no linked File Registry asset exists', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: 'tenant-1/notices/raw-object-key.pdf',
      }),
    );
    fileRegistry.listFilesByEntity.mockResolvedValue([]);

    const detail = await service.getNoticeDetail('notice-1', actor);

    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
    expect(detail.attachmentUrl).toBeNull();
  });

  it('allows protected API paths for legacy notice attachments', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({
        attachmentUrl: '/api/v1/files/file-1/preview',
      }),
    );
    fileRegistry.listFilesByEntity.mockResolvedValue([]);

    const detail = await service.getNoticeDetail('notice-1', actor);

    expect(fileRegistry.getSignedUrl).not.toHaveBeenCalled();
    expect(detail.attachmentUrl).toBe('/api/v1/files/file-1/preview');
  });

  it('fails closed for missing or cross-tenant notice details', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(null);

    await expect(service.getNoticeDetail('notice-1', actor)).rejects.toThrow(
      'Notice not found',
    );

    expect(fileRegistry.listFilesByEntity).not.toHaveBeenCalled();
  });

  it('fails closed when a read-only user is outside the resolved audience', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(noticeRecord());
    prisma.notificationDelivery.findFirst.mockResolvedValue(null);

    await expect(
      service.getNoticeDetail('notice-1', {
        ...actor,
        permissions: ['notices:read'],
      }),
    ).rejects.toThrow('Notice not found');

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        noticeId: 'notice-1',
        recipientUserId: actor.userId,
      },
      select: { id: true },
    });
    expect(fileRegistry.listFilesByEntity).not.toHaveBeenCalled();
  });

  it('hides staff identity and audit history from recipient-only detail', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue(noticeRecord());

    const detail = await service.getNoticeDetail('notice-1', {
      ...actor,
      permissions: ['notices:read'],
    });

    expect(detail.createdBy).toBeNull();
    expect(detail.auditHistory).toEqual([]);
    expect(detail.approvalHistory).toEqual([]);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.approvalRequest.findFirst).not.toHaveBeenCalled();
  });

  it('returns required acknowledgement and the current recipient state', async () => {
    const { service, prisma } = buildService();
    prisma.notice.findFirst.mockResolvedValue(
      noticeRecord({ requiresAcknowledgement: true }),
    );
    prisma.noticeAcknowledgement.findUnique.mockResolvedValue({
      firstAcknowledgedAt: new Date('2026-07-26T03:00:00.000Z'),
    });

    const detail = await service.getNoticeDetail('notice-1', actor);

    expect(detail.requiresAcknowledgement).toBe(true);
    expect(detail.acknowledgedAt).toBe('2026-07-26T03:00:00.000Z');
    expect(prisma.noticeAcknowledgement.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_noticeId_recipientUserId: {
          tenantId: actor.tenantId,
          noticeId: 'notice-1',
          recipientUserId: actor.userId,
        },
      },
      select: { firstAcknowledgedAt: true },
    });
  });
});

function noticeRecord(
  overrides: {
    attachmentUrl?: string | null;
    requiresAcknowledgement?: boolean;
  } = {},
) {
  return {
    id: 'notice-1',
    title: 'Circular',
    body: 'Read the attachment.',
    priority: 'NORMAL',
    audienceType: 'ALL',
    classId: null,
    sectionId: null,
    class: null,
    section: null,
    createdBy: { id: 'user-1', email: 'admin@school.test' },
    attachmentUrl: overrides.attachmentUrl ?? null,
    requiresAcknowledgement: overrides.requiresAcknowledgement ?? false,
    lifecycleStatus: 'PUBLISHED',
    approvalRequestId: null,
    scheduledFor: null,
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    expiresAt: null,
    cancelledAt: null,
    cancellationReason: null,
    archivedAt: null,
    archiveReason: null,
    archivedFromStatus: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  };
}
