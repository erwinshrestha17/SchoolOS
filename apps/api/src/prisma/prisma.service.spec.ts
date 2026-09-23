import { Test, TestingModule } from '@nestjs/testing';
import {
  applyTenantScopeToArgs,
  assertRawTenantScope,
  MissingTenantScopeError,
  PrismaService,
  TENANT_ID_KEY,
} from './prisma.service';
import { ClsService } from 'nestjs-cls';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

function queryProbe(value: unknown): { success: boolean; args: unknown } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('success' in value) ||
    typeof value.success !== 'boolean' ||
    !('args' in value)
  ) {
    throw new Error('Prisma query interceptor did not return its probe result');
  }
  return { success: value.success, args: value.args };
}

// Mock the PrismaClient from @prisma/client
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    // Keep track of connection calls
    $connect = mockConnect;
    $disconnect = mockDisconnect;

    // Mock $extends to simulate the query interceptor execution
    $extends = jest.fn().mockImplementation((extension) => {
      const modelDelegate = (model: string) => ({
        findMany: jest.fn().mockImplementation(async (args) => {
          const allOperations = extension.query?.$allModels?.$allOperations;
          if (allOperations) {
            return allOperations({
              model,
              operation: 'findMany',
              args,
              query: async (finalArgs) => {
                return { success: true, args: finalArgs };
              },
            });
          }
          return { success: true, args };
        }),
      });

      return {
        student: modelDelegate('Student'),
        // Tenant is in TENANT_SCOPE_EXCLUDED_MODELS, so it must stay reachable
        // without a tenant context.
        tenant: modelDelegate('Tenant'),
      };
    });
  }

  return {
    PrismaClient: MockPrismaClient,
  };
});

describe('PrismaService', () => {
  let service: PrismaService;
  let clsService: ClsService;

  beforeEach(async () => {
    const mockClsService = {
      get: jest.fn(),
      set: jest.fn(),
      isActive: jest.fn().mockReturnValue(true),
      run: jest.fn(async (fn: () => unknown) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ClsService,
          useValue: mockClsService,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    clsService = module.get<ClsService>(ClsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate queries to the extended client and apply tenant isolation when tenantId is set', async () => {
    // 1. Set tenantId in CLS mock
    jest
      .spyOn(clsService, 'get')
      .mockImplementation((key?: string | symbol) =>
        key === TENANT_ID_KEY ? 'tenant-test-123' : undefined,
      );

    // 2. Call findMany on the proxy delegate
    const result = queryProbe(
      await service.student.findMany({
        where: { firstNameEn: 'Student' },
      }),
    );

    // 3. Verify that the query was intercepted and tenantId was injected
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.args).toEqual({
      where: {
        firstNameEn: 'Student',
        tenantId: 'tenant-test-123',
      },
    });
  });

  it('should refuse tenant-scoped queries when tenantId is not set in CLS', async () => {
    // Fail closed: previously this delegated the query unscoped, so any entry
    // point that forgot to populate CLS silently read across every tenant.
    jest.spyOn(clsService, 'get').mockReturnValue(undefined);

    await expect(
      service.student.findMany({ where: { firstNameEn: 'Student' } }),
    ).rejects.toThrow(MissingTenantScopeError);
  });

  it('should still delegate excluded global models without a tenant context', async () => {
    jest.spyOn(clsService, 'get').mockReturnValue(undefined);

    const result = queryProbe(
      await service.tenant.findMany({
        where: { slug: 'green-valley' },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.args).toEqual({ where: { slug: 'green-valley' } });
  });

  it('should allow an explicit cross-tenant region via runWithoutTenantScope', async () => {
    const store = new Map<string, unknown>();
    jest
      .spyOn(clsService, 'get')
      .mockImplementation((key?: string | symbol) => store.get(String(key)));
    jest
      .spyOn(clsService, 'set')
      .mockImplementation((key: string | symbol, value: unknown) => {
        store.set(String(key), value);
      });
    jest.spyOn(clsService, 'isActive').mockReturnValue(true);

    const result = queryProbe(
      await service.runWithoutTenantScope('spec sweep', () =>
        service.student.findMany({ where: { firstNameEn: 'Student' } }),
      ),
    );

    expect(result.success).toBe(true);
    expect(result.args).toEqual({ where: { firstNameEn: 'Student' } });

    // and the bypass is confined to that region
    await expect(
      service.student.findMany({ where: { firstNameEn: 'Student' } }),
    ).rejects.toThrow(MissingTenantScopeError);
  });

  it('should preserve explicit predicates in a bypass region even when CLS already has a tenant', async () => {
    const store = new Map<string, unknown>([
      [TENANT_ID_KEY, 'platform-tenant'],
    ]);
    jest
      .spyOn(clsService, 'get')
      .mockImplementation((key?: string | symbol) => store.get(String(key)));
    jest
      .spyOn(clsService, 'set')
      .mockImplementation((key: string | symbol, value: unknown) => {
        store.set(String(key), value);
      });
    jest.spyOn(clsService, 'isActive').mockReturnValue(true);

    const result = queryProbe(
      await service.runWithoutTenantScope(
        'support override target lookup',
        () =>
          service.student.findMany({
            where: { tenantId: 'school-tenant', firstNameEn: 'Student' },
          }),
      ),
    );

    expect(result.success).toBe(true);
    expect(result.args).toEqual({
      where: { tenantId: 'school-tenant', firstNameEn: 'Student' },
    });
    expect(store.get(TENANT_ID_KEY)).toBe('platform-tenant');

    const scopedResult = queryProbe(
      await service.student.findMany({
        where: { firstNameEn: 'Student' },
      }),
    );
    expect(scopedResult.args).toEqual({
      where: { firstNameEn: 'Student', tenantId: 'platform-tenant' },
    });
  });

  it('should delegate lifecycle methods to the native PrismaClient instance', async () => {
    // Call native methods
    await service.onModuleInit();
    await service.onModuleDestroy();

    // Verify that the superclass ($connect / $disconnect) was invoked
    expect(mockConnect).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

describe('applyTenantScopeToArgs', () => {
  const tenantId = 'tenant-a';

  it.each([
    'findUniqueOrThrow',
    'findFirstOrThrow',
    'aggregate',
    'groupBy',
    'updateManyAndReturn',
  ])('scopes %s by tenant', (operation) => {
    const args = applyTenantScopeToArgs(
      'Student',
      operation,
      { where: { status: 'ACTIVE', tenantId: 'tenant-b' } },
      tenantId,
    );

    expect(args).toMatchObject({
      where: { status: 'ACTIVE', tenantId },
    });
  });

  it('forces tenant identity across every upsert branch', () => {
    const args = applyTenantScopeToArgs(
      'NotificationPreference',
      'upsert',
      {
        where: { id: 'preference-1', tenantId: 'tenant-b' },
        create: { id: 'preference-1', tenantId: 'tenant-b' },
        update: { enabled: true, tenantId: 'tenant-b' },
      },
      tenantId,
    );

    expect(args).toEqual({
      where: { id: 'preference-1', tenantId },
      create: { id: 'preference-1', tenantId },
      update: { enabled: true, tenantId },
    });
  });

  it('prevents update data from moving a row to another tenant', () => {
    const args = applyTenantScopeToArgs(
      'Student',
      'update',
      {
        where: { id: 'student-1' },
        data: { firstNameEn: 'Asha', tenantId: 'tenant-b' },
      },
      tenantId,
    );

    expect(args).toEqual({
      where: { id: 'student-1', tenantId },
      data: { firstNameEn: 'Asha', tenantId },
    });
  });

  it('fails closed for a future model operation without a reviewed strategy', () => {
    expect(() =>
      applyTenantScopeToArgs('Student', 'futureOperation', {}, tenantId),
    ).toThrow(/Unsupported tenant-scoped Prisma operation/);
  });
});

describe('assertRawTenantScope', () => {
  it('fails closed when raw SQL has neither tenant context nor an explicit bypass', () => {
    expect(() => {
      assertRawTenantScope('$queryRaw');
    }).toThrow(MissingTenantScopeError);
  });

  it('allows tenant-scoped and explicitly reviewed cross-tenant raw SQL', () => {
    expect(() => {
      assertRawTenantScope('$queryRaw', 'tenant-a');
    }).not.toThrow();
    expect(() => {
      assertRawTenantScope('$executeRaw', undefined, true);
    }).not.toThrow();
  });
});
