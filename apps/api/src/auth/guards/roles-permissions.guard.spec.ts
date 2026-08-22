import { AuthMethod, SecurityDomain } from '@prisma/client';
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
        securityDomain: SecurityDomain.SCHOOL,
        isSupportOverride: false,
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

  it('denies ambient platform identities on school routes', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['students:read']);
    request.auth.securityDomain = SecurityDomain.PLATFORM;
    request.auth.isSupportOverride = false;
    request.auth.roles = ['platform_super_admin'];
    request.auth.permissions = ['students:read'];

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Platform identities require an active support override on school routes',
      ),
    );
  });

  it('allows a scoped support override only through an explicit matching permission', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['students:read']);
    request.auth.securityDomain = SecurityDomain.PLATFORM;
    request.auth.isSupportOverride = true;
    request.auth.supportOverrideReadOnly = true;
    request.auth.supportOverrideScopes = ['STUDENT_RECORDS'];
    request.auth.roles = [];
    request.auth.permissions = ['students:read'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not expand permission aliases for a support override', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['advanced:approvals:read']);
    request.auth.securityDomain = SecurityDomain.PLATFORM;
    request.auth.isSupportOverride = true;
    request.auth.supportOverrideReadOnly = true;
    request.auth.supportOverrideScopes = ['SCHOOL_PROFILE'];
    request.auth.roles = [];
    request.auth.permissions = ['settings:read'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('retains permission alias semantics for ordinary school sessions', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['advanced:approvals:read']);
    request.auth.permissions = ['settings:read'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not let a support override satisfy a role-gated school route', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['admin'])
      .mockReturnValueOnce([]);
    request.auth.securityDomain = SecurityDomain.PLATFORM;
    request.auth.isSupportOverride = true;
    request.auth.supportOverrideReadOnly = true;
    request.auth.supportOverrideScopes = ['SCHOOL_PROFILE'];
    request.auth.roles = ['admin'];

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Support override requires an explicitly permissioned read route',
      ),
    );
  });

  it('denies a support override on school routes without explicit authorization metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    request.auth.securityDomain = SecurityDomain.PLATFORM;
    request.auth.isSupportOverride = true;
    request.auth.supportOverrideReadOnly = true;
    request.auth.supportOverrideScopes = ['SCHOOL_PROFILE'];
    request.auth.roles = [];
    request.auth.permissions = ['settings:read'];

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Support override requires an explicitly permissioned read route',
      ),
    );
  });

  it('does not give a platform_super_admin role a school permission bypass', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['students:read']);
    request.auth.roles = ['platform_super_admin'];
    request.auth.permissions = [];

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

  it('does not let accounting:close alone unlock chart-of-accounts write', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['accounting:accounts:write']);
    request.auth.permissions = ['accounting:close'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not let accounting:close alone unlock fiscal year management', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['accounting:fiscal:manage']);
    request.auth.permissions = ['accounting:close'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not let accounting:close alone unlock accounting exports', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['accounting:exports:create']);
    request.auth.permissions = ['accounting:close'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('still accepts the generic reports:export alias for accounting exports', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['accounting:exports:create']);
    request.auth.permissions = ['reports:export'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets notices:read satisfy the self-scoped notification-preference gate', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['notifications:manage_preferences']);
    request.auth.permissions = ['notices:read'];

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not let notices:read alone unlock guardian consent management', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['consents:manage']);
    request.auth.permissions = ['notices:read'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not let notices:read alone unlock consent-template management', async () => {
    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['communications:manage_consent']);
    request.auth.permissions = ['notices:read'];

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not let notices:create alone unlock notices:approve or notices:send_emergency', async () => {
    request.auth.permissions = ['notices:create'];

    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['notices:approve']);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    (reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce(['notices:send_emergency']);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
