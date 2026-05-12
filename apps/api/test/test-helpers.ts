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
  enrollments: Record<string, unknown>[];
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
  timetableVersions: Record<string, unknown>[];
  timetableSlots: Record<string, unknown>[];
  timetableSubstitutions: Record<string, unknown>[];
  homeworkAssignments: Record<string, unknown>[];
  homeworkSubmissions: Record<string, unknown>[];
  journalEntries: Record<string, unknown>[];
  journalLines: Record<string, unknown>[];
  fiscalYears: Record<string, unknown>[];
  fiscalPeriods: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  studentDocumentHistory: Record<string, unknown>[];
  cashierCloses: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  paymentRefunds: Record<string, unknown>[];
  feeWaivers: Record<string, unknown>[];
  generatedStudentDocuments: Record<string, unknown>[];
  studentLifecycleTransitions: Record<string, unknown>[];
  [key: string]: Record<string, unknown>[];
}

export interface PrismaMock {
  __state: MockState;
  [key: string]: any;
}

export interface PrismaQuery {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
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

import { getQueueToken } from '@nestjs/bullmq';

export function mockBullQueues(moduleBuilder: any) {
  return moduleBuilder
    .overrideProvider(getQueueToken('notifications'))
    .useValue(createQueueMock())
    .overrideProvider(getQueueToken('activity-media'))
    .useValue(createQueueMock());
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

import { AuthMethod, Prisma } from '@prisma/client';
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
    enrollments: [] as Record<string, unknown>[],
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
    timetableVersions: [] as Record<string, unknown>[],
    timetableSlots: [] as Record<string, unknown>[],
    timetableSubstitutions: [] as Record<string, unknown>[],
    homeworkAssignments: [] as Record<string, unknown>[],
    homeworkSubmissions: [] as Record<string, unknown>[],
    journalEntries: [] as Record<string, unknown>[],
    journalLines: [] as Record<string, unknown>[],
    fiscalYears: [] as Record<string, unknown>[],
    fiscalPeriods: [] as Record<string, unknown>[],
    payments: [] as Record<string, unknown>[],
    invoices: [] as Record<string, unknown>[],
    studentDocumentHistory: [] as Record<string, unknown>[],
    cashierCloses: [] as Record<string, unknown>[],
    receipts: [] as Record<string, unknown>[],
    paymentRefunds: [] as Record<string, unknown>[],
    feeWaivers: [] as Record<string, unknown>[],
    generatedStudentDocuments: [] as Record<string, unknown>[],
    studentLifecycleTransitions: [] as Record<string, unknown>[],
    timetablePeriods: [] as Record<string, unknown>[],
    teacherAvailability: [] as Record<string, unknown>[],
    teacherWorkloadLimits: [] as Record<string, unknown>[],
    subjectWeeklyRequirements: [] as Record<string, unknown>[],
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

  const prisma: any = {
    __state: state,
    $connect: jest.fn(() => Promise.resolve()),
    $disconnect: jest.fn(() => Promise.resolve()),
    onModuleInit: jest.fn(() => Promise.resolve()),
    onModuleDestroy: jest.fn(() => Promise.resolve()),
  };

  prisma.$transaction = jest.fn((arg: any) => {
    if (typeof arg === 'function') {
      return arg(prisma);
    }
    return Promise.all(arg);
  });

  Object.assign(prisma, {
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
      findUniqueOrThrow: jest.fn((q: PrismaQuery) => {
        const tenant = state.tenants.find(
          (t) => t.id === q.where?.id || t.slug === q.where?.slug,
        );
        if (!tenant) throw new Error('Tenant not found');
        return Promise.resolve(tenant);
      }),
      findFirstOrThrow: jest.fn((q: PrismaQuery) => {
        const tenant = state.tenants.find(
          (t) => t.id === q.where?.id || t.slug === q.where?.slug,
        );
        if (!tenant) throw new Error('Tenant not found');
        return Promise.resolve(tenant);
      }),
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
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.tenants.filter((t) => !q.where?.id || t.id === q.where.id)
            .length,
        ),
      ),
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
          ...create!,
        };
        state.roles.push(role as Record<string, unknown>);
        return Promise.resolve(role);
      }),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.roles.find(
            (role) =>
              (!q.where?.tenantId || role.tenantId === q.where.tenantId) &&
              (!q.where?.name || role.name === q.where.name),
          ),
        ),
      ),
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
          ...create!,
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
      delete: jest.fn((q: PrismaQuery) => {
        const index = state.classes.findIndex((i) => i.id === q.where?.id);
        if (index !== -1) state.classes.splice(index, 1);
        return Promise.resolve({ id: q.where?.id });
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.classes.length;
        state.classes = state.classes.filter(
          (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
        );
        return Promise.resolve({ count: before - state.classes.length });
      }),
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
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.academicYears.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.academicYears.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
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
          ...create!,
        };
        state.academicYears.push(year as Record<string, unknown>);
        return Promise.resolve(year);
      }),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('year'),
          ...data,
          createdAt: new Date(),
        };
        state.academicYears.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.academicYears.length;
        state.academicYears = state.academicYears.filter(
          (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
        );
        return Promise.resolve({ count: before - state.academicYears.length });
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
          ...create!,
        };
        state.chartAccounts.push(account as Record<string, unknown>);
        return Promise.resolve(account);
      }),
      findUnique: jest.fn((q: PrismaQuery) => {
        const tenantIdCode = q.where?.tenantId_code as
          | { tenantId?: string; code?: string }
          | undefined;
        return Promise.resolve(
          state.chartAccounts.find(
            (account) =>
              (account.tenantId === tenantIdCode?.tenantId &&
                account.code === tenantIdCode?.code) ||
              account.id === q.where?.id,
          ),
        );
      }),
      findUniqueOrThrow: jest.fn((q: PrismaQuery) => {
        const tenantIdCode = q.where?.tenantId_code as
          | { tenantId?: string; code?: string }
          | undefined;
        const account = state.chartAccounts.find(
          (account) =>
            (account.tenantId === tenantIdCode?.tenantId &&
              account.code === tenantIdCode?.code) ||
            account.id === q.where?.id,
        );
        if (!account) throw new Error('Account not found');
        return Promise.resolve(account);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.chartAccounts
            .filter(
              (account) =>
                !q.where?.tenantId || account.tenantId === q.where.tenantId,
            )
            .map((account) => ({
              journalLines: [],
              ...account,
            })),
        ),
      ),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.chartAccounts.filter(
            (account) =>
              !q.where?.tenantId || account.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
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
          ...create!,
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
          lifecycleStatus: 'ACTIVE',
          guardianLinks: [],
          documents: [],
          enrollments: [],
          invoices: [],
          attendanceRecords: [],
          identities: [],
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
      findFirst: jest.fn((q: PrismaQuery) => {
        const where = q.where ?? {};
        return Promise.resolve(
          state.students.find(
            (item) =>
              (!where.tenantId || item.tenantId === where.tenantId) &&
              (!where.id || item.id === where.id) &&
              (!where.userId || item.userId === where.userId) &&
              (!where.qrCode || item.qrCode === where.qrCode),
          ),
        );
      }),
      findFirstOrThrow: jest.fn((q: PrismaQuery) => {
        const where = q.where ?? {};
        const student = state.students.find(
          (item) =>
            (!where.tenantId || item.tenantId === where.tenantId) &&
            (!where.id || item.id === where.id) &&
            (!where.userId || item.userId === where.userId) &&
            (!where.qrCode || item.qrCode === where.qrCode),
        );
        if (!student) throw new Error('Student not found');
        return Promise.resolve(student);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.students.filter((item) => item.tenantId === q.where?.tenantId)
            .length,
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) => {
        const where = q.where ?? {};
        const item = state.students.find(
          (i) =>
            (!where.tenantId || i.tenantId === where.tenantId) &&
            (!where.id || i.id === where.id) &&
            (!where.userId || i.userId === where.userId) &&
            (!where.qrCode || i.qrCode === where.qrCode),
        );
        if (!item) return Promise.resolve(null);
        return Promise.resolve({
          ...item,
          _count: {
            invoices: 0,
            payments: 0,
            studentFeeAssignments: 0,
          },
        });
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.students.find((s) => s.id === q.where?.id);
        if (item) {
          Object.assign(item, q.data ?? {});
        }
        return Promise.resolve(item);
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.students.length;
        state.students = state.students.filter(
          (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
        );
        return Promise.resolve({ count: before - state.students.length });
      }),
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
          ...create!,
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
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.studentId || item.studentId === q.where.studentId),
          ),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.studentDocuments.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id) &&
              (!q.where?.studentId || item.studentId === q.where.studentId),
          ),
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.studentDocuments.find(
          (doc) =>
            doc.id === q.where?.id ||
            (doc.tenantId === q.where?.tenantId && doc.id === q.where?.id),
        );

        if (item) {
          Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        }

        return Promise.resolve(item);
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.studentDocuments.length;
        state.studentDocuments = state.studentDocuments.filter(
          (doc) =>
            (!q.where?.tenantId || doc.tenantId === q.where.tenantId) &&
            (!q.where?.studentId || doc.studentId === q.where.studentId),
        );
        return Promise.resolve({
          count: before - state.studentDocuments.length,
        });
      }),
      delete: jest.fn((q: PrismaQuery) => {
        const id = q.where?.id;
        const index = state.studentDocuments.findIndex((i) => i.id === id);
        if (index !== -1) {
          state.studentDocuments.splice(index, 1);
          // Simulate cascade: set documentId to null in history
          for (const hist of state.studentDocumentHistory) {
            if (hist.documentId === id) {
              hist.documentId = null;
            }
          }
        }
        return Promise.resolve({ id });
      }),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const doc of state.studentDocuments) {
          const matchTenant =
            !q.where?.tenantId || doc.tenantId === q.where.tenantId;
          const matchStudent =
            !q.where?.studentId || doc.studentId === q.where.studentId;
          if (matchTenant && matchStudent) {
            Object.assign(doc, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    studentDocumentHistory: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('doc-hist'),
          ...data,
          createdAt: new Date(Date.now() + state.studentDocumentHistory.length),
        };
        state.studentDocumentHistory.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      createMany: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? [];
        const items = (Array.isArray(data) ? data : [data]).map((d: any) => ({
          id: nextId('doc-hist'),
          ...d,
          createdAt: new Date(),
        }));
        state.studentDocumentHistory.push(...items);
        return Promise.resolve({ count: items.length });
      }),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.studentDocumentHistory.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.documentId ||
                item.documentId === q.where.documentId) &&
              (!q.where?.action || item.action === q.where.action),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) => {
        let results = state.studentDocumentHistory.filter(
          (item) =>
            (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
            (!q.where?.documentId || item.documentId === q.where.documentId),
        );

        if (q.orderBy) {
          const orderBy = q.orderBy as any;
          if (orderBy.createdAt === 'desc') {
            results = [...results].sort(
              (a, b) =>
                (b.createdAt as Date).getTime() -
                (a.createdAt as Date).getTime(),
            );
          }
        }

        return Promise.resolve(results);
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.studentDocumentHistory.length;
        state.studentDocumentHistory = state.studentDocumentHistory.filter(
          (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
        );
        return Promise.resolve({
          count: before - state.studentDocumentHistory.length,
        });
      }),
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
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fileAssets.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id) &&
              (!q.where?.module || item.module === q.where.module) &&
              (!q.where?.entityId || item.entityId === q.where.entityId),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fileAssets.filter(
            (item) =>
              item.tenantId === q.where?.tenantId &&
              item.module === q.where?.module &&
              item.entityId === q.where?.entityId &&
              !item.softDeletedAt,
          ),
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.fileAssets.find((asset) => asset.id === q.where?.id);
        if (item) Object.assign(item, q.data ?? {});
        return Promise.resolve(item);
      }),
      aggregate: jest.fn((q: PrismaQuery) => {
        const sum = state.fileAssets
          .filter(
            (a) =>
              (!q.where?.tenantId || a.tenantId === q.where.tenantId) &&
              a.softDeletedAt === null,
          )
          .reduce((acc, a) => acc + Number(a.sizeBytes || 0), 0);
        return Promise.resolve({ _sum: { sizeBytes: sum } });
      }),
    },
    auditLog: {
      findFirst: jest.fn((q: PrismaQuery) => {
        const logs = state.auditLogs
          .filter((a) => !q.where?.tenantId || a.tenantId === q.where.tenantId)
          .sort(
            (a, b) =>
              (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
          );
        return Promise.resolve(logs[0]);
      }),
      findMany: jest.fn((q: PrismaQuery) => {
        const skip = q.skip || 0;
        const take = q.take || 25;
        const logs = state.auditLogs
          .filter((a) => !q.where?.tenantId || a.tenantId === q.where.tenantId)
          .sort(
            (a, b) =>
              (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
          );
        return Promise.resolve(
          logs.slice(skip, skip + take).map((log) => ({
            ...log,
            user: state.users.find((u) => u.id === log.userId),
          })),
        );
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.auditLogs.filter(
            (a) => !q.where?.tenantId || a.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('audit'),
          ...data,
          createdAt: new Date(),
        };
        state.auditLogs.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      deleteMany: jest.fn((q: PrismaQuery) => {
        const before = state.auditLogs.length;
        state.auditLogs = state.auditLogs.filter(
          (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
        );
        return Promise.resolve({ count: before - state.auditLogs.length });
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
    assessmentComponent: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    markEntry: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      upsert: jest.fn((q: any) => Promise.resolve(q.create || {})),
    },
    examTerm: {
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    invoice: {
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.invoices.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.invoices.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.invoices.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('inv'),
          lines: [],
          payments: [],
          ...data,
          totalAmount: new Prisma.Decimal(String(data.totalAmount ?? 0)),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.invoices.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.invoices.find((i) => i.id === q.where?.id);
        if (item) Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const item of state.invoices) {
          if (
            (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
            (!q.where?.studentId || item.studentId === q.where.studentId)
          ) {
            Object.assign(item, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    payment: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.payments.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.idempotencyKey ||
                item.idempotencyKey === q.where.idempotencyKey),
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: data.id ?? nextId('payment'),
          refunds: [],
          ...data,
          amount: new Prisma.Decimal(String(data.amount ?? 0)),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.payments.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.payments.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.payments.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.payments.find((i) => i.id === q.where?.id);
        if (item) Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const item of state.payments) {
          if (
            (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
            (!q.where?.studentId || item.studentId === q.where.studentId)
          ) {
            Object.assign(item, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    journalEntry: {
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: data.id ?? `journal-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.journalEntries.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.journalEntries.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.journalEntries.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.journalEntries.find((i) => i.id === q.where?.id);
        if (item) Object.assign(item, q.data ?? {}, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.journalEntries.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
      delete: jest.fn((q: PrismaQuery) => {
        const index = state.journalEntries.findIndex(
          (i) => i.id === q.where?.id,
        );
        if (index !== -1) state.journalEntries.splice(index, 1);
        return Promise.resolve({ id: q.where?.id });
      }),
    },
    journalLine: {
      createMany: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? [];
        state.journalLines.push(
          ...(data as unknown as Record<string, unknown>[]),
        );
        return Promise.resolve({
          count: Array.isArray(data) ? data.length : 0,
        });
      }),
    },
    fiscalYear: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fiscalYears.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.status || item.status === q.where.status),
          ),
        ),
      ),
    },
    fiscalPeriod: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fiscalPeriods.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.status || item.status === q.where.status) &&
              (!q.where?.fiscalYearId ||
                item.fiscalYearId === q.where.fiscalYearId),
          ),
        ),
      ),
    },
    accountingPeriod: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.fiscalPeriods.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.status || item.status === q.where.status),
          ),
        ),
      ),
    },
    cashierClose: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.cashierCloses.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('close'),
          ...data,
          createdAt: new Date(),
        };
        state.cashierCloses.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.cashierCloses.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
    },
    receipt: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.receipts.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('receipt'),
          ...data,
          createdAt: new Date(),
        };
        state.receipts.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.receipts.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.receipts.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
      deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    paymentRefund: {
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.paymentRefunds.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('refund'),
          ...data,
          createdAt: new Date(),
        };
        state.paymentRefunds.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
    },
    feeWaiver: {
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.feeWaivers.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const data = q.data ?? {};
        const item = {
          id: nextId('waiver'),
          ...data,
          createdAt: new Date(),
        };
        state.feeWaivers.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      updateMany: jest.fn((q: PrismaQuery) => {
        let count = 0;
        for (const item of state.feeWaivers) {
          if (
            (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
            (!q.where?.studentId || item.studentId === q.where.studentId)
          ) {
            Object.assign(item, q.data ?? {});
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    timetableVersion: {
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetableVersions.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetableVersions.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetableVersions.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const item = {
          id: nextId('version'),
          ...q.data,
          createdAt: new Date(),
        };
        state.timetableVersions.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.timetableVersions.find((i) => i.id === q.where?.id);
        if (item) Object.assign(item, q.data);
        return Promise.resolve(item);
      }),
    },
    timetableSlot: {
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetableSlots.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const item = { id: nextId('slot'), ...q.data };
        state.timetableSlots.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetableSlots.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.timetableSlots.find((i) => i.id === q.where?.id);
        if (item) Object.assign(item, q.data);
        return Promise.resolve(item);
      }),
    },
    room: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.rooms?.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.rooms?.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    subject: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.subjects?.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.subjects?.find(
            (item) =>
              item.id === q.where?.id &&
              (!q.where?.tenantId || item.tenantId === q.where.tenantId),
          ),
        ),
      ),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    timetablePeriod: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetablePeriods.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetablePeriods.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.timetablePeriods.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
    },
    timetableSubstitution: {
      findFirst: jest.fn((q: PrismaQuery) => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    homeworkAssignment: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkAssignments.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findUnique: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkAssignments.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkAssignments.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const item = { id: nextId('hw'), ...q.data, createdAt: new Date() };
        state.homeworkAssignments.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.homeworkAssignments.find(
          (i) => i.id === q.where?.id,
        );
        if (item) Object.assign(item, q.data);
        return Promise.resolve(item);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkAssignments.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
    },
    homeworkSubmission: {
      findFirst: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkSubmissions.find(
            (item) =>
              (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
              (!q.where?.id || item.id === q.where.id),
          ),
        ),
      ),
      findMany: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkSubmissions.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ),
        ),
      ),
      create: jest.fn((q: PrismaQuery) => {
        const item = { id: nextId('sub'), ...q.data, createdAt: new Date() };
        state.homeworkSubmissions.push(item as Record<string, unknown>);
        return Promise.resolve(item);
      }),
      update: jest.fn((q: PrismaQuery) => {
        const item = state.homeworkSubmissions.find(
          (i) => i.id === q.where?.id,
        );
        if (item) Object.assign(item, q.data);
        return Promise.resolve(item);
      }),
      upsert: jest.fn((q: PrismaQuery) => {
        const item = state.homeworkSubmissions.find(
          (i) => i.id === q.where?.id,
        );
        if (item) {
          Object.assign(item, q.update ?? {});
          return Promise.resolve(item);
        }
        const newItem = {
          id: nextId('sub'),
          ...q.create,
          createdAt: new Date(),
        };
        state.homeworkSubmissions.push(newItem as Record<string, unknown>);
        return Promise.resolve(newItem);
      }),
      count: jest.fn((q: PrismaQuery) =>
        Promise.resolve(
          state.homeworkSubmissions.filter(
            (item) => !q.where?.tenantId || item.tenantId === q.where.tenantId,
          ).length,
        ),
      ),
    },
    homeworkReminderBatch: {
      findFirst: jest.fn((q: PrismaQuery) => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn((q: any) => Promise.resolve(q.data || {})),
      update: jest.fn((q: any) => Promise.resolve(q.data || {})),
      upsert: jest.fn((q: any) => Promise.resolve(q.create || {})),
    },
    subjectWeeklyRequirement: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn((q: any) => Promise.resolve(q.data || {})),
      update: jest.fn((q: any) => Promise.resolve(q.data || {})),
    },
    teacherAvailability: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn((q: any) => Promise.resolve(q.data || {})),
      update: jest.fn((q: any) => Promise.resolve(q.data || {})),
    },
    teacherWorkloadLimit: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      upsert: jest.fn((q: any) => Promise.resolve(q.create || {})),
    },
    subjectTeacherAssignment: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
  });

  prisma.generatedStudentDocument = {
    findFirst: jest.fn((q: PrismaQuery) => Promise.resolve(null)),
    findMany: jest.fn((q: PrismaQuery) => Promise.resolve([])),
    create: jest.fn((q: PrismaQuery) => {
      const item = {
        id: nextId('gen-doc'),
        ...q.data,
        createdAt: new Date(),
      };
      state.generatedStudentDocuments.push(item as Record<string, unknown>);
      return Promise.resolve(item);
    }),
    updateMany: jest.fn((q: PrismaQuery) => {
      let count = 0;
      for (const doc of state.generatedStudentDocuments) {
        if (
          (!q.where?.tenantId || doc.tenantId === q.where.tenantId) &&
          (!q.where?.studentId || doc.studentId === q.where.studentId)
        ) {
          Object.assign(doc, q.data ?? {});
          count += 1;
        }
      }
      return Promise.resolve({ count });
    }),
  };

  prisma.enrollment = {
    findFirst: jest.fn((q: PrismaQuery) => Promise.resolve(null)),
    findMany: jest.fn((q: PrismaQuery) => Promise.resolve([])),
    updateMany: jest.fn((q: PrismaQuery) => {
      let count = 0;
      for (const item of state.enrollments) {
        if (
          (!q.where?.tenantId || item.tenantId === q.where.tenantId) &&
          (!q.where?.studentId || item.studentId === q.where.studentId)
        ) {
          Object.assign(item, q.data ?? {});
          count += 1;
        }
      }
      return Promise.resolve({ count });
    }),
  };

  prisma.studentLifecycleTransition = {
    create: jest.fn((q: PrismaQuery) => {
      const data = q.data ?? {};
      const item = {
        id: nextId('student-lifecycle'),
        ...data,
        createdAt: new Date(),
      };
      state.studentLifecycleTransitions.push(item as Record<string, unknown>);
      return Promise.resolve(item);
    }),

    findMany: jest.fn((q: PrismaQuery) =>
      Promise.resolve(
        state.studentLifecycleTransitions.filter((item) => {
          const where = q.where ?? {};
          return (
            (!where.tenantId || item.tenantId === where.tenantId) &&
            (!where.studentId || item.studentId === where.studentId) &&
            (!where.toStatus || item.toStatus === where.toStatus)
          );
        }),
      ),
    ),

    findFirst: jest.fn((q: PrismaQuery) =>
      Promise.resolve(
        state.studentLifecycleTransitions.find((item) => {
          const where = q.where ?? {};
          return (
            (!where.tenantId || item.tenantId === where.tenantId) &&
            (!where.studentId || item.studentId === where.studentId) &&
            (!where.toStatus || item.toStatus === where.toStatus)
          );
        }),
      ),
    ),

    deleteMany: jest.fn((q: PrismaQuery) => {
      const before = state.studentLifecycleTransitions.length;
      const where = q.where ?? {};

      state.studentLifecycleTransitions =
        state.studentLifecycleTransitions.filter(
          (item) =>
            !(
              (!where.tenantId || item.tenantId === where.tenantId) &&
              (!where.studentId || item.studentId === where.studentId)
            ),
        );

      return Promise.resolve({
        count: before - state.studentLifecycleTransitions.length,
      });
    }),
  };

  const dummyModels = [
    'notificationDelivery',
    'developmentalMilestone',
    'moodLog',
    'libraryIssue',
    'transportEnrollment',
    'transportLog',
    'conversation',
    'conversationParticipant',
    'attendanceRecord',
    'examResult',
    'reportCard',
    'markEntry',
    'healthRecord',
    'incidentReport',
    'studentMergeHistory',
  ];

  for (const model of dummyModels) {
    if (!prisma[model]) {
      prisma[model] = {
        updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
        findMany: jest.fn(() => Promise.resolve([])),
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((q: any) => Promise.resolve(q.data || {})),
      };
    }
  }

  return prisma;
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
