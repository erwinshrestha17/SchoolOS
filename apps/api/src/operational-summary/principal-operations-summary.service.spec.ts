import type { AuthContext } from '../auth/auth.types';
import type { EntitlementsService } from '../plans/entitlements.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PrincipalOperationsSummaryService } from './principal-operations-summary.service';

describe('PrincipalOperationsSummaryService', () => {
  const tenantId = 'tenant-principal-test';

  function build(options?: { modules?: string[]; failLibrary?: boolean }) {
    const modules = options?.modules ?? ['library', 'transport', 'canteen'];
    const libraryIssueCount = jest
      .fn()
      .mockImplementation(() =>
        options?.failLibrary
          ? Promise.reject(new Error('library unavailable'))
          : Promise.resolve(2),
      );
    const prisma = {
      libraryIssue: { count: libraryIssueCount },
      libraryCopy: { count: jest.fn().mockResolvedValue(1) },
      transportTrip: { count: jest.fn().mockResolvedValue(1) },
      transportVehicle: { count: jest.fn().mockResolvedValue(1) },
      canteenPosSale: {
        count: jest.fn().mockResolvedValue(3),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: { toString: () => '1250.50' } },
        }),
      },
      canteenMealServing: { count: jest.fn().mockResolvedValue(4) },
      canteenInventoryItem: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const entitlements = {
      getEntitlements: jest.fn().mockResolvedValue({ modules }),
    } as unknown as EntitlementsService;
    return {
      prisma,
      entitlements,
      libraryIssueCount,
      service: new PrincipalOperationsSummaryService(prisma, entitlements),
    };
  }

  const actor = { tenantId } as AuthContext;

  it('scopes every operations metric to the Principal tenant', async () => {
    const { service, prisma } = build();
    const result = await service.getSummary(actor);

    expect(result.modules.library.status).toBe('ready');
    expect(result.modules.transport.status).toBe('ready');
    expect(result.modules.canteen.status).toBe('ready');

    const delegates = [
      prisma.libraryIssue.count,
      prisma.libraryCopy.count,
      prisma.transportTrip.count,
      prisma.transportVehicle.count,
      prisma.canteenPosSale.count,
      prisma.canteenMealServing.count,
      prisma.canteenInventoryItem.count,
      prisma.canteenPosSale.aggregate,
    ];
    for (const delegate of delegates) {
      for (const [args] of (delegate as jest.Mock).mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({ tenantId }));
      }
    }
  });

  it('returns locked states without reading disabled module records', async () => {
    const { service, prisma } = build({ modules: [] });
    const result = await service.getSummary(actor);

    expect(result.modules.library.status).toBe('locked');
    expect(result.modules.transport.status).toBe('locked');
    expect(result.modules.canteen.status).toBe('locked');
    expect(prisma.libraryIssue.count).not.toHaveBeenCalled();
    expect(prisma.transportTrip.count).not.toHaveBeenCalled();
    expect(prisma.canteenPosSale.count).not.toHaveBeenCalled();
  });

  it('marks a module partial instead of inventing zero when a metric fails', async () => {
    const { service } = build({ modules: ['library'], failLibrary: true });
    const result = await service.getSummary(actor);

    expect(result.modules.library.status).toBe('partial');
    expect(result.modules.library.metrics.activeLoans).toBeNull();
    expect(result.modules.transport.status).toBe('locked');
    expect(result.modules.canteen.status).toBe('locked');
  });
});
