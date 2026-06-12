import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, TENANT_ID_KEY } from './prisma.service';
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
      return {
        student: {
          findMany: jest.fn().mockImplementation(async (args) => {
            const allOperations = extension.query?.$allModels?.$allOperations;
            if (allOperations) {
              return allOperations({
                model: 'Student',
                operation: 'findMany',
                args,
                query: async (finalArgs) => {
                  return { success: true, args: finalArgs };
                },
              });
            }
            return { success: true, args };
          }),
        },
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

  it('should delegate queries without injecting tenantId if tenantId is not set in CLS', async () => {
    // 1. Simulate no tenantId in CLS mock
    jest.spyOn(clsService, 'get').mockReturnValue(undefined);

    // 2. Call findMany on the proxy delegate
    const result = (await service.student.findMany({
      where: { firstNameEn: 'Student' },
    })) as any;

    // 3. Verify that the query was NOT modified with tenantId
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.args).toEqual({
      where: {
        firstNameEn: 'Student',
      },
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
