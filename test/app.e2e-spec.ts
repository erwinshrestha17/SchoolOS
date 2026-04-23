import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RolesController } from '../src/roles/roles.controller';
import { UsersController } from '../src/users/users.controller';

describe('School OS Auth + RBAC integration', () => {
  let moduleRef: TestingModule;
  let prisma: Awaited<ReturnType<typeof createPrismaMock>>;
  let authController: AuthController;
  let usersController: UsersController;
  let rolesController: RolesController;
  let jwtAuthGuard: JwtAuthGuard;
  let rolesGuard: RolesPermissionsGuard;

  beforeEach(async () => {
    prisma = await createPrismaMock();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    authController = moduleRef.get(AuthController);
    usersController = moduleRef.get(UsersController);
    rolesController = moduleRef.get(RolesController);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
    rolesGuard = moduleRef.get(RolesPermissionsGuard);
  });

  it('supports login, admin user creation, role assignment, tenant isolation, refresh, and logout', async () => {
    const adminResponse = createResponseMock();
    const adminLogin = await authController.login(
      {
        tenantSlug: 'school-a',
        email: 'admin@school-a.com',
        password: 'admin12345',
      },
      adminResponse as any,
      createRequestMock() as any,
    );

    expect(adminLogin.user.roles).toContain('admin');

    const adminRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      adminLogin.accessToken,
      RolesController.prototype.assignRoles,
      RolesController,
    );

    const createdUser = await usersController.createUser(
      {
        email: 'teacher@school-a.com',
        password: 'teacher12345',
        roleIds: [],
      },
      adminRequest.auth!,
    );

    expect(createdUser.email).toBe('teacher@school-a.com');

    const teacherRole = prisma.__state.roles.find(
      (role) => role.tenantId === 'tenant-a' && role.name === 'teacher',
    );
    expect(teacherRole).toBeDefined();

    const assignedRoles = await rolesController.assignRoles(
      {
        userId: createdUser.id,
        roleIds: [teacherRole!.id],
      },
      adminRequest.auth!,
    );

    expect(assignedRoles).toHaveLength(1);

    const teacherResponse = createResponseMock();
    const teacherLogin = await authController.login(
      {
        tenantSlug: 'school-a',
        email: 'teacher@school-a.com',
        password: 'teacher12345',
      },
      teacherResponse as any,
      createRequestMock() as any,
    );

    const teacherRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      teacherLogin.accessToken,
      RolesController.prototype.listRoles,
      RolesController,
    );

    const visibleRoles = await rolesController.listRoles(teacherRequest.auth!);
    expect(visibleRoles.some((role) => role.name === 'teacher')).toBe(true);

    const tenantBResponse = createResponseMock();
    const tenantBLogin = await authController.login(
      {
        tenantSlug: 'school-b',
        email: 'admin@school-b.com',
        password: 'admin12345',
      },
      tenantBResponse as any,
      createRequestMock() as any,
    );

    const tenantBRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      tenantBLogin.accessToken,
      RolesController.prototype.assignRoles,
      RolesController,
    );

    await expect(
      rolesController.assignRoles(
        {
          userId: createdUser.id,
          roleIds: [teacherRole!.id],
        },
        tenantBRequest.auth!,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const refreshResponse = createResponseMock();
    const refreshed = await authController.refresh(
      {},
      refreshResponse as any,
      buildCookieHeader(adminResponse.cookieCalls.at(-1)),
      createRequestMock() as any,
    );

    expect(refreshed.accessToken).toBeTruthy();

    const rotatedCookie = buildCookieHeader(refreshResponse.cookieCalls.at(-1));

    const logoutResponse = createResponseMock();
    const logoutResult = await authController.logout(
      {},
      logoutResponse as any,
      rotatedCookie,
      createRequestMock() as any,
    );

    expect(logoutResult).toEqual({ success: true });

    await expect(
      authController.refresh(
        {},
        createResponseMock() as any,
        rotatedCookie,
        createRequestMock() as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

async function authenticateRequest(
  jwtAuthGuard: JwtAuthGuard,
  rolesGuard: RolesPermissionsGuard,
  accessToken: string,
  handler: (...args: any[]) => unknown,
  controllerClass: new (...args: any[]) => unknown,
) {
  const request = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  } as any;

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as any;

  await jwtAuthGuard.canActivate(context);
  await rolesGuard.canActivate(context);

  return request;
}

function createRequestMock() {
  return {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'jest',
    },
  };
}

function createResponseMock() {
  return {
    cookieCalls: [] as Array<{ name: string; value: string }>,
    clearedCookies: [] as string[],
    cookie(name: string, value: string) {
      this.cookieCalls.push({ name, value });
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
    },
  };
}

function buildCookieHeader(cookie?: { name: string; value: string }) {
  return cookie ? `${cookie.name}=${cookie.value}` : undefined;
}

async function createPrismaMock() {
  const adminPasswordHash = await bcrypt.hash('admin12345', 4);
  const state = {
    tenants: [
      { id: 'tenant-a', slug: 'school-a', name: 'School A', isActive: true },
      { id: 'tenant-b', slug: 'school-b', name: 'School B', isActive: true },
    ],
    permissions: [
      {
        id: 'perm-users-create',
        resource: 'users',
        action: 'create',
        description: 'Create users',
      },
      {
        id: 'perm-roles-read',
        resource: 'roles',
        action: 'read',
        description: 'Read roles',
      },
      {
        id: 'perm-roles-create',
        resource: 'roles',
        action: 'create',
        description: 'Create roles',
      },
      {
        id: 'perm-roles-assign',
        resource: 'roles',
        action: 'assign',
        description: 'Assign roles',
      },
      {
        id: 'perm-roles-manage',
        resource: 'roles',
        action: 'manage_permissions',
        description: 'Manage permissions',
      },
    ],
    roles: [
      {
        id: 'role-admin-a',
        tenantId: 'tenant-a',
        name: 'admin',
        description: 'Admin',
        isSystem: true,
      },
      {
        id: 'role-teacher-a',
        tenantId: 'tenant-a',
        name: 'teacher',
        description: 'Teacher',
        isSystem: true,
      },
      {
        id: 'role-admin-b',
        tenantId: 'tenant-b',
        name: 'admin',
        description: 'Admin',
        isSystem: true,
      },
    ],
    rolePermissions: [
      { roleId: 'role-admin-a', permissionId: 'perm-users-create' },
      { roleId: 'role-admin-a', permissionId: 'perm-roles-read' },
      { roleId: 'role-admin-a', permissionId: 'perm-roles-create' },
      { roleId: 'role-admin-a', permissionId: 'perm-roles-assign' },
      { roleId: 'role-admin-a', permissionId: 'perm-roles-manage' },
      { roleId: 'role-teacher-a', permissionId: 'perm-roles-read' },
      { roleId: 'role-admin-b', permissionId: 'perm-users-create' },
      { roleId: 'role-admin-b', permissionId: 'perm-roles-read' },
      { roleId: 'role-admin-b', permissionId: 'perm-roles-create' },
      { roleId: 'role-admin-b', permissionId: 'perm-roles-assign' },
      { roleId: 'role-admin-b', permissionId: 'perm-roles-manage' },
    ],
    users: [
      {
        id: 'user-admin-a',
        tenantId: 'tenant-a',
        email: 'admin@school-a.com',
        phone: null,
        passwordHash: adminPasswordHash,
        authMethod: 'PASSWORD',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
      },
      {
        id: 'user-admin-b',
        tenantId: 'tenant-b',
        email: 'admin@school-b.com',
        phone: null,
        passwordHash: adminPasswordHash,
        authMethod: 'PASSWORD',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
      },
    ],
    userRoles: [
      {
        id: 'membership-admin-a',
        userId: 'user-admin-a',
        roleId: 'role-admin-a',
        tenantId: 'tenant-a',
        scopeId: null,
        assignedById: null,
        assignedAt: new Date(),
      },
      {
        id: 'membership-admin-b',
        userId: 'user-admin-b',
        roleId: 'role-admin-b',
        tenantId: 'tenant-b',
        scopeId: null,
        assignedById: null,
        assignedAt: new Date(),
      },
    ],
    refreshTokens: [] as any[],
    auditLogs: [] as any[],
  };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

  const roleWithRelations = (role: any) => ({
    ...role,
    rolePermissions: state.rolePermissions
      .filter((item) => item.roleId === role.id)
      .map((item) => ({
        ...item,
        permission: state.permissions.find(
          (permission) => permission.id === item.permissionId,
        )!,
      })),
  });

  const userWithRelations = (user: any) => ({
    ...user,
    userRoles: state.userRoles
      .filter((membership) => membership.userId === user.id)
      .map((membership) => ({
        ...membership,
        role: roleWithRelations(
          state.roles.find((role) => role.id === membership.roleId)!,
        ),
      })),
  });

  return {
    __state: state,
    tenant: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.slug) {
          return state.tenants.find((tenant) => tenant.slug === where.slug) ?? null;
        }

        if (where.id) {
          return state.tenants.find((tenant) => tenant.id === where.id) ?? null;
        }

        return null;
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.tenantId_email) {
          const match = state.users.find(
            (user) =>
              user.tenantId === where.tenantId_email.tenantId &&
              user.email === where.tenantId_email.email,
          );
          return match ? userWithRelations(match) : null;
        }

        if (where.id) {
          const match = state.users.find((user) => user.id === where.id);
          return match ? userWithRelations(match) : null;
        }

        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const match = state.users.find(
          (user) =>
            (!where.id || user.id === where.id) &&
            (!where.tenantId || user.tenantId === where.tenantId),
        );
        return match ?? null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = state.users.find((item) => item.id === where.id);
        if (!user) {
          throw new Error(`User ${where.id} not found`);
        }
        Object.assign(user, data);
        return user;
      }),
      create: jest.fn(async ({ data }: any) => {
        const user = {
          id: nextId('user'),
          tenantId: data.tenantId,
          email: data.email,
          phone: data.phone ?? null,
          passwordHash: data.passwordHash,
          authMethod: data.authMethod,
          status: data.status,
          lastLoginAt: null,
          createdAt: new Date(),
        };
        state.users.push(user);

        for (const membership of data.userRoles.create) {
          state.userRoles.push({
            id: nextId('membership'),
            userId: user.id,
            roleId: membership.roleId,
            tenantId: membership.tenantId,
            scopeId: null,
            assignedById: membership.assignedById ?? null,
            assignedAt: new Date(),
          });
        }

        return userWithRelations(user);
      }),
    },
    role: {
      findMany: jest.fn(async ({ where }: any = {}) => {
        const ids = where?.id?.in;
        return state.roles
          .filter(
            (role) =>
              (!where?.tenantId || role.tenantId === where.tenantId) &&
              (!ids || ids.includes(role.id)),
          )
          .map((role) => roleWithRelations(role));
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.tenantId_name) {
          const match = state.roles.find(
            (role) =>
              role.tenantId === where.tenantId_name.tenantId &&
              role.name === where.tenantId_name.name,
          );
          return match ? roleWithRelations(match) : null;
        }

        if (where.id) {
          const match = state.roles.find((role) => role.id === where.id);
          return match ? roleWithRelations(match) : null;
        }

        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const match = state.roles.find(
          (role) =>
            (!where.id || role.id === where.id) &&
            (!where.tenantId || role.tenantId === where.tenantId),
        );
        return match ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const role = {
          id: nextId('role'),
          tenantId: data.tenantId,
          name: data.name,
          description: data.description ?? null,
          isSystem: false,
        };
        state.roles.push(role);
        return role;
      }),
    },
    permission: {
      findMany: jest.fn(async ({ where }: any = {}) => {
        if (!where?.id?.in) {
          return [...state.permissions];
        }

        return state.permissions.filter((permission) =>
          where.id.in.includes(permission.id),
        );
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.resource_action) {
          return (
            state.permissions.find(
              (permission) =>
                permission.resource === where.resource_action.resource &&
                permission.action === where.resource_action.action,
            ) ?? null
          );
        }

        return null;
      }),
    },
    rolePermission: {
      deleteMany: jest.fn(async ({ where }: any) => {
        state.rolePermissions = state.rolePermissions.filter(
          (item) => item.roleId !== where.roleId,
        );
        return { count: 1 };
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const item of data) {
          state.rolePermissions.push(item);
        }
        return { count: data.length };
      }),
      create: jest.fn(async ({ data }: any) => {
        state.rolePermissions.push(data);
        return data;
      }),
    },
    userRole: {
      findMany: jest.fn(async ({ where }: any) =>
        state.userRoles
          .filter(
            (membership) =>
              membership.userId === where.userId &&
              membership.tenantId === where.tenantId,
          )
          .map((membership) => ({
            ...membership,
            role: roleWithRelations(
              state.roles.find((role) => role.id === membership.roleId)!,
            ),
          })),
      ),
      deleteMany: jest.fn(async ({ where }: any) => {
        state.userRoles = state.userRoles.filter(
          (membership) =>
            !(
              membership.userId === where.userId &&
              membership.tenantId === where.tenantId
            ),
        );
        return { count: 1 };
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const membership of data) {
          state.userRoles.push({
            id: nextId('membership'),
            scopeId: null,
            assignedAt: new Date(),
            ...membership,
          });
        }
        return { count: data.length };
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        const token = {
          id: nextId('session'),
          userId: data.userId,
          tokenHash: data.tokenHash,
          deviceId: data.deviceId ?? null,
          expiresAt: data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        state.refreshTokens.push(token);
        return token;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const match = state.refreshTokens.find(
          (token) => token.tokenHash === where.tokenHash,
        );

        if (!match) {
          return null;
        }

        return {
          ...match,
          user: userWithRelations(
            state.users.find((user) => user.id === match.userId)!,
          ),
        };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const token = state.refreshTokens.find((item) => item.id === where.id);
        if (!token) {
          throw new Error(`Refresh token ${where.id} not found`);
        }
        Object.assign(token, data);
        return token;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of state.refreshTokens) {
          if (
            token.tokenHash === where.tokenHash &&
            token.revokedAt === where.revokedAt
          ) {
            Object.assign(token, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        state.auditLogs.push(data);
        return data;
      }),
    },
  };
}
