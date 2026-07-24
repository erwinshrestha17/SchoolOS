import { AccountingM9Controller } from './accounting-m9.controller';
import { NEPAL_SCHOOL_CHART_TEMPLATE } from './m9-accounting.utils';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
} as any;

describe('AccountingM9Controller', () => {
  it('previews the Nepal school chart template with account rows', () => {
    const { controller } = buildController();

    const result = controller.previewNepalChartTemplate();

    expect(result).toEqual({
      template: 'NEPAL_SCHOOL_STANDARD',
      status: 'available',
      accountCount: NEPAL_SCHOOL_CHART_TEMPLATE.length,
      accounts: NEPAL_SCHOOL_CHART_TEMPLATE,
    });
    expect(result.accounts.some((account) => account.code === '4000')).toBe(
      true,
    );
    expect(result.accounts.some((account) => account.code === '2220')).toBe(
      true,
    );
  });

  it('imports the Nepal school chart template through the M9 route facade', async () => {
    const { controller, templates } = buildController();
    templates.importNepalChartTemplate.mockResolvedValue({
      template: 'NEPAL_SCHOOL_STANDARD',
      count: NEPAL_SCHOOL_CHART_TEMPLATE.length,
      accounts: [],
    });

    const result = await controller.importNepalChartTemplate(actor);

    expect(templates.importNepalChartTemplate).toHaveBeenCalledWith(actor);
    expect(result).toEqual(
      expect.objectContaining({
        template: 'NEPAL_SCHOOL_STANDARD',
        count: NEPAL_SCHOOL_CHART_TEMPLATE.length,
      }),
    );
  });

  it('delegates source mapping health to the M9 source service with current actor', async () => {
    const { controller, sources } = buildController();
    sources.getSourceMappingHealth.mockResolvedValue({
      tenantId: 'tenant-1',
      isClean: true,
    });

    await expect(controller.getSourceMappingHealth(actor)).resolves.toEqual({
      tenantId: 'tenant-1',
      isClean: true,
    });
    expect(sources.getSourceMappingHealth).toHaveBeenCalledWith(actor);
  });

  it('delegates the principal snapshot to the real M9 service with current actor', async () => {
    const { controller, m9 } = buildController();
    m9.principalSnapshot.mockResolvedValue({
      readOnly: true,
      generatedAt: '2026-07-24T00:00:00.000Z',
      fiscalYear: { id: 'fy-1', name: 'FY 2082-83', status: 'OPEN' },
      currentPeriod: null,
      postingQueue: { awaitingReview: 2, awaitingPosting: 1 },
      netPosition: null,
      reconciliation: {
        isClean: true,
        missingSourceIdCount: 0,
        checkedAt: '2026-07-24T00:00:00.000Z',
      },
    });

    const result = await controller.principalSnapshot(actor);

    expect(m9.principalSnapshot).toHaveBeenCalledWith(actor);
    expect(result).toEqual(
      expect.objectContaining({
        readOnly: true,
        postingQueue: { awaitingReview: 2, awaitingPosting: 1 },
      }),
    );
    expect(result).not.toEqual(
      expect.objectContaining({ status: 'pending-report-snapshot-service' }),
    );
  });
});

function buildController() {
  const m9 = {
    health: jest.fn(),
    principalSnapshot: jest.fn(),
  };
  const sources = {
    listMappings: jest.fn(),
    getSourceMappingHealth: jest.fn(),
  };
  const templates = {
    importNepalChartTemplate: jest.fn(),
  };
  return {
    controller: new AccountingM9Controller(
      m9 as any,
      sources as any,
      templates as any,
    ),
    m9,
    sources,
    templates,
  };
}
