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
  createResponseMock, createQueueMock,
  applyMockUpdate,
  buildCookieHeader,
  createAuthContextMock,
  createPrismaMock,
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

    expect((adminLogin as any).user.roles).toContain('admin');

    const adminRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      adminLogin.accessToken,
      TenantsController.prototype.getCurrentTenant as any,
      TenantsController as any,
    );

    const adminProfile = await authController.me(adminRequest.auth as any);
    expect(adminProfile.tenant.slug).toBe('green-valley');

    const tenantSummary = await tenantsController.getCurrentTenant(
      adminRequest.auth as any,
    );
    expect(tenantSummary.counts.users).toBe(1);

    const createdClass = await classesController.createClass(
      {
        name: 'Class 6',
        level: 6,
      },
      adminRequest.auth as any,
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
      adminRequest.auth as any,
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
      AuthController.prototype.me as any,
      AuthController as any,
    );

    const mfaSetupRequest = await authController.requestMfaSetup(
      teacherPasswordRequest.auth as any,
    );
    expect(mfaSetupRequest).toEqual({ success: true });

    const teacherSetupCode = getLatestCode(
      sentCodes,
      'teacher@greenvalley.com',
      'mfa_setup',
    );

    const mfaSetupConfirmation = await authController.confirmMfaSetup(
      teacherPasswordRequest.auth as any,
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
      ClassesController.prototype.listClasses as any,
      ClassesController as any,
    );
    const teacherClasses = await classesController.listClasses(
      teacherRequest.auth as any,
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
      adminRequest.auth as any,
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

    expect((studentLogin as any).user.roles).toContain('student');

    const studentPasswordRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      studentLogin.accessToken,
      AuthController.prototype.me as any,
      AuthController as any,
    );
    const studentProfile = await authController.me(studentPasswordRequest.auth as any);
    expect(studentProfile.profileType).toBe('student');

    await authController.requestMfaSetup(studentPasswordRequest.auth as any);
    const studentSetupCode = getLatestCode(
      sentCodes,
      'student@greenvalley.com',
      'mfa_setup',
    );
    const studentMfaConfirmation = await authController.confirmMfaSetup(
      studentPasswordRequest.auth as any,
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

    const listedUsers = await usersController.listUsers(adminRequest.auth as any);
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
      adminRequest.auth as any,
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
      adminRequest.auth as any,
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
      UsersController.prototype.updateStatus as any,
      UsersController as any,
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
        secondTenantRequest.auth as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      classesController.listClasses(secondTenantRequest.auth as any),
    ).resolves.toHaveLength(0);

    await expect(
      studentsController.listStudents(secondTenantRequest.auth as any),
    ).resolves.toHaveLength(0);

    await expect(
      usersController.updateStatus(
        teacherUser!.id,
        { status: 'ACTIVE' },
        secondTenantRequest.auth as any,
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

import type { AuthenticatedRequest } from '../src/auth/auth-request.interface';

async function authenticateRequest(
  jwtAuthGuard: JwtAuthGuard,
  rolesGuard: RolesPermissionsGuard,
  accessToken: string,
  handler: (...args: unknown[]) => unknown,
  controllerClass: new (...args: unknown[]) => unknown,
): Promise<AuthenticatedRequest> {
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

  const cls = (
    jwtAuthGuard as any
  ).cls;

  return cls.run(async () => {
    await jwtAuthGuard.canActivate(context);
    await rolesGuard.canActivate(context);

    return request as AuthenticatedRequest;
  });
}

