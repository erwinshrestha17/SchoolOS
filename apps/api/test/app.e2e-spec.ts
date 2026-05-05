import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { ClassesController } from '../src/classes/classes.controller';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { RolesController } from '../src/roles/roles.controller';
import { StaffController } from '../src/staff/staff.controller';
import { StudentsController } from '../src/students/students.controller';
import { TenantsController } from '../src/tenants/tenants.controller';
import { UsersController } from '../src/users/users.controller';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../src/rbac/rbac.defaults';
import {
  MockState,
  PrismaMock,
  createRequestMock,
  createResponseMock,
  createQueueMock,
  applyMockUpdate,
  buildCookieHeader,
} from './test-helpers';

describe('School OS Auth + RBAC integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let authController: AuthController;
  let classesController: ClassesController;
  let staffController: StaffController;
  let studentsController: StudentsController;
  let tenantsController: TenantsController;
  let usersController: UsersController;
  let rolesController: RolesController;
  let jwtAuthGuard: JwtAuthGuard;
  let rolesGuard: RolesPermissionsGuard;
  let sentCodes: {
    to: string;
    code: string;
    purpose: 'login' | 'password_recovery' | 'mfa_setup';
  }[];

  beforeEach(async () => {
    prisma = createPrismaMock();
    sentCodes = [];

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(async () => 'PONG'),
        onModuleDestroy: jest.fn(async () => undefined),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(FinanceProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(NotificationsProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(PayrollProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(NotificationsService)
      .useValue({
        sendAuthCodeEmail: jest.fn(async (payload) => {
          sentCodes.push({
            to: payload.to,
            code: payload.code,
            purpose: payload.purpose,
          });
        }),
        sendEmail: jest.fn(),
      })
      .compile();

    authController = moduleRef.get(AuthController);
    classesController = moduleRef.get(ClassesController);
    staffController = moduleRef.get(StaffController);
    studentsController = moduleRef.get(StudentsController);
    tenantsController = moduleRef.get(TenantsController);
    usersController = moduleRef.get(UsersController);
    rolesController = moduleRef.get(RolesController);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
    rolesGuard = moduleRef.get(RolesPermissionsGuard);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('supports secure multi-tenant school onboarding, recovery, and MFA flows', async () => {
    const registration = await tenantsController.register({
      name: 'Green Valley School',
      slug: 'green-valley',
      adminEmail: 'admin@greenvalley.com',
      adminPassword: 'admin12345',
    });

    expect(registration.tenant.slug).toBe('green-valley');

    const adminResponse = createResponseMock();
    const adminLogin = asSession(
      await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'admin@greenvalley.com',
          password: 'admin12345',
        },
        adminResponse as any,
        createRequestMock() as any,
      ),
    );

    expect(adminLogin.user.roles).toContain('admin');

    const adminRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      adminLogin.accessToken,
      TenantsController.prototype.getCurrentTenant,
      TenantsController,
    );

    const adminProfile = await authController.me(adminRequest.auth);
    expect(adminProfile.tenant.slug).toBe('green-valley');

    const tenantSummary = await tenantsController.getCurrentTenant(
      adminRequest.auth,
    );
    expect(tenantSummary.counts.users).toBe(1);

    const createdClass = await classesController.createClass(
      {
        name: 'Class 6',
        level: 6,
      },
      adminRequest.auth,
    );
    expect(createdClass.name).toBe('Class 6');

    const teacherRole = prisma.__state.roles.find(
      (role) =>
        role.tenantId === registration.tenant.id && role.name === 'teacher',
    );
    expect(teacherRole).toBeDefined();

    const createdStaff = await staffController.createStaff(
      {
        firstName: 'Tara',
        lastName: 'Teacher',
        dateOfBirth: '1990-01-01',
        gender: 'FEMALE',
        address: 'Kathmandu',
        joiningDate: '2024-01-01',
        contractType: 'PERMANENT',
        email: 'teacher@greenvalley.com',
        password: 'teacher12345',
        roleIds: [teacherRole!.id],
      },
      adminRequest.auth,
    );

    expect(createdStaff.email).toBe('teacher@greenvalley.com');

    const teacherResponse = createResponseMock();
    const teacherLogin = asSession(
      await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        teacherResponse as any,
        createRequestMock() as any,
      ),
    );

    const teacherPasswordRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      teacherLogin.accessToken,
      AuthController.prototype.me,
      AuthController,
    );

    const mfaSetupRequest = await authController.requestMfaSetup(
      teacherPasswordRequest.auth,
    );
    expect(mfaSetupRequest).toEqual({ success: true });

    const teacherSetupCode = getLatestCode(
      sentCodes,
      'teacher@greenvalley.com',
      'mfa_setup',
    );

    const mfaSetupConfirmation = await authController.confirmMfaSetup(
      teacherPasswordRequest.auth,
      {
        code: teacherSetupCode,
        authMethod: 'BOTH',
      },
    );
    expect(mfaSetupConfirmation.authMethod).toBe('BOTH');

    const teacherMfaChallenge = asChallenge(
      await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        createResponseMock() as any,
        createRequestMock() as any,
      ),
    );
    expect(teacherMfaChallenge.requiresMfa).toBe(true);

    const teacherLoginCode = getLatestCode(
      sentCodes,
      'teacher@greenvalley.com',
      'login',
    );
    const teacherVerifiedResponse = createResponseMock();
    const teacherVerifiedLogin = await authController.verifyOtpLogin(
      {
        challengeToken: teacherMfaChallenge.challengeToken,
        code: teacherLoginCode,
      },
      teacherVerifiedResponse as any,
      createRequestMock() as any,
    );
    expect(teacherVerifiedLogin.accessToken).toBeTruthy();

    const teacherRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      teacherVerifiedLogin.accessToken,
      ClassesController.prototype.listClasses,
      ClassesController,
    );
    const teacherClasses = await classesController.listClasses(
      teacherRequest.auth,
    );
    expect(teacherClasses).toHaveLength(1);

    const createdStudent = await studentsController.createStudent(
      {
        firstNameEn: 'Sita',
        lastNameEn: 'Student',
        dateOfBirth: '2012-06-01',
        gender: 'FEMALE',
        admissionDate: '2024-04-01',
        classId: createdClass.id,
        createLogin: true,
        email: 'student@greenvalley.com',
        password: 'student12345',
      },
      adminRequest.auth,
    );

    expect(createdStudent.hasLogin).toBe(true);

    const studentResponse = createResponseMock();
    const studentLogin = asSession(
      await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'student@greenvalley.com',
          password: 'student12345',
        },
        studentResponse as any,
        createRequestMock() as any,
      ),
    );

    expect(studentLogin.user.roles).toContain('student');

    const studentPasswordRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      studentLogin.accessToken,
      AuthController.prototype.me,
      AuthController,
    );
    const studentProfile = await authController.me(studentPasswordRequest.auth);
    expect(studentProfile.profileType).toBe('student');

    await authController.requestMfaSetup(studentPasswordRequest.auth);
    const studentSetupCode = getLatestCode(
      sentCodes,
      'student@greenvalley.com',
      'mfa_setup',
    );
    const studentMfaConfirmation = await authController.confirmMfaSetup(
      studentPasswordRequest.auth,
      {
        code: studentSetupCode,
        authMethod: 'OTP',
      },
    );
    expect(studentMfaConfirmation.authMethod).toBe('OTP');

    await expect(
      authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'student@greenvalley.com',
          password: 'student12345',
        },
        createResponseMock() as any,
        createRequestMock() as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const studentOtpChallenge = await authController.requestOtpLogin({
      tenantSlug: 'green-valley',
      email: 'student@greenvalley.com',
    });
    const studentLoginCode = getLatestCode(
      sentCodes,
      'student@greenvalley.com',
      'login',
    );
    const studentOtpResponse = createResponseMock();
    const studentOtpLogin = await authController.verifyOtpLogin(
      {
        challengeToken: studentOtpChallenge.challengeToken,
        code: studentLoginCode,
      },
      studentOtpResponse as any,
      createRequestMock() as any,
    );
    expect(studentOtpLogin.accessToken).toBeTruthy();

    const listedUsers = await usersController.listUsers(adminRequest.auth);
    expect(listedUsers).toHaveLength(3);

    const teacherUser = listedUsers.find(
      (user) => user.email === 'teacher@greenvalley.com',
    );
    expect(teacherUser).toBeDefined();

    const suspendedTeacher = await usersController.updateStatus(
      teacherUser!.id,
      {
        status: 'SUSPENDED',
      },
      adminRequest.auth,
    );
    expect(suspendedTeacher.status).toBe('SUSPENDED');

    await expect(
      authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        createResponseMock() as any,
        createRequestMock() as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const reactivatedTeacher = await usersController.updateStatus(
      teacherUser!.id,
      {
        status: 'ACTIVE',
      },
      adminRequest.auth,
    );
    expect(reactivatedTeacher.status).toBe('ACTIVE');

    const recoveryRequest = await authController.requestPasswordRecovery({
      tenantSlug: 'green-valley',
      email: 'teacher@greenvalley.com',
    });
    expect(recoveryRequest).toEqual({ success: true });
    const teacherRecoveryCode = getLatestCode(
      sentCodes,
      'teacher@greenvalley.com',
      'password_recovery',
    );
    const recoveryConfirmation = await authController.confirmPasswordRecovery({
      tenantSlug: 'green-valley',
      email: 'teacher@greenvalley.com',
      code: teacherRecoveryCode,
      newPassword: 'teacher99999',
    });
    expect(recoveryConfirmation).toEqual({ success: true });

    await expect(
      authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        createResponseMock() as any,
        createRequestMock() as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const teacherPostRecoveryChallenge = asChallenge(
      await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher99999',
        },
        createResponseMock() as any,
        createRequestMock() as any,
      ),
    );
    expect(teacherPostRecoveryChallenge.requiresMfa).toBe(true);

    const studentUser = listedUsers.find(
      (user) => user.email === 'student@greenvalley.com',
    );
    expect(studentUser).toBeDefined();

    const secondTenant = await tenantsController.register({
      name: 'Blue Ridge School',
      slug: 'blue-ridge',
      adminEmail: 'admin@blueridge.com',
      adminPassword: 'admin12345',
    });

    const secondTenantResponse = createResponseMock();
    const secondTenantLogin = asSession(
      await authController.login(
        {
          tenantSlug: 'blue-ridge',
          email: 'admin@blueridge.com',
          password: 'admin12345',
        },
        secondTenantResponse as any,
        createRequestMock() as any,
      ),
    );

    const secondTenantRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      secondTenantLogin.accessToken,
      UsersController.prototype.updateStatus,
      UsersController,
    );

    await expect(
      studentsController.createStudent(
        {
          firstNameEn: 'Cross',
          lastNameEn: 'Tenant',
          dateOfBirth: '2013-01-01',
          gender: 'MALE',
          admissionDate: '2024-04-01',
          classId: createdClass.id,
          createLogin: false,
        },
        secondTenantRequest.auth,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      classesController.listClasses(secondTenantRequest.auth),
    ).resolves.toHaveLength(0);

    await expect(
      studentsController.listStudents(secondTenantRequest.auth),
    ).resolves.toHaveLength(0);

    await expect(
      usersController.updateStatus(
        teacherUser!.id,
        { status: 'ACTIVE' },
        secondTenantRequest.auth,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const refreshResponse = createResponseMock();
    const refreshed = await authController.refresh(
      {},
      refreshResponse as any,
      buildCookieHeader(adminResponse.cookieCalls, 'school_os_refresh_token'),
      createRequestMock() as any,
    );

    expect(refreshed.accessToken).toBeTruthy();

    const rotatedCookie = buildCookieHeader(
      refreshResponse.cookieCalls,
      'school_os_refresh_token',
    );
    expect(rotatedCookie).toContain('school_os_refresh_token=');

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

    expect(secondTenant.tenant.slug).toBe('blue-ridge');
  });
});

function getLatestCode(
  sentCodes: {
    to: string;
    code: string;
    purpose: 'login' | 'password_recovery' | 'mfa_setup';
  }[],
  to: string,
  purpose: 'login' | 'password_recovery' | 'mfa_setup',
) {
  const match = [...sentCodes]
    .reverse()
    .find((entry) => entry.to === to && entry.purpose === purpose);

  if (!match) {
    throw new Error(`Missing code for ${to} (${purpose})`);
  }

  return match.code;
}

function asSession(
  result:
    | { accessToken: string; user: unknown }
    | { requiresMfa: boolean; challengeToken: string },
) {
  if (!('accessToken' in result)) {
    throw new Error('Expected a session response');
  }

  return result;
}

function asChallenge(
  result:
    | { accessToken: string; user: unknown }
    | { requiresMfa: boolean; challengeToken: string },
) {
  if (!('challengeToken' in result)) {
    throw new Error('Expected a challenge response');
  }

  return result;
}

async function authenticateRequest(
  jwtAuthGuard: JwtAuthGuard,
  rolesGuard: RolesPermissionsGuard,
  accessToken: string,
  handler: (...args: unknown[]) => unknown,
  controllerClass: new (...args: unknown[]) => unknown,
) {
  const request = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  } as unknown;

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as unknown;

  const cls = (
    jwtAuthGuard as unknown as {
      cls: { run: <T>(callback: () => T | Promise<T>) => Promise<T> };
    }
  ).cls;

  return cls.run(async () => {
    await jwtAuthGuard.canActivate(context);
    await rolesGuard.canActivate(context);

    return request;
  });
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
    cookieCalls: [] as { name: string; value: string }[],
    clearedCookies: [] as string[],
    cookie(name: string, value: string) {
      this.cookieCalls.push({ name, value });
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
    },
  } as unknown;
}

function buildCookieHeader(
  cookies: { name: string; value: string }[],
  name: string,
) {
  const cookie = cookies.find((item) => item.name === name);

  return cookie ? `${cookie.name}=${cookie.value}` : undefined;
}

function createQueueMock() {
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

function applyMockUpdate(
  target: Record<string, unknown>,
  update: Record<string, unknown>,
) {
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

function createPrismaMock() {
  const adminPasswordHash = bcrypt.hashSync('admin12345', 4);
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
    roles: [] as Record<string, unknown>[],
    rolePermissions: [] as Record<string, unknown>[],
    users: [] as Record<string, unknown>[],
    userRoles: [] as Record<string, unknown>[],
    classes: [] as Record<string, unknown>[],
    students: [] as Record<string, unknown>[],
    staff: [] as Record<string, unknown>[],
    staffLeaveBalances: [] as Record<string, unknown>[],
    academicYears: [] as Record<string, unknown>[],
    chartAccounts: [] as Record<string, unknown>[],
    feeHeads: [] as Record<string, unknown>[],
    otpCodes: [] as Record<string, unknown>[],
    refreshTokens: [] as Record<string, unknown>[],
    auditLogs: [] as Record<string, unknown>[],
  };

  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}-${String(idCounter++)}`;

  function permissionByKey(permissionKey: string) {
    return state.permissions.find(
      (permission) =>
        buildPermissionKey(permission.resource, permission.action) ===
        permissionKey,
    );
  }

  function ensureTenantDefaults(tenantId: string) {
    for (const roleDefinition of SYSTEM_ROLE_DEFINITIONS) {
      if (
        !state.roles.some(
          (role) =>
            role.tenantId === tenantId && role.name === roleDefinition.name,
        )
      ) {
        state.roles.push({
          id: nextId('role'),
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
        const permission = permissionByKey(permissionKey);

        if (!permission) {
          continue;
        }

        state.rolePermissions.push({
          roleId: role.id,
          permissionId: permission.id,
        });
      }
    }
  }

  ensureTenantDefaults('tenant-default');

  const roleWithRelations = (role: Record<string, unknown>) => ({
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

  const userWithRelations = (user: Record<string, unknown>) => ({
    ...user,
    tenant: state.tenants.find((tenant) => tenant.id === user.tenantId) ?? null,
    staff: state.staff.find((member) => member.userId === user.id) ?? null,
    student:
      state.students
        .filter((student) => student.userId === user.id)
        .map((student) => ({
          ...student,
          class:
            state.classes.find(
              (classroom) => classroom.id === student.classId,
            ) ?? null,
        }))[0] ?? null,
    userRoles: state.userRoles
      .filter((membership) => membership.userId === user.id)
      .map((membership) => ({
        ...membership,
        role: roleWithRelations(
          state.roles.find((role) => role.id === membership.roleId) as Record<
            string,
            unknown
          >,
        ),
      })),
  });

  return {
    __state: state,
    tenant: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          if (where.slug) {
            return (
              state.tenants.find((tenant) => tenant.slug === where.slug) ?? null
            );
          }

          if (where.id) {
            return (
              state.tenants.find((tenant) => tenant.id === where.id) ?? null
            );
          }

          return null;
        },
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const tenant = {
          id: nextId('tenant'),
          name: data.name,
          slug: data.slug,
          plan: data.plan,
          mode: data.mode,
          isActive: true,
          createdAt: new Date(),
        };
        state.tenants.push(tenant);
        return tenant;
      }),
    },
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
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
        },
      ),
      findFirst: jest.fn(
        async ({ where }: { where: Record<string, unknown> }) => {
          const match = state.users.find(
            (user) =>
              (!where.id || user.id === where.id) &&
              (!where.tenantId || user.tenantId === where.tenantId),
          );
          return match ? userWithRelations(match) : null;
        },
      ),
      findMany: jest.fn(
        async ({ where }: { where?: Record<string, unknown> } = {}) => {
          return state.users
            .filter(
              (user) => !where.tenantId || user.tenantId === where.tenantId,
            )
            .map((user) => userWithRelations(user));
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const user = state.users.find((item) => item.id === where.id);
          if (!user) {
            throw new Error(`User ${where.id} not found`);
          }
          Object.assign(user, data);
          return userWithRelations(user);
        },
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
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
      count: jest.fn(async ({ where }: any = {}) => {
        return state.users.filter(
          (user) => !where.tenantId || user.tenantId === where.tenantId,
        ).length;
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
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existingRole = state.roles.find(
          (role) =>
            role.tenantId === where.tenantId_name.tenantId &&
            role.name === where.tenantId_name.name,
        );

        if (existingRole) {
          Object.assign(existingRole, update);
          return existingRole;
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
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existingPermission = state.permissions.find(
          (permission) =>
            permission.resource === where.resource_action.resource &&
            permission.action === where.resource_action.action,
        );

        if (existingPermission) {
          Object.assign(existingPermission, update);
          return existingPermission;
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
    class: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.tenantId_name) {
          return (
            state.classes.find(
              (classroom) =>
                classroom.tenantId === where.tenantId_name.tenantId &&
                classroom.name === where.tenantId_name.name,
            ) ?? null
          );
        }

        if (where.id) {
          return (
            state.classes.find((classroom) => classroom.id === where.id) ?? null
          );
        }

        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          state.classes.find(
            (classroom) =>
              (!where.id || classroom.id === where.id) &&
              (!where.tenantId || classroom.tenantId === where.tenantId),
          ) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return state.classes
          .filter(
            (classroom) =>
              !where.tenantId || classroom.tenantId === where.tenantId,
          )
          .map((classroom) => ({
            ...classroom,
            _count: {
              students: state.students.filter(
                (student) => student.classId === classroom.id,
              ).length,
              subjects: 0,
            },
          }));
      }),
      create: jest.fn(async ({ data }: any) => {
        const classroom = {
          id: nextId('class'),
          tenantId: data.tenantId,
          name: data.name,
          level: data.level,
        };
        state.classes.push(classroom);
        return classroom;
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return state.classes.filter(
          (classroom) =>
            !where.tenantId || classroom.tenantId === where.tenantId,
        ).length;
      }),
    },
    academicYear: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.academicYears.find(
          (year) =>
            year.tenantId === where.tenantId_name.tenantId &&
            year.name === where.tenantId_name.name,
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const academicYear = {
          id: nextId('academic-year'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        state.academicYears.push(academicYear);
        return academicYear;
      }),
    },
    chartAccount: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.chartAccounts.find(
          (account) =>
            account.tenantId === where.tenantId_code.tenantId &&
            account.code === where.tenantId_code.code,
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const chartAccount = {
          id: nextId('account'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        state.chartAccounts.push(chartAccount);
        return chartAccount;
      }),
    },
    feeHead: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.feeHeads.find(
          (head) =>
            head.tenantId === where.tenantId_code.tenantId &&
            head.code === where.tenantId_code.code,
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const feeHead = {
          id: nextId('fee-head'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        state.feeHeads.push(feeHead);
        return feeHead;
      }),
    },
    student: {
      create: jest.fn(async ({ data }: any) => {
        const student = {
          id: nextId('student'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.students.push(student);

        return {
          ...student,
          class: state.classes.find(
            (classroom) => classroom.id === data.classId,
          )!,
          user: data.userId
            ? (state.users.find((user) => user.id === data.userId) ?? null)
            : null,
        };
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return state.students
          .filter(
            (student) => !where.tenantId || student.tenantId === where.tenantId,
          )
          .map((student) => ({
            ...student,
            class: state.classes.find(
              (classroom) => classroom.id === student.classId,
            )!,
            user: student.userId
              ? (state.users.find((user) => user.id === student.userId) ?? null)
              : null,
          }));
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return state.students.filter(
          (student) => !where.tenantId || student.tenantId === where.tenantId,
        ).length;
      }),
    },
    staff: {
      findUnique: jest.fn(async ({ where }: any) => {
        return (
          state.staff.find(
            (member) => member.employeeId === where.employeeId,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const member = {
          id: nextId('staff'),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.staff.push(member);

        return {
          ...member,
          user: userWithRelations(
            state.users.find((user) => user.id === data.userId)!,
          ),
        };
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return state.staff
          .filter(
            (member) => !where.tenantId || member.tenantId === where.tenantId,
          )
          .map((member) => ({
            ...member,
            user: userWithRelations(
              state.users.find((user) => user.id === member.userId)!,
            ),
          }));
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return state.staff.filter(
          (member) => !where.tenantId || member.tenantId === where.tenantId,
        ).length;
      }),
    },
    staffLeaveBalance: {
      createMany: jest.fn(async ({ data }: any) => {
        const rows = Array.isArray(data) ? data : [data];

        for (const item of rows) {
          state.staffLeaveBalances.push({
            id: nextId('leave-balance'),
            used: 0,
            carried: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...item,
          });
        }

        return { count: rows.length };
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return state.staffLeaveBalances
          .filter(
            (balance) =>
              (!where?.tenantId || balance.tenantId === where.tenantId) &&
              (!where?.staffId || balance.staffId === where.staffId) &&
              (!where?.year || balance.year === where.year),
          )
          .map((balance) => ({
            ...balance,
            staff:
              state.staff.find((member) => member.id === balance.staffId) ??
              null,
          }));
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.tenantId_staffId_leaveType_year) {
          const key = where.tenantId_staffId_leaveType_year;
          return (
            state.staffLeaveBalances.find(
              (balance) =>
                balance.tenantId === key.tenantId &&
                balance.staffId === key.staffId &&
                balance.leaveType === key.leaveType &&
                balance.year === key.year,
            ) ?? null
          );
        }

        if (where?.id) {
          return (
            state.staffLeaveBalances.find(
              (balance) => balance.id === where.id,
            ) ?? null
          );
        }

        return null;
      }),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const key = where.tenantId_staffId_leaveType_year;
        const existing = state.staffLeaveBalances.find(
          (balance) =>
            balance.tenantId === key.tenantId &&
            balance.staffId === key.staffId &&
            balance.leaveType === key.leaveType &&
            balance.year === key.year,
        );

        if (existing) {
          applyMockUpdate(existing, update);
          existing.updatedAt = new Date();
          return existing;
        }

        const balance = {
          id: nextId('leave-balance'),
          used: 0,
          carried: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        state.staffLeaveBalances.push(balance);
        return balance;
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
          const matchesTokenHash =
            where.tokenHash === undefined ||
            token.tokenHash === where.tokenHash;
          const matchesUserId =
            where.userId === undefined || token.userId === where.userId;
          const matchesRevokedAt =
            where.revokedAt === undefined ||
            token.revokedAt === where.revokedAt;

          if (matchesTokenHash && matchesUserId && matchesRevokedAt) {
            Object.assign(token, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    otpCode: {
      create: jest.fn(async ({ data }: any) => {
        const otpCode = {
          id: nextId('otp'),
          ...data,
          usedAt: null,
          createdAt: new Date(),
        };
        state.otpCodes.push(otpCode);
        return otpCode;
      }),
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const matches = state.otpCodes.filter((otp) => {
          const notExpired = where.expiresAt?.gt
            ? otp.expiresAt > where.expiresAt.gt
            : true;
          return (
            otp.userId === where.userId &&
            otp.purpose === where.purpose &&
            (where.usedAt === undefined || otp.usedAt === where.usedAt) &&
            notExpired
          );
        });

        if (orderBy?.createdAt === 'desc') {
          matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        return matches[0] ?? null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const otp = state.otpCodes.find((entry) => entry.id === where.id);

        if (!otp) {
          throw new Error(`OTP ${where.id} not found`);
        }

        Object.assign(otp, data);
        return otp;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const otp of state.otpCodes) {
          const matchesUser =
            where.userId === undefined || otp.userId === where.userId;
          const matchesPurpose =
            where.purpose === undefined || otp.purpose === where.purpose;
          const matchesUsedAt =
            where.usedAt === undefined || otp.usedAt === where.usedAt;
          const matchesExpiry =
            where.expiresAt?.gt === undefined ||
            otp.expiresAt > where.expiresAt.gt;

          if (matchesUser && matchesPurpose && matchesUsedAt && matchesExpiry) {
            Object.assign(otp, data);
            count += 1;
          }
        }

        return { count };
      }),
      count: jest.fn(async ({ where }: any) => {
        return state.otpCodes.filter((otp) => {
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
        state.auditLogs.push(data);
        return data;
      }),
    },
  };
}
