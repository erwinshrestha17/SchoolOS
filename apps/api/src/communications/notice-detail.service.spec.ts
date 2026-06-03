import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { NoticeDetailService } from './notice-detail.service';

describe('NoticeDetailService', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['notices:read'],
    tenantSlug: 'green-valley',
  };

  const buildService = () => {
    const prisma = {
      notice: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        groupBy: jest.fn().mockResolvedValue([]),
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

  it('fails closed for missing or cross-tenant notice details', async () => {
    const { service, prisma, fileRegistry } = buildService();
    prisma.notice.findFirst.mockResolvedValue(null);

    await expect(service.getNoticeDetail('notice-1', actor)).rejects.toThrow(
      'Notice not found',
    );

    expect(fileRegistry.listFilesByEntity).not.toHaveBeenCalled();
  });
});

function noticeRecord(overrides: { attachmentUrl?: string | null } = {}) {
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
    scheduledFor: null,
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  };
}
