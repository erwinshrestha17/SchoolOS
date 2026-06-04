import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import { SettingsController } from './settings.controller';

describe('SettingsController audit logs', () => {
  it('lists audit logs using the authenticated tenant context', async () => {
    const settingsService = {
      listTenantAuditLogs: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new SettingsController(
      settingsService as never,
      {} as never,
    );

    await controller.listTenantAuditLogs(
      {
        auth: {
          tenantId: 'tenant-1',
          userId: 'user-1',
        },
      } as AuthenticatedRequest,
      '2',
      '10',
      'setting_updated',
      'settings',
    );

    expect(settingsService.listTenantAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        page: '2',
        limit: '10',
        action: 'setting_updated',
        resource: 'settings',
      }),
    );
  });

  it('rejects audit log access without authentication context', async () => {
    const controller = new SettingsController({} as never, {} as never);

    await expect(
      controller.listTenantAuditLogs({} as AuthenticatedRequest),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
