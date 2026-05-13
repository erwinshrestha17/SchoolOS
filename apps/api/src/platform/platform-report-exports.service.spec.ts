import { PlatformReportExportsService } from './platform-report-exports.service';

describe('PlatformReportExportsService', () => {
  let prisma: any;
  let service: PlatformReportExportsService;

  beforeEach(() => {
    prisma = {
      reportExport: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new PlatformReportExportsService(prisma);
  });

  it('returns empty pagination result when ReportExport delegate is unavailable', async () => {
    service = new PlatformReportExportsService({} as any);

    await expect(
      service.listReportExportsPage({ tenantId: 'tenant-1', page: 1, limit: 25 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      hasNextPage: false,
    });
  });

  it('applies tenant scope, module, report type, status, requestedBy, and pagination filters', async () => {
    const items = [
      {
        id: 'export-1',
        tenantId: 'tenant-1',
        scope: 'fees',
        reportKey: 'defaulter-aging',
        status: 'COMPLETED',
        requestedBy: 'user-1',
      },
    ];
    prisma.reportExport.findMany.mockResolvedValue(items);
    prisma.reportExport.count.mockResolvedValue(51);

    await expect(
      service.listReportExportsPage({
        tenantId: ' tenant-1 ',
        module: ' fees ',
        reportType: ' defaulter-aging ',
        status: ' COMPLETED ',
        requestedBy: ' user-1 ',
        page: 2,
        limit: 25,
      }),
    ).resolves.toEqual({
      items,
      total: 51,
      page: 2,
      limit: 25,
      hasNextPage: true,
    });

    const expectedWhere = {
      tenantId: 'tenant-1',
      scope: 'fees',
      reportKey: 'defaulter-aging',
      status: 'COMPLETED',
      requestedBy: 'user-1',
    };

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: { createdAt: 'desc' },
      skip: 25,
      take: 25,
    });
    expect(prisma.reportExport.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('uses undefined where when no filters are provided', async () => {
    prisma.reportExport.findMany.mockResolvedValue([]);
    prisma.reportExport.count.mockResolvedValue(0);

    await expect(service.listReportExportsPage({})).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      hasNextPage: false,
    });

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 25,
    });
    expect(prisma.reportExport.count).toHaveBeenCalledWith({
      where: undefined,
    });
  });

  it('normalizes invalid pagination and caps high limits', async () => {
    prisma.reportExport.findMany.mockResolvedValue([]);
    prisma.reportExport.count.mockResolvedValue(250);

    await expect(
      service.listReportExportsPage({ page: -5, limit: 500 }),
    ).resolves.toEqual({
      items: [],
      total: 250,
      page: 1,
      limit: 100,
      hasNextPage: true,
    });

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });

  it('listReportExports returns first 100 tenant-scoped items for compatibility', async () => {
    const items = [{ id: 'export-1', tenantId: 'tenant-1' }];
    prisma.reportExport.findMany.mockResolvedValue(items);
    prisma.reportExport.count.mockResolvedValue(1);

    await expect(service.listReportExports('tenant-1')).resolves.toEqual(items);

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 100,
    });
  });

  it('records report export history with tenantId, module scope, report type, requestedBy, status, and completedAt', async () => {
    const created = {
      id: 'export-1',
      tenantId: 'tenant-1',
      scope: 'attendance',
      reportKey: 'monthly-register',
      format: 'CSV',
      status: 'COMPLETED',
      requestedBy: 'user-1',
    };
    prisma.reportExport.create.mockResolvedValue(created);

    await expect(
      service.recordReportExport({
        tenantId: 'tenant-1',
        scope: 'attendance',
        reportKey: 'monthly-register',
        format: 'CSV',
        filters: { classId: 'class-1' },
        requestedBy: 'user-1',
      }),
    ).resolves.toEqual(created);

    expect(prisma.reportExport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        scope: 'attendance',
        reportKey: 'monthly-register',
        format: 'CSV',
        filters: { classId: 'class-1' },
        requestedBy: 'user-1',
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      }),
    });
  });
});
