import { AuthMethod } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { systemRolePermissions } from '@schoolos/core';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';

describe('Principal write-route denial (PPR-P0-03 seed)', () => {
  let guard: RolesPermissionsGuard;
  let reflector: Reflector;
  let request: {
    auth: {
      userId: string;
      tenantId: string;
      tenantSlug: string;
      email: string;
      authMethod: AuthMethod;
      roles: string[];
      permissions: string[];
    };
  };
  let context: any;

  const principalPermissions = systemRolePermissions.principal;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new RolesPermissionsGuard(reflector);
    request = {
      auth: {
        userId: 'principal-1',
        tenantId: 'tenant-1',
        tenantSlug: 'school-a',
        email: 'principal@school.test',
        authMethod: AuthMethod.PASSWORD,
        roles: ['principal'],
        permissions: [...principalPermissions],
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

  async function expectDenied(requiredPermissions: string[]) {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(requiredPermissions);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  }

  async function expectAllowed(requiredPermissions: string[]) {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(requiredPermissions);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  }

  it('denies student create and lifecycle writes', async () => {
    await expectDenied(['students:create']);
    await expectDenied(['students:manage_lifecycle']);
  });

  it('denies attendance marking and staff creation', async () => {
    await expectDenied(['attendance:mark']);
    await expectDenied(['staff:create']);
  });

  it('denies marks entry and journal creation', async () => {
    await expectDenied(['academics:enter_marks']);
    await expectDenied(['accounting:journals:create']);
  });

  it('allows principal-safe reads and designated approvals', async () => {
    await expectAllowed(['students:read']);
    await expectAllowed(['attendance:read']);
    await expectAllowed(['notices:approve']);
    await expectAllowed(['marks:review_lock']);
    await expectAllowed(['results:publish']);
    await expectAllowed(['advanced:approvals:decide']);
  });
});
