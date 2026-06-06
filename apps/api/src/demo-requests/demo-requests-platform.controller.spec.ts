import { UnauthorizedException } from '@nestjs/common';
import { DemoRequestsPlatformController } from './demo-requests-platform.controller';
import { DemoRequestsService } from './demo-requests.service';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';

describe('DemoRequestsPlatformController', () => {
  const service = {
    listPage: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const controller = new DemoRequestsPlatformController(
    service as unknown as DemoRequestsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists demo requests through the platform service', async () => {
    service.listPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
    });

    await controller.listPage({ page: 1, limit: 25 });

    expect(service.listPage).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('requires auth context for status updates', () => {
    expect(() =>
      controller.updateStatus('demo-request-1', { status: 'CONTACTED' }, {
        auth: undefined,
      } as AuthenticatedRequest),
    ).toThrow(UnauthorizedException);
  });

  it('delegates status updates with the authenticated platform user', async () => {
    service.updateStatus.mockResolvedValue({
      id: 'demo-request-1',
      status: 'CONTACTED',
    });

    await controller.updateStatus(
      'demo-request-1',
      { status: 'CONTACTED', internalNotes: 'Called' },
      {
        auth: {
          userId: 'platform-user-1',
          tenantId: 'platform',
        },
      } as AuthenticatedRequest,
    );

    expect(service.updateStatus).toHaveBeenCalledWith(
      'demo-request-1',
      { status: 'CONTACTED', internalNotes: 'Called' },
      'platform-user-1',
    );
  });
});
