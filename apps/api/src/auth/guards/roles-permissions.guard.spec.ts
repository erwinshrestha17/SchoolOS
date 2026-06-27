import { AuthMethod } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesPermissionsGuard } from './roles-permissions.guard';

describe('RolesPermissionsGuard', () => {
  let guard: RolesPermissionsGuard;
  let reflector: Reflector;
  let request: any;
  let context: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new RolesPermissionsGuard(reflector);
    request = {
      auth: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'school-a',
        email: 'admin@school.com',
        authMethod: AuthMethod.PASSWORD,
        roles: [],
        permissions: [],
      },
    };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
  });

  it('grants access when role and permission requirements are satisfied', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['admin'])
      .mockReturnValueOnce(['users:create']);
    request.auth.roles = ['admin'];
    request.auth.permissions = ['users:create'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.auth.roles).toEqual(['admin']);
    expect(request.auth.permissions).toEqual(['users:create']);
  });

  it('denies access when required permission is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['roles:assign']);
    request.auth.roles = ['teacher'];
    request.auth.permissions = ['roles:read'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts payroll manage as the compatibility alias for payslip generation', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['payroll:payslip:generate']);
    request.auth.permissions = ['payroll:manage'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
