import { BrandingDocumentsService } from './branding-documents.service';

describe('BrandingDocumentsService', () => {
  const tenantId = 'tenant-a';
  const userId = 'user-a';

  function buildService() {
    const prisma = {
      tenantSetting: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const auditService = { record: jest.fn() };
    return {
      service: new BrandingDocumentsService(prisma as never, auditService as never),
      prisma,
      auditService,
    };
  }

  it('returns branding fields only from the requested tenant and ignores malformed logo ids', async () => {
    const { service, prisma } = buildService();
    prisma.tenantSetting.findMany.mockResolvedValue([
      { key: 'school_logo', value: 'not-a-file-id', updatedAt: new Date('2026-06-20T00:00:00.000Z') },
      { key: 'branding_primary_color', value: '#2563EB', updatedAt: new Date('2026-06-20T00:00:00.000Z') },
    ]);

    const branding = await service.getBranding(tenantId);

    expect(prisma.tenantSetting.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId }),
    }));
    expect(branding).toMatchObject({
      logoFileAssetId: null,
      primaryColor: '#2563EB',
    });
  });

  it('updates only provided branding fields atomically and audits changed keys', async () => {
    const { service, prisma, auditService } = buildService();
    prisma.tenantSetting.upsert.mockResolvedValue({});
    prisma.tenantSetting.findMany.mockResolvedValue([
      { key: 'branding_primary_color', value: '#1D4ED8', updatedAt: new Date('2026-06-20T00:00:00.000Z') },
      { key: 'default_paper_size', value: 'A4', updatedAt: new Date('2026-06-20T00:00:00.000Z') },
    ]);

    await service.updateBranding(tenantId, {
      primaryColor: '#1D4ED8',
      defaultPaperSize: 'A4',
    }, userId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tenantSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_key: { tenantId, key: 'branding_primary_color' } },
    }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId,
      action: 'branding_documents_updated',
      after: { changedKeys: ['branding_primary_color', 'default_paper_size'] },
    }));
  });
});
