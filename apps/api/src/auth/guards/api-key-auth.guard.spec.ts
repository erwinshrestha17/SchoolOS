import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let platformApiKeysService: any;
  let cls: any;

  beforeEach(() => {
    platformApiKeysService = {
      validateApiKey: jest.fn(),
    };
    cls = {
      isActive: jest.fn().mockReturnValue(true),
      set: jest.fn(),
    };
    guard = new ApiKeyAuthGuard(platformApiKeysService, cls);
  });

  it('throws UnauthorizedException if no API key is provided', async () => {
    const context = mockExecutionContext({
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'API key is required',
    );
  });

  it('throws UnauthorizedException if key is invalid', async () => {
    const context = mockExecutionContext({
      headers: {
        'x-api-key': 'sk_schoolos_invalid',
      },
    });
    platformApiKeysService.validateApiKey.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('successfully authorizes request and populates request.auth with scopes', async () => {
    const request = {
      headers: {
        authorization: 'Bearer sk_schoolos_mykey',
      },
      auth: null as any,
    };
    const context = mockExecutionContext(request);
    platformApiKeysService.validateApiKey.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      scopes: ['students:read'],
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.auth).toEqual(
      expect.objectContaining({
        userId: 'api-key-integration',
        tenantId: 'tenant-1',
        permissions: ['students:read'],
      }),
    );
  });

  it('binds the tenant into CLS so Prisma tenant scoping applies', async () => {
    const request = {
      headers: { authorization: 'Bearer sk_schoolos_mykey' },
      auth: null as any,
    };
    platformApiKeysService.validateApiKey.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      scopes: ['students:read'],
    });

    await guard.canActivate(mockExecutionContext(request));

    // Without this, PrismaService's tenant-scoping extension reads `undefined`
    // from CLS and leaves query args unscoped -- every query on an API-key
    // request would then span all tenants.
    expect(cls.set).toHaveBeenCalledWith('tenantId', 'tenant-1');
  });

  it('does not attempt to bind the tenant when no CLS context is active', async () => {
    cls.isActive.mockReturnValue(false);
    const request = {
      headers: { authorization: 'Bearer sk_schoolos_mykey' },
      auth: null as any,
    };
    platformApiKeysService.validateApiKey.mockResolvedValue({
      id: 'key-1',
      tenantId: 'tenant-1',
      scopes: ['students:read'],
    });

    await expect(
      guard.canActivate(mockExecutionContext(request)),
    ).resolves.toBe(true);
    expect(cls.set).not.toHaveBeenCalled();
  });
});

function mockExecutionContext(request: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
