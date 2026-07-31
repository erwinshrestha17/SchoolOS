import { Test, TestingModule } from '@nestjs/testing';
import {
  MissingTenantScopeError,
  PrismaService,
  TENANT_ID_KEY,
} from './prisma.service';
import { ClsService } from 'nestjs-cls';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

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
    jest.spyOn(clsService, 'get').mockReturnValue('tenant-test-123');

    // 2. Call findMany on the proxy delegate
    const result = (await service.student.findMany({
      where: { firstNameEn: 'Student' },
    })) as any;

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

    const result = (await service.tenant.findMany({
      where: { slug: 'green-valley' },
    })) as any;

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

    const result = (await service.runWithoutTenantScope('spec sweep', () =>
      service.student.findMany({ where: { firstNameEn: 'Student' } }),
    )) as any;

    expect(result.success).toBe(true);
    expect(result.args).toEqual({ where: { firstNameEn: 'Student' } });

    // and the bypass is confined to that region
    await expect(
      service.student.findMany({ where: { firstNameEn: 'Student' } }),
    ).rejects.toThrow(MissingTenantScopeError);
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
