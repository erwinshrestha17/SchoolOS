import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let platformApiKeysService: any;

  beforeEach(() => {
    platformApiKeysService = {
      validateApiKey: jest.fn(),
    };
    guard = new ApiKeyAuthGuard(platformApiKeysService);
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
});

function mockExecutionContext(request: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}
