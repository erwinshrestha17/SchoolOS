import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesPermissionsGuard } from './roles-permissions.guard';

describe('RolesPermissionsGuard', () => {
  let guard: RolesPermissionsGuard;
  let reflector: Reflector;
  let prisma: any;
  let request: any;
  let context: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    prisma = {
      userRole: {
        findMany: jest.fn(),
      },
    };
    guard = new RolesPermissionsGuard(reflector, prisma);
    request = {
      auth: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'school-a',
        email: 'admin@school.com',
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
    prisma.userRole.findMany.mockResolvedValue([
      {
        role: {
          name: 'admin',
          rolePermissions: [
            {
              permission: { resource: 'users', action: 'create' },
            },
          ],
        },
      },
    ]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.auth.roles).toEqual(['admin']);
    expect(request.auth.permissions).toEqual(['users:create']);
  });

  it('denies access when required permission is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['roles:assign']);
    prisma.userRole.findMany.mockResolvedValue([
      {
        role: {
          name: 'teacher',
          rolePermissions: [
            {
              permission: { resource: 'roles', action: 'read' },
            },
          ],
        },
      },
    ]);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('scopes role lookups to the authenticated tenant', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['admin'])
      .mockReturnValueOnce([]);
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.userRole.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        tenantId: 'tenant-1',
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  });
});
