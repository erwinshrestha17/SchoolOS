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
  tenantSettings: Record<string, any>[];
  fileAssets: Record<string, any>[];
  studentDocuments: Record<string, any>[];
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
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../src/rbac/rbac.defaults';

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
    students: [
      {
        id: 'student-a',
        tenantId: 'tenant-a',
        studentSystemId: 'ST-A',
        firstNameEn: 'Student',
        lastNameEn: 'A',
      },
    ] as Record<string, any>[],
    staff: [] as Record<string, any>[],
    staffLeaveBalances: [] as Record<string, any>[],
    academicYears: [] as Record<string, any>[],
    chartAccounts: [] as Record<string, any>[],
    feeHeads: [] as Record<string, any>[],
    otpCodes: [] as Record<string, any>[],
    refreshTokens: [] as Record<string, any>[],
    auditLogs: [] as Record<string, any>[],
    tenantSettings: [] as Record<string, any>[],
    fileAssets: [] as Record<string, any>[],
    studentDocuments: [] as Record<string, any>[],
  };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${String(idCounter++)}`;

  function permissionByKey(permissionKey: string) {
    return state.permissions.find(
      (permission) =>
        buildPermissionKey(
          permission.resource as string,
          permission.action as string,
        ) === permissionKey,
    );
  }

  function attachRolePermissions(
    stateRef: MockState,
    role: Record<string, any> | undefined,
  ) {
    if (!role) {
      return role;
    }
    return {
      ...role,
      rolePermissions: stateRef.rolePermissions
        .filter((item) => item.roleId === role.id)
        .map((item) => ({
          ...item,
          permission: stateRef.permissions.find(
            (permission) => permission.id === item.permissionId,
          ),
        })),
    };
  }

  function attachUserRoles(
    stateRef: MockState,
    user: Record<string, any> | undefined,
  ) {
    if (!user) {
      return user;
    }
    return {
      ...user,
      tenant: stateRef.tenants.find((tenant) => tenant.id === user.tenantId),
      staff: stateRef.staff.find((staff) => staff.userId === user.id) ?? null,
      student:
        stateRef.students.find((student) => student.userId === user.id) ?? null,
      userRoles: stateRef.userRoles
        .filter((item) => item.userId === user.id)
        .map((item) => ({
          ...item,
          role: attachRolePermissions(
            stateRef,
            stateRef.roles.find((role) => role.id === item.roleId),
          ),
        })),
    };
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
          (tenant) =>
            tenant.id === q.where?.id || tenant.slug === q.where?.slug,
        ),
      ),
      findFirst: jest.fn(async (q: any) =>
        state.tenants.find(
          (tenant) =>
            tenant.id === q.where?.id || tenant.slug === q.where?.slug,
        ),
      ),
      create: jest.fn(async ({ data }: any) => {
        const tenant = {
          id: nextId('tenant'),
          isActive: true,
          mode: 'MULTI',
          plan: 'standard',
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
            (user.id === q.where?.id &&
              (!q.where?.tenantId || user.tenantId === q.where.tenantId)),
        );
        return attachUserRoles(state, user);
      }),
      findFirst: jest.fn(async (q: any) => {
        const user = state.users.find(
          (user) =>
            (user.tenantId === q.where?.tenantId_email?.tenantId &&
              user.email === q.where?.tenantId_email?.email) ||
            (user.id === q.where?.id &&
              (!q.where?.tenantId || user.tenantId === q.where.tenantId)),
        );
        return attachUserRoles(state, user);
      }),
      findMany: jest.fn(async (q: any) =>
        state.users
          .filter((user) => user.tenantId === q.where?.tenantId)
          .map((user) => attachUserRoles(state, user)),
      ),
      create: jest.fn(async ({ data }: any) => {
        const nestedRoles = data.userRoles?.create ?? [];
        const user = {
          id: nextId('user'),
          ...data,
          userRoles: undefined,
          createdAt: new Date(),
        };
        state.users.push(user);
        for (const role of nestedRoles) {
          state.userRoles.push({
            id: nextId('user-role'),
            userId: user.id,
            ...role,
          });
        }
        return user;
      }),
      update: jest.fn(async (q: any) => {
        const user = state.users.find((u) => u.id === q.where?.id);
        if (user) {
          Object.assign(user, q.data);
        }
        return attachUserRoles(state, user);
      }),
      count: jest.fn(
        async (q: any) =>
          state.users.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
      ),
    },
    role: {
      findUnique: jest.fn(async (q: any) =>
        state.roles.find(
          (role) =>
            role.tenantId === q.where?.tenantId_name?.tenantId &&
            role.name === q.where?.tenantId_name?.name,
        ),
      ),
      findMany: jest.fn(async (q: any) =>
        state.roles.filter(
          (role) =>
            role.tenantId === q.where?.tenantId &&
            (!q.where?.id?.in || q.where.id.in.includes(role.id)),
        ),
      ),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.roles.find(
          (role) =>
            role.tenantId === where.tenantId_name?.tenantId &&
            role.name === where.tenantId_name?.name,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const role = {
          id: nextId('role'),
          ...create,
        };
        state.roles.push(role);
        return role;
      }),
    },
    permission: {
      findUnique: jest.fn(async (q: any) =>
        state.permissions.find(
          (permission) =>
            permission.resource === q.where?.resource_action?.resource &&
            permission.action === q.where?.resource_action?.action,
        ),
      ),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.permissions.find(
          (permission) =>
            permission.resource === where.resource_action?.resource &&
            permission.action === where.resource_action?.action,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const permission = {
          id: nextId('perm'),
          ...create,
        };
        state.permissions.push(permission);
        return permission;
      }),
    },
    rolePermission: {
      deleteMany: jest.fn(async (q: any) => {
        const before = state.rolePermissions.length;
        state.rolePermissions = state.rolePermissions.filter(
          (item) => item.roleId !== q.where?.roleId,
        );
        return { count: before - state.rolePermissions.length };
      }),
      create: jest.fn(async ({ data }: any) => {
        state.rolePermissions.push(data);
        return data;
      }),
    },
    userRole: {
      create: jest.fn(async ({ data }: any) => {
        state.userRoles.push(data);
        return data;
      }),
      findMany: jest.fn(async (q: any) =>
        state.userRoles
          .filter(
            (item) =>
              item.userId === q.where?.userId &&
              item.tenantId === q.where?.tenantId,
          )
          .map((item) => ({
            ...item,
            role: attachRolePermissions(
              state,
              state.roles.find((role) => role.id === item.roleId),
            ),
          })),
      ),
    },
    class: {
      findFirst: jest.fn(async (q: any) =>
        state.classes.find(
          (item) =>
            item.id === q.where?.id && item.tenantId === q.where?.tenantId,
        ),
      ),
      findUnique: jest.fn(async (q: any) =>
        state.classes.find(
          (item) =>
            item.tenantId === q.where?.tenantId_name?.tenantId &&
            item.name === q.where?.tenantId_name?.name,
        ),
      ),
      findMany: jest.fn(async (q: any) =>
        state.classes
          .filter((item) => item.tenantId === q.where?.tenantId)
          .map((item) => ({
            ...item,
            _count: {
              students: state.students.filter(
                (student) => student.classId === item.id,
              ).length,
              subjects: 0,
              sections: 0,
            },
          })),
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
      count: jest.fn(
        async (q: any) =>
          state.classes.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
      ),
    },
    staff: {
      findUnique: jest.fn(async (q: any) =>
        state.staff.find((item) => item.employeeId === q.where?.employeeId),
      ),
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('staff'),
          ...data,
          user: attachUserRoles(
            state,
            state.users.find((user) => user.id === data.userId),
          ),
          createdAt: new Date(),
        };
        state.staff.push(item);
        return item;
      }),
      count: jest.fn(
        async (q: any) =>
          state.staff.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
      ),
    },
    staffLeaveBalance: {
      createMany: jest.fn(async ({ data }: any) => {
        state.staffLeaveBalances.push(...data);
        return { count: data.length };
      }),
    },
    academicYear: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.academicYears.find(
          (year) =>
            year.tenantId === where.tenantId_name?.tenantId &&
            year.name === where.tenantId_name?.name,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const year = {
          id: nextId('year'),
          ...create,
        };
        state.academicYears.push(year);
        return year;
      }),
    },
    chartAccount: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.chartAccounts.find(
          (account) =>
            account.tenantId === where.tenantId_code?.tenantId &&
            account.code === where.tenantId_code?.code,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const account = {
          id: nextId('account'),
          ...create,
        };
        state.chartAccounts.push(account);
        return account;
      }),
    },
    feeHead: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.feeHeads.find(
          (feeHead) =>
            feeHead.tenantId === where.tenantId_code?.tenantId &&
            feeHead.code === where.tenantId_code?.code,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const feeHead = {
          id: nextId('fee-head'),
          ...create,
        };
        state.feeHeads.push(feeHead);
        return feeHead;
      }),
    },
    student: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('student'),
          ...data,
          class: state.classes.find(
            (classroom) => classroom.id === data.classId,
          ),
          user: state.users.find((user) => user.id === data.userId),
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
          (item) =>
            item.tenantId === q.where?.tenantId &&
            (item.id === q.where?.id || item.userId === q.where?.userId),
        ),
      ),
      count: jest.fn(
        async (q: any) =>
          state.students.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
      ),
    },
    tenantSetting: {
      findUnique: jest.fn(async (q: any) =>
        state.tenantSettings.find(
          (setting) =>
            setting.tenantId === q.where?.tenantId_key?.tenantId &&
            setting.key === q.where?.tenantId_key?.key,
        ),
      ),
      findMany: jest.fn(async (q: any) =>
        state.tenantSettings.filter((setting) => {
          const matchesTenant = setting.tenantId === q.where?.tenantId;
          const allowedKeys = q.where?.key?.in;
          return (
            matchesTenant && (!allowedKeys || allowedKeys.includes(setting.key))
          );
        }),
      ),
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('setting'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tenantSettings.push(item);
        return item;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = state.tenantSettings.find(
          (setting) =>
            setting.tenantId === where.tenantId_key?.tenantId &&
            setting.key === where.tenantId_key?.key,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const item = {
          id: nextId('setting'),
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tenantSettings.push(item);
        return item;
      }),
      update: jest.fn(async (q: any) => {
        const item = state.tenantSettings.find(
          (setting) => setting.id === q.where?.id,
        );
        if (item) Object.assign(item, q.data, { updatedAt: new Date() });
        return item;
      }),
    },
    studentDocument: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('student-doc'),
          ...data,
          createdAt: new Date(),
        };
        state.studentDocuments.push(item);
        return item;
      }),
      findMany: jest.fn(async (q: any) =>
        state.studentDocuments.filter(
          (item) =>
            item.tenantId === q.where?.tenantId &&
            (!q.where?.studentId || item.studentId === q.where.studentId),
        ),
      ),
    },
    fileAsset: {
      create: jest.fn(async ({ data }: any) => {
        const item = {
          id: nextId('asset'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          softDeletedAt: null,
        };
        state.fileAssets.push(item);
        return item;
      }),
      findUnique: jest.fn(async (q: any) =>
        state.fileAssets.find((item) => item.id === q.where?.id),
      ),
      findMany: jest.fn(async (q: any) =>
        state.fileAssets.filter(
          (item) =>
            item.tenantId === q.where?.tenantId &&
            item.module === q.where?.module &&
            item.entityId === q.where?.entityId &&
            item.softDeletedAt === q.where?.softDeletedAt,
        ),
      ),
      update: jest.fn(async (q: any) => {
        const item = state.fileAssets.find((asset) => asset.id === q.where?.id);
        if (item) Object.assign(item, q.data, { updatedAt: new Date() });
        return item;
      }),
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
      updateMany: jest.fn(async (q: any) => {
        let count = 0;
        for (const otp of state.otpCodes) {
          const matches =
            otp.userId === q.where?.userId && otp.purpose === q.where?.purpose;
          if (matches) {
            Object.assign(otp, q.data);
            count += 1;
          }
        }
        return { count };
      }),
      update: jest.fn(async (q: any) => {
        const otp = state.otpCodes.find((item) => item.id === q.where?.id);
        if (otp) Object.assign(otp, q.data);
        return otp;
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
      updateMany: jest.fn(async (q: any) => {
        let count = 0;
        for (const token of state.refreshTokens) {
          if (
            token.userId === q.where?.userId &&
            (q.where?.revokedAt === undefined ||
              token.revokedAt === q.where.revokedAt)
          ) {
            Object.assign(token, q.data);
            count += 1;
          }
        }
        return { count };
      }),
      update: jest.fn(async (q: any) => {
        const token = state.refreshTokens.find(
          (item) => item.id === q.where?.id,
        );
        if (token) Object.assign(token, q.data);
        return token;
      }),
      findUnique: jest.fn(async (q: any) => {
        const token = state.refreshTokens.find(
          (t) =>
            t.token === q.where?.token || t.tokenHash === q.where?.tokenHash,
        );
        if (!token) return null;
        return {
          ...token,
          user: attachUserRoles(
            state,
            state.users.find((user) => user.id === token.userId),
          ),
        };
      }),
    },
  };
}

export function ensureTenantDefaultsWithState(
  state: MockState,
  tenantId: string,
) {
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
      const permission = state.permissions.find(
        (p) =>
          buildPermissionKey(p.resource as string, p.action as string) ===
          permissionKey,
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
