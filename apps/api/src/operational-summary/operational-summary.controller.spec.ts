import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  OperationalDashboardSummaryController,
  OperationalMobileSummaryController,
} from './operational-summary.controller';
import { OperationalSummaryService } from './operational-summary.service';

describe('Operational summary controllers', () => {
  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-one',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: ['students:read', 'attendance:read'],
  };

  let service: jest.Mocked<
    Pick<
      OperationalSummaryService,
      'getDashboardSummary' | 'getModuleSummary' | 'getMobileSummary'
    >
  >;
  let dashboard: OperationalDashboardSummaryController;
  let mobile: OperationalMobileSummaryController;

  beforeEach(() => {
    service = {
      getDashboardSummary: jest.fn(),
      getModuleSummary: jest.fn(),
      getMobileSummary: jest.fn(),
    };
    dashboard = new OperationalDashboardSummaryController(
      service as unknown as OperationalSummaryService,
    );
    mobile = new OperationalMobileSummaryController(
      service as unknown as OperationalSummaryService,
    );
  });

  it('delegates the composed dashboard summary with the authenticated actor', async () => {
    service.getDashboardSummary.mockResolvedValue({ status: 'ready' } as never);

    await expect(dashboard.getDashboardSummary(actor)).resolves.toEqual({
      status: 'ready',
    });
    expect(service.getDashboardSummary).toHaveBeenCalledWith(actor);
  });

  it('maps route-aligned summary paths to their internal module summary keys', async () => {
    service.getModuleSummary.mockResolvedValue({
      module: 'm2_attendance',
    } as never);

    await expect(
      dashboard.getModuleSummary('attendance', actor),
    ).resolves.toEqual({
      module: 'm2_attendance',
    });
    expect(service.getModuleSummary).toHaveBeenCalledWith(
      'm2_attendance',
      actor,
    );
  });

  it('keeps the internal module key accepted for compatibility', async () => {
    service.getModuleSummary.mockResolvedValue({
      module: 'm12_learning',
    } as never);

    await dashboard.getModuleSummary('m12_learning', actor);

    expect(service.getModuleSummary).toHaveBeenCalledWith(
      'm12_learning',
      actor,
    );
  });

  it('rejects unknown module paths before dispatching to the service', () => {
    expect(() => dashboard.getModuleSummary('not-a-module', actor)).toThrow(
      'Unknown SchoolOS summary module.',
    );
    expect(service.getModuleSummary).not.toHaveBeenCalled();
  });

  it('delegates each mobile persona route to the purpose-limited summary service', async () => {
    service.getMobileSummary.mockResolvedValue({ status: 'ready' } as never);

    await mobile.parentSummary(actor);
    await mobile.teacherSummary(actor);
    await mobile.principalSummary(actor);
    await mobile.driverSummary(actor);
    await mobile.staffSummary(actor);

    expect(service.getMobileSummary).toHaveBeenNthCalledWith(
      1,
      'parent',
      actor,
    );
    expect(service.getMobileSummary).toHaveBeenNthCalledWith(
      2,
      'teacher',
      actor,
    );
    expect(service.getMobileSummary).toHaveBeenNthCalledWith(
      3,
      'principal',
      actor,
    );
    expect(service.getMobileSummary).toHaveBeenNthCalledWith(
      4,
      'driver',
      actor,
    );
    expect(service.getMobileSummary).toHaveBeenNthCalledWith(5, 'staff', actor);
    expect(service.getMobileSummary).toHaveBeenCalledTimes(5);
  });

  it('fails closed for broad student mobile summary', () => {
    expect(() => {
      mobile.studentSummary(actor);
    }).toThrow(
      'Student mobile access is limited to controlled learning sessions.',
    );
    expect(service.getMobileSummary).not.toHaveBeenCalled();
  });
});
