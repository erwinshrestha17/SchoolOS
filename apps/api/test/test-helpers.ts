/**
 * Test helper types and utilities for SchoolOS E2E tests
 */

export interface MockState {
  tenants: Record<string, unknown>[];
  permissions: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  rolePermissions: Record<string, unknown>[];
  users: Record<string, unknown>[];
  userRoles: Record<string, unknown>[];
  classes: Record<string, unknown>[];
  students: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  staffLeaveBalances: Record<string, unknown>[];
  academicYears: Record<string, unknown>[];
  chartAccounts: Record<string, unknown>[];
  feeHeads: Record<string, unknown>[];
  otpCodes: Record<string, unknown>[];
  refreshTokens: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  tenantSettings: Record<string, unknown>[];
  fileAssets: Record<string, unknown>[];
  studentDocuments: Record<string, unknown>[];
  [key: string]: Record<string, unknown>[];
}

export interface PrismaMock {
  __state: MockState;
  [key: string]: unknown;
}

export interface PrismaQuery {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: unknown;
  take?: number;
  skip?: number;
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
    add: jest.fn(() => Promise.resolve({ id: 'job-1' })),
    ping: jest.fn(() => Promise.resolve('PONG')),
    onModuleDestroy: jest.fn(() => Promise.resolve()),
    onApplicationShutdown: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve(undefined)),
    disconnect: jest.fn(() => Promise.resolve(undefined)),
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
      id: `perm-${String(index + 1)}`,
      ...permission,
    })),
    roles: [] as Record<string, unknown>[],
    rolePermissions: [] as Record<string, unknown>[],
    users: [] as Record<string, unknown>[],
    userRoles: [] as Record<string, unknown>[],
    classes: [] as Record<string, unknown>[],
    students: [
      {
        id: 'student-a',
        tenantId: 'tenant-a',
        studentSystemId: 'ST-A',
        firstNameEn: 'Student',
        lastNameEn: 'A',
      },
    ] as Record<string, unknown>[],
    staff: [] as Record<string, unknown>[],
    staffLeaveBalances: [] as Record<string, unknown>[],
    academicYears: [] as Record<string, unknown>[],
    chartAccounts: [] as Record<string, unknown>[],
    feeHeads: [] as Record<string, unknown>[],
    otpCodes: [] as Record<string, unknown>[],
    refreshTokens: [] as Record<string, unknown>[],
    auditLogs: [] as Record<string, unknown>[],
    tenantSettings: [] as Record<string, unknown>[],
    fileAssets: [] as Record<string, unknown>[],
    studentDocuments: [] as Record<string, unknown>[],
  };

  const nextId = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

  function attachRolePermissions(
    stateRef: MockState,
    role: Record<string, unknown> | undefined,
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
    user: Record<string, unknown> | undefined,
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
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.tenants.find(
            (tenant) =>
              tenant.id === q.where?.id || tenant.slug === q.where?.slug,
          ),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.tenants.find(
            (tenant) =>
              tenant.id === q.where?.id || tenant.slug === q.where?.slug,
          ),
        ),
      ),
      findMany: jest.fn(() => Promise.resolve(state.tenants)),
      update: jest.fn((q: PrismaQuery) => {
        const tenant = state.tenants.find((t) => t.id === q.where?.id);
        if (tenant) {
          Object.assign(tenant, q.data ?? {});
        }
        return Promise.resolve(tenant);
      }),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
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
      findUnique: jest.fn((q: PrismaQuery) => {
        const tenantIdEmail = q.where?.tenantId_email as
          | { tenantId?: string; email?: string }
          | undefined;
        const user = state.users.find(
          (user) =>
            (user.tenantId === tenantIdEmail?.tenantId &&
              user.email === tenantIdEmail?.email) ||
            (user.id === q.where?.id &&
              (!q.where?.tenantId || user.tenantId === q.where.tenantId)),
        );
        return Promise.resolve(attachUserRoles(state, user));
      }),
      findFirst: jest.fn((q: PrismaQuery) => {
        const tenantIdEmail = q.where?.tenantId_email as
          | { tenantId?: string; email?: string }
          | undefined;
        const user = state.users.find(
          (user) =>
            (user.tenantId === tenantIdEmail?.tenantId &&
              user.email === tenantIdEmail?.email) ||
            (user.id === q.where?.id &&
              (!q.where?.tenantId || user.tenantId === q.where.tenantId)),
        );
        return Promise.resolve(attachUserRoles(state, user));
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.users
            .filter((user) => user.tenantId === q.where?.tenantId)
            .map((user) => attachUserRoles(state, user)),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const nestedRoles =
          (data?.userRoles as { create?: Record<string, unknown>[] })?.create ??
          [];
        const user = {
          id: nextId('user'),
          ...data,
          userRoles: undefined,
          createdAt: new Date(),
        };
        state.users.push(user as Record<string, unknown>);
        for (const r of nestedRoles) {
          state.userRoles.push({
            ...r,
            userId: user.id,
          } as Record<string, unknown>);
        }
        return Promise.resolve(attachUserRoles(state, user));
      }),
      update: jest.fn((q: PrismaQuery) => {
        const user = state.users.find((u) => u.id === q.where?.id);
        if (user) {
          Object.assign(user, q.data);
        }
        return Promise.resolve(attachUserRoles(state, user));
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.users.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
        ),
      ),
    },
    role: {
      findUnique: jest.fn((q: PrismaQuery) => {
        const tenantIdName = q.where?.tenantId_name as
          | { tenantId?: string; name?: string }
          | undefined;
        return Promise.resolve(
          state.roles.find(
            (role) =>
              role.tenantId === tenantIdName?.tenantId &&
              role.name === tenantIdName?.name,
          ),
        );
      }),
      findMany: jest.fn((q: PrismaQuery) => {
        const idIn = (q.where?.id as { in?: string[] } | undefined)?.in;
        return Promise.resolve(
          state.roles.filter(
            (role) =>
              role.tenantId === q.where?.tenantId &&
              (!idIn || idIn.includes(role.id as string)),
          ),
        );
      }),
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, update, create } = q;
        const tenantIdName = where?.tenantId_name as
          | { tenantId?: string; name?: string }
          | undefined;
        const existing = state.roles.find(
          (role) =>
            role.tenantId === tenantIdName?.tenantId &&
            role.name === tenantIdName?.name,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const role = {
          id: nextId('role'),
          ...(create as Record<string, unknown>),
        };
        state.roles.push(role as Record<string, unknown>);
        return Promise.resolve(role);
      }),
    },
    permission: {
      findUnique: jest.fn((q: PrismaQuery) => {
        const resAct = q.where?.resource_action as
          | { resource?: string; action?: string }
          | undefined;
        return Promise.resolve(
          state.permissions.find(
            (permission) =>
              permission.resource === resAct?.resource &&
              permission.action === resAct?.action,
          ),
        );
      }),
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, update, create } = q;
        const resAct = where?.resource_action as
          | { resource?: string; action?: string }
          | undefined;
        const existing = state.permissions.find(
          (permission) =>
            permission.resource === resAct?.resource &&
            permission.action === resAct?.action,
        );
        if (existing) {
          Object.assign(existing, update ?? {});
          return Promise.resolve(existing);
        }
        const permission = {
          id: nextId('perm'),
          ...(create as Record<string, unknown>),
        };
        state.permissions.push(permission as Record<string, unknown>);
        return Promise.resolve(permission);
      }),
    },
    rolePermission: {
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.rolePermissions.length;
        state.rolePermissions = state.rolePermissions.filter(
          (item) => item.roleId !== q.where?.roleId,
        );
        return Promise.resolve({
          count: before - state.rolePermissions.length,
        });
      }),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        state.rolePermissions.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      }),
    },
    userRole: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        state.userRoles.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
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
      ),
    },
    class: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.classes.find(
            (item) =>
              item.id === q.where?.id && item.tenantId === q.where?.tenantId,
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) => {
        const tenantIdName = q.where?.tenantId_name as
          | { tenantId?: string; name?: string }
          | undefined;
        return Promise.resolve(
          state.classes.find(
            (item) =>
              item.tenantId === tenantIdName?.tenantId &&
              item.name === tenantIdName?.name,
          ),
        );
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
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
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('class'),
          ...data,
          createdAt: new Date(),
        };
        state.classes.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.classes.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
        ),
      ),
    },
    staff: {
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.staff.find((item) => item.employeeId === q.where?.employeeId),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.staff.find(
            (item) =>
              item.tenantId === q.where?.tenantId &&
              (!q.where?.employeeId || item.employeeId === q.where.employeeId),
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('staff'),
          ...data,
          user: attachUserRoles(
            state,
            state.users.find((user) => user.id === data?.userId),
          ),
          createdAt: new Date(),
        };
        state.staff.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.staff.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
        ),
      ),
    },
    staffLeaveBalance: {
      createMany: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? [];
        state.staffLeaveBalances.push(
          ...(data as unknown as Record<string, unknown>[]),
        );
        return Promise.resolve({
          count: Array.isArray(data) ? data.length : 0,
        });
      }),
    },
    academicYear: {
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, update, create } = q;
        const tenantIdName = where?.tenantId_name as
          | { tenantId?: string; name?: string }
          | undefined;
        const existing = state.academicYears.find(
          (year) =>
            year.tenantId === tenantIdName?.tenantId &&
            year.name === tenantIdName?.name,
        );
        if (existing) {
          Object.assign(existing, update ?? {});
          return Promise.resolve(existing);
        }
        const year = {
          id: nextId('year'),
          ...(create as Record<string, unknown>),
        };
        state.academicYears.push(year as Record<string, unknown>);
        return Promise.resolve(year);
      }),
    },
    chartAccount: {
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, update, create } = q;
        const tenantIdCode = where?.tenantId_code as
          | { tenantId?: string; code?: string }
          | undefined;
        const existing = state.chartAccounts.find(
          (account) =>
            account.tenantId === tenantIdCode?.tenantId &&
            account.code === tenantIdCode?.code,
        );
        if (existing) {
          Object.assign(existing, update ?? {});
          return Promise.resolve(existing);
        }
        const account = {
          id: nextId('account'),
          ...(create as Record<string, unknown>),
        };
        state.chartAccounts.push(account as Record<string, unknown>);
        return Promise.resolve(account);
      }),
    },
    feeHead: {
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, update, create } = q;
        const tenantIdCode = where?.tenantId_code as
          | { tenantId?: string; code?: string }
          | undefined;
        const existing = state.feeHeads.find(
          (feeHead) =>
            feeHead.tenantId === tenantIdCode?.tenantId &&
            feeHead.code === tenantIdCode?.code,
        );
        if (existing) {
          Object.assign(existing, update ?? {});
          return Promise.resolve(existing);
        }
        const feeHead = {
          id: nextId('fee-head'),
          ...(create as Record<string, unknown>),
        };
        state.feeHeads.push(feeHead as Record<string, unknown>);
        return Promise.resolve(feeHead);
      }),
    },
    student: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('student'),
          ...data,
          class: state.classes.find(
            (classroom) => classroom.id === data?.classId,
          ),
          user: state.users.find((user) => user.id === data?.userId),
          createdAt: new Date(),
        };
        state.students.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.students.filter((item) => item.tenantId === q.where?.tenantId),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.students.find(
            (item) =>
              item.tenantId === q.where?.tenantId &&
              (item.id === q.where?.id || item.userId === q.where?.userId),
          ),
        ),
      ),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.students.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
        ),
      ),
    },
    tenantSetting: {
      findUnique: jest.fn((q: PrismaQuery) => {
        const tenantIdKey = q.where?.tenantId_key as
          | { tenantId?: string; key?: string }
          | undefined;
        return Promise.resolve(
          state.tenantSettings.find(
            (setting) =>
              setting.tenantId === tenantIdKey?.tenantId &&
              setting.key === tenantIdKey?.key,
          ),
        );
      }),
      findMany: jest.fn((q: PrismaQuery) => {
        const keyIn = (q.where?.key as { in?: string[] } | undefined)?.in;
        return Promise.resolve(
          state.tenantSettings.filter((setting) => {
            const matchesTenant = setting.tenantId === q.where?.tenantId;
            return (
              matchesTenant && (!keyIn || keyIn.includes(setting.key as string))
            );
          }),
        );
      }),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('setting'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tenantSettings.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      upsert: jest.fn((q: PrismaQuery) => {
        const { where, create, update } = q;
        const tenantIdKey = where?.tenantId_key as
          | { tenantId?: string; key?: string }
          | undefined;
        const existing = state.tenantSettings.find(
          (setting) =>
            setting.tenantId === tenantIdKey?.tenantId &&
            setting.key === tenantIdKey?.key,
        );
        if (existing) {
          Object.assign(existing, update ?? {}, { updatedAt: new Date() });
          return Promise.resolve(existing);
        }
        const item = {
          id: nextId('setting'),
          ...(create as Record<string, unknown>),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tenantSettings.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.tenantSettings.find(
          (setting) => setting.id === q.where?.id,
        );
        if (item) Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
    },
    studentDocument: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('student-doc'),
          ...data,
          createdAt: new Date(),
        };
        state.studentDocuments.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.studentDocuments.filter(
            (item) =>
              item.tenantId === q.where?.tenantId &&
              (!q.where?.studentId || item.studentId === q.where.studentId),
          ),
        ),
      ),
    },
    fileAsset: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('asset'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          softDeletedAt: null,
        };
        state.fileAssets.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fileAssets.find((item) => item.id === q.where?.id),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fileAssets.filter(
            (item) =>
              item.tenantId === q.where?.tenantId &&
              item.module === q.where?.module &&
              item.entityId === q.where?.entityId &&
              item.softDeletedAt === q.where?.softDeletedAt,
          ),
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.fileAssets.find((asset) => asset.id === q.where?.id);
        if (item) Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
    },
    otpCode: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('otp'),
          ...data,
          createdAt: new Date(),
        };
        state.otpCodes.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findFirst: jest.fn((q: PrismaQuery) => {
        const { where } = q;
        const createdAtGte = (where?.createdAt as { gte?: Date } | undefined)
          ?.gte;
        return Promise.resolve(
          state.otpCodes
            .slice()
            .reverse()
            .find((otp) => {
              const matchesCreatedAt =
                createdAtGte === undefined ||
                (otp.createdAt as Date) >= createdAtGte;
              return (
                otp.userId === where?.userId &&
                otp.purpose === where?.purpose &&
                matchesCreatedAt
              );
            }),
        );
      }),
      count: jest.fn((q: PrismaQuery) => {
        const { where } = q;
        const createdAtGte = (where?.createdAt as { gte?: Date } | undefined)
          ?.gte;
        return Promise.resolve(
          state.otpCodes.filter((otp) => {
            const matchesCreatedAt =
              createdAtGte === undefined ||
              (otp.createdAt as Date) >= createdAtGte;
            return (
              otp.userId === where?.userId &&
              otp.purpose === where?.purpose &&
              matchesCreatedAt
            );
          }).length,
        );
      }),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const otp of state.otpCodes) {
          const matches =
            otp.userId === q.where?.userId && otp.purpose === q.where?.purpose;
          if (matches) {
            Object.assign(otp, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
      update: jest.fn((q: PrismaQuery) => {
        const otp = state.otpCodes.find((item) => item.id === q.where?.id);
        if (otp) Object.assign(otp, q.data ?? {});
        return Promise.resolve(otp);
      }),
    },
    auditLog: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const log = {
          id: nextId('log'),
          ...data,
          createdAt: new Date(),
        };
        state.auditLogs.push(log as Record<string, unknown>);
        return Promise.resolve(log);
      }),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          [...state.auditLogs]
            .reverse()
            .find((log) => log.tenantId === q.where?.tenantId),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.auditLogs.filter((log) => log.tenantId === q.where?.tenantId),
        ),
      ),
    },
    refreshToken: {
      create: jest.fn((q: PrismaQuery) => {
        state.refreshTokens.push((q.data ?? {}) as Record<string, unknown>);
        return Promise.resolve(q.data);
      }),
      deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const token of state.refreshTokens) {
          if (
            token.userId === q.where?.userId &&
            (q.where?.revokedAt === undefined ||
              token.revokedAt === q.where.revokedAt)
          ) {
            Object.assign(token, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
      update: jest.fn((q: PrismaQuery) => {
        const token = state.refreshTokens.find(
          (item) => item.id === q.where?.id,
        );
        if (token) Object.assign(token, q.data ?? {});
        return Promise.resolve(token);
      }),
      findUnique: jest.fn((q: PrismaQuery) => {
        const token = state.refreshTokens.find(
          (t) =>
            t.token === q.where?.token || t.tokenHash === q.where?.tokenHash,
        );
        if (!token) return Promise.resolve(null);
        return Promise.resolve({
          ...token,
          user: attachUserRoles(
            state,
            state.users.find((user) => user.id === token.userId),
          ),
        });
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
        roleId: role.id as string,
        permissionId: permission.id as string,
      });
    }
  }
}
