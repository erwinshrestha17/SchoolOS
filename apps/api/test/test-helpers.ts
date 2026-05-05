/**
 * Test helper types and utilities for SchoolOS E2E tests
 */

export interface MockState {
  tenants: Record<string, any>[];
  permissions: Record<string, any>[];
  roles: Record<string, any>[];
  rolePermissions: Record<string, any>[];
  users: Record<string, any>[];
  userRoles: Record<string, any>[];
  classes: Record<string, any>[];
  students: Record<string, any>[];
  staff: Record<string, any>[];
  staffLeaveBalances: Record<string, any>[];
  academicYears: Record<string, any>[];
  chartAccounts: Record<string, any>[];
  feeHeads: Record<string, any>[];
  otpCodes: Record<string, any>[];
  refreshTokens: Record<string, any>[];
  auditLogs: Record<string, any>[];
  [key: string]: Record<string, any>[];
}

export interface PrismaMock {
  __state: MockState;
  [key: string]: unknown;
}

export interface RequestMock {
  ip: string;
  headers: Record<string, string>;
}

export interface ResponseMock {
  cookieCalls: { name: string; value: string }[];
  clearedCookies: string[];
  cookie(name: string, value: string): void;
  clearCookie(name: string): void;
}

export function createRequestMock(): RequestMock {
  return {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'jest',
    },
  };
}

export function createResponseMock(): ResponseMock {
  const cookieCalls: { name: string; value: string }[] = [];
  const clearedCookies: string[] = [];

  return {
    cookieCalls,
    clearedCookies,
    cookie(name: string, value: string) {
      cookieCalls.push({ name, value });
    },
    clearCookie(name: string) {
      clearedCookies.push(name);
    },
  };
}

export function buildCookieHeader(
  cookies: { name: string; value: string }[],
  name: string,
): string | undefined {
  const cookie = cookies.find((item) => item.name === name);

  return cookie ? `${cookie.name}=${cookie.value}` : undefined;
}

export function createQueueMock(): Record<string, unknown> {
  return {
    add: jest.fn(async () => ({ id: 'job-1' })),
    close: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

export function applyMockUpdate(
  target: Record<string, unknown>,
  update: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(update)) {
    if (
      value &&
      typeof value === 'object' &&
      'increment' in value &&
      typeof value.increment !== 'undefined'
    ) {
      target[key] = Number(target[key] ?? 0) + Number(value.increment);
      continue;
    }

    target[key] = value;
  }
}

import { AuthMethod } from '@prisma/client';
import { AuthContext } from '../src/auth/auth.types';

export function createAuthContextMock(
  overrides: Partial<AuthContext> = {},
): AuthContext {
  return {
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    tenantSlug: 'test-tenant-slug',
    email: 'test@example.com',
    authMethod: AuthMethod.PASSWORD,
    roles: [],
    permissions: [],
    ...overrides,
  };
}

import * as bcrypt from 'bcrypt';
import { PERMISSION_CATALOG, SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLE_PERMISSIONS, buildPermissionKey } from '../src/rbac/rbac.defaults';

export function createPrismaMock() {
  const state: MockState = {
    tenants: [
      {
        id: 'tenant-default',
        slug: 'default-school',
        name: 'Default School',
        plan: 'standard',
        mode: 'MULTI',
        isActive: true,
        createdAt: new Date(),
      },
    ],
    permissions: PERMISSION_CATALOG.map((permission, index) => ({
      id: `perm-${index + 1}`,
      ...permission,
    })),
    roles: [] as Record<string, any>[],
    rolePermissions: [] as Record<string, any>[],
    users: [] as Record<string, any>[],
    userRoles: [] as Record<string, any>[],
    classes: [] as Record<string, any>[],
    students: [] as Record<string, any>[],
    staff: [] as Record<string, any>[],
    staffLeaveBalances: [] as Record<string, any>[],
    academicYears: [] as Record<string, any>[],
    chartAccounts: [] as Record<string, any>[],
    feeHeads: [] as Record<string, any>[],
    otpCodes: [] as Record<string, any>[],
    refreshTokens: [] as Record<string, any>[],
    auditLogs: [] as Record<string, any>[],
  };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${String(idCounter++)}`;

  function permissionByKey(permissionKey: string) {
    return state.permissions.find(
      (permission) =>
        buildPermissionKey(permission.resource as string, permission.action as string) ===
        permissionKey,
    );
  }

  function ensureTenantDefaults(tenantId: string) {
    ensureTenantDefaultsWithState(state, tenantId);
  }

  ensureTenantDefaults('tenant-default');

  return {
    __state: state,
    tenant: {
      findUnique: jest.fn(async (q: any) =>
        state.tenants.find(
          (tenant) => tenant.id === q.where?.id || tenant.slug === q.where?.slug,
        ),
      ),
      findFirst: jest.fn(async (q: any) =>
        state.tenants.find(
          (tenant) => tenant.id === q.where?.id || tenant.slug === q.where?.slug,
        ),
      ),
      create: jest.fn(async ({ data }: any) => {
        const tenant = {
          id: nextId('tenant'),
          ...data,
          createdAt: new Date(),
        };
        state.tenants.push(tenant);
        ensureTenantDefaults(tenant.id);
        return tenant;
      }),
    },
    user: {
      findUnique: jest.fn(async (q: any) => {
        const user = state.users.find(
          (user) =>
            (user.tenantId === q.where?.tenantId_email?.tenantId &&
              user.email === q.where?.tenantId_email?.email) ||
            user.id === q.where?.id,
        );
        if (!user) return null;
        return {
          ...user,
          userRoles: state.userRoles
            .filter((item) => item.userId === user.id)
            .map((item) => ({
              ...item,
              role: state.roles.find((r) => r.id === item.roleId),
            })),
        };
      }),
      findFirst: jest.fn(async (q: any) => {
        const user = state.users.find(
          (user) =>
            (user.tenantId === q.where?.tenantId_email?.tenantId &&
              user.email === q.where?.tenantId_email?.email) ||
            user.id === q.where?.id,
        );
        return user;
      }),
      create: jest.fn(async ({ data }: any) => {
        const user = {
          id: nextId('user'),
          ...data,
          createdAt: new Date(),
        };
        state.users.push(user);
        return user;
      }),
      update: jest.fn(async (q: any) => {
        const user = state.users.find((u) => u.id === q.where?.id);
        if (user) {
          Object.assign(user, q.data);
        }
        return user;
      }),
    },
    role: {
      findMany: jest.fn(async (q: any) =>
        state.roles.filter((role) => role.tenantId === q.where?.tenantId),
      ),
    },
    userRole: {
      create: jest.fn(async ({ data }: any) => {
        state.userRoles.push(data);
        return data;
      }),
    },
    class: {
      findMany: jest.fn(async (q: any) =>
        state.classes.filter((item) => item.tenantId === q.where?.tenantId),
      ),
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('class'),
          ...data,
          createdAt: new Date(),
        };
        state.classes.push(item);
        return item;
      }),
    },
    staff: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('staff'),
          ...data,
          createdAt: new Date(),
        };
        state.staff.push(item);
        return item;
      }),
    },
    student: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('student'),
          ...data,
          createdAt: new Date(),
        };
        state.students.push(item);
        return item;
      }),
      findMany: jest.fn(async (q: any) =>
        state.students.filter((item) => item.tenantId === q.where?.tenantId),
      ),
      findFirst: jest.fn(async (q: any) =>
        state.students.find(
          (item) => item.id === q.where?.id && item.tenantId === q.where?.tenantId,
        ),
      ),
    },
    otpCode: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('otp'),
          ...data,
          createdAt: new Date(),
        };
        state.otpCodes.push(item);
        return item;
      }),
      findFirst: jest.fn(async (q: any) => {
        const { where } = q;
        return state.otpCodes
          .slice()
          .reverse()
          .find((otp) => {
            const matchesCreatedAt =
              where.createdAt?.gte === undefined ||
              (otp.createdAt as any) >= where.createdAt.gte;
            return (
              otp.userId === where.userId &&
              otp.purpose === where.purpose &&
              matchesCreatedAt
            );
          });
      }),
      count: jest.fn(async (q: any) => {
        const { where } = q;
        return state.otpCodes.filter((otp: any) => {
          const matchesCreatedAt =
            where.createdAt?.gte === undefined ||
            otp.createdAt >= where.createdAt.gte;
          return (
            otp.userId === where.userId &&
            otp.purpose === where.purpose &&
            matchesCreatedAt
          );
        }).length;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const log = {
          id: nextId('log'),
          ...data,
          createdAt: new Date(),
        };
        state.auditLogs.push(log);
        return log;
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        state.refreshTokens.push(data);
        return data;
      }),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      findUnique: jest.fn(async (q: any) =>
        state.refreshTokens.find((t) => t.token === q.where?.token),
      ),
    },
  };
}

export function ensureTenantDefaultsWithState(state: MockState, tenantId: string) {
  for (const roleDefinition of SYSTEM_ROLE_DEFINITIONS) {
    if (
      !state.roles.some(
        (role) =>
          role.tenantId === tenantId && role.name === roleDefinition.name,
      )
    ) {
      state.roles.push({
        id: `role-${tenantId}-${roleDefinition.name}`,
        tenantId,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
      });
    }
  }

  for (const [roleName, permissionKeys] of Object.entries(
    SYSTEM_ROLE_PERMISSIONS,
  )) {
    const role = state.roles.find(
      (item) => item.tenantId === tenantId && item.name === roleName,
    );

    if (!role) {
      continue;
    }

    state.rolePermissions = state.rolePermissions.filter(
      (item) => item.roleId !== role.id,
    );

    for (const permissionKey of permissionKeys) {
      const permission = PERMISSION_CATALOG.find(
        (p) => buildPermissionKey(p.resource as string, p.action as string) === permissionKey,
      );

      if (!permission) {
        continue;
      }

      state.rolePermissions.push({
        roleId: role.id,
        permissionId: (permission as any).id,
      });
    }
  }
}
