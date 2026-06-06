import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthenticatedRequest } from '../src/auth/auth-request.interface';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { ClassesController } from '../src/classes/classes.controller';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AuthContext } from '../src/auth/auth.types';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { StaffController } from '../src/staff/staff.controller';
import { StudentsController } from '../src/students/students.controller';
import { TenantsController } from '../src/tenants/tenants.controller';
import { UsersController } from '../src/users/users.controller';
import {
  PrismaMock,
  createRequestMock,
  createResponseMock,
  createQueueMock,
  buildCookieHeader,
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
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
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
        sendAuthCodeEmail: jest.fn(
          (payload: {
            to: string;
            code: string;
            purpose: 'login' | 'password_recovery' | 'mfa_setup';
          }) => {
            sentCodes.push({
              to: payload.to,
              code: payload.code,
              purpose: payload.purpose,
            });
            return Promise.resolve();
          },
        ),
        sendEmail: jest.fn(),
      })
      .compile();

    authController = moduleRef.get(AuthController);
    classesController = moduleRef.get(ClassesController);
    staffController = moduleRef.get(StaffController);
    studentsController = moduleRef.get(StudentsController);
    tenantsController = moduleRef.get(TenantsController);
    usersController = moduleRef.get(UsersController);
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
      (await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'admin@greenvalley.com',
          password: 'admin12345',
        },
        adminResponse as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { accessToken: string; user: unknown },
    );

    expect((adminLogin as { user: { roles: string[] } }).user.roles).toContain(
      'admin',
    );

    const adminRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      adminLogin.accessToken,
      TenantsController.prototype.getCurrentTenant as unknown as (
        ...args: unknown[]
      ) => unknown,
      TenantsController as unknown as new (...args: unknown[]) => unknown,
    );

    const adminProfile = await authController.me(
      adminRequest.auth as unknown as AuthContext,
    );
    expect(adminProfile.tenant.slug).toBe('green-valley');

    const tenantSummary = await tenantsController.getCurrentTenant(
      adminRequest.auth as unknown as AuthContext,
    );
    expect(tenantSummary.counts.users).toBe(1);

    const createdClass = await classesController.createClass(
      {
        name: 'Class 6',
        level: 6,
      },
      adminRequest.auth as unknown as AuthContext,
    );
    expect(createdClass.name).toBe('Class 6');

    const teacherRole = prisma.__state.roles.find(
      (role) =>
        role.tenantId === registration.tenant.id && role.name === 'teacher',
    );
    expect(teacherRole).toBeDefined();

    if (!teacherRole?.id) throw new Error('Teacher role not found');

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
        roleIds: [teacherRole.id as string],
      },
      adminRequest.auth as unknown as AuthContext,
    );

    expect(createdStaff.email).toBe('teacher@greenvalley.com');

    const teacherResponse = createResponseMock();
    const teacherLogin = asSession(
      (await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        teacherResponse as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { accessToken: string; user: unknown },
    );

    const teacherPasswordRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      teacherLogin.accessToken,
      AuthController.prototype.me as unknown as (...args: unknown[]) => unknown,
      AuthController as unknown as new (...args: unknown[]) => unknown,
    );

    const mfaSetupRequest = await authController.requestMfaSetup(
      teacherPasswordRequest.auth as unknown as AuthContext,
    );
    expect(mfaSetupRequest).toEqual({ success: true });

    const teacherSetupCode = getLatestCode(
      sentCodes,
      'teacher@greenvalley.com',
      'mfa_setup',
    );

    const mfaSetupConfirmation = await authController.confirmMfaSetup(
      teacherPasswordRequest.auth as unknown as AuthContext,
      {
        code: teacherSetupCode,
        authMethod: 'BOTH',
      },
    );
    expect(mfaSetupConfirmation.authMethod).toBe('BOTH');

    const teacherMfaChallenge = asChallenge(
      (await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        createResponseMock() as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { requiresMfa: boolean; challengeToken: string },
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
      teacherVerifiedResponse as unknown as Response,
      createRequestMock() as unknown as AuthenticatedRequest,
    );
    expect(teacherVerifiedLogin.accessToken).toBeTruthy();

    const teacherRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      teacherVerifiedLogin.accessToken!,
      ClassesController.prototype.listClasses as unknown as (
        ...args: unknown[]
      ) => unknown,
      ClassesController as unknown as new (...args: unknown[]) => unknown,
    );
    const teacherClasses = await classesController.listClasses(
      teacherRequest.auth as unknown as AuthContext,
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
      adminRequest.auth as unknown as AuthContext,
    );

    expect(createdStudent.hasLogin).toBe(true);

    const studentResponse = createResponseMock();
    const studentLogin = asSession(
      (await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'student@greenvalley.com',
          password: 'student12345',
        },
        studentResponse as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { accessToken: string; user: unknown },
    );

    expect(
      (studentLogin as { user: { roles: string[] } }).user.roles,
    ).toContain('student');

    const studentPasswordRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      studentLogin.accessToken,
      AuthController.prototype.me as unknown as (...args: unknown[]) => unknown,
      AuthController as unknown as new (...args: unknown[]) => unknown,
    );
    const studentProfile = await authController.me(
      studentPasswordRequest.auth as unknown as AuthContext,
    );
    expect(studentProfile.profileType).toBe('student');

    await authController.requestMfaSetup(
      studentPasswordRequest.auth as unknown as AuthContext,
    );
    const studentSetupCode = getLatestCode(
      sentCodes,
      'student@greenvalley.com',
      'mfa_setup',
    );
    const studentMfaConfirmation = await authController.confirmMfaSetup(
      studentPasswordRequest.auth as unknown as AuthContext,
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
        createResponseMock() as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
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
      studentOtpResponse as unknown as Response,
      createRequestMock() as unknown as AuthenticatedRequest,
    );
    expect(studentOtpLogin.accessToken).toBeTruthy();

    const listedUsers = await usersController.listUsers(
      adminRequest.auth as unknown as AuthContext,
    );
    expect(listedUsers).toHaveLength(3);

    const teacherUser = listedUsers.find(
      (user) => user.email === 'teacher@greenvalley.com',
    );
    expect(teacherUser).toBeDefined();

    const suspendedTeacher = await usersController.updateStatus(
      teacherUser?.id ?? '',
      {
        status: 'SUSPENDED',
      },
      adminRequest.auth as unknown as AuthContext,
    );
    expect(suspendedTeacher.status).toBe('SUSPENDED');

    await expect(
      authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher12345',
        },
        createResponseMock() as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const reactivatedTeacher = await usersController.updateStatus(
      teacherUser?.id ?? '',
      {
        status: 'ACTIVE',
      },
      adminRequest.auth as unknown as AuthContext,
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
        createResponseMock() as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const teacherPostRecoveryChallenge = asChallenge(
      (await authController.login(
        {
          tenantSlug: 'green-valley',
          email: 'teacher@greenvalley.com',
          password: 'teacher99999',
        },
        createResponseMock() as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { requiresMfa: boolean; challengeToken: string },
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
      (await authController.login(
        {
          tenantSlug: 'blue-ridge',
          email: 'admin@blueridge.com',
          password: 'admin12345',
        },
        secondTenantResponse as unknown as Response,
        createRequestMock() as unknown as AuthenticatedRequest,
      )) as { accessToken: string; user: unknown },
    );

    const secondTenantRequest = await authenticateRequest(
      jwtAuthGuard,
      rolesGuard,
      secondTenantLogin.accessToken,
      UsersController.prototype.updateStatus as unknown as (
        ...args: unknown[]
      ) => unknown,
      UsersController as unknown as new (...args: unknown[]) => unknown,
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
        secondTenantRequest.auth as unknown as AuthContext,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      classesController.listClasses(
        secondTenantRequest.auth as unknown as AuthContext,
      ),
    ).resolves.toHaveLength(0);

    await expect(
      studentsController.listStudents(
        {},
        secondTenantRequest.auth as unknown as AuthContext,
      ),
    ).resolves.toMatchObject({ items: [], total: 0 });

    await expect(
      usersController.updateStatus(
        teacherUser?.id ?? '',
        { status: 'ACTIVE' },
        secondTenantRequest.auth as unknown as AuthContext,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const refreshResponse = createResponseMock();
    const refreshed = await authController.refresh(
      {},
      refreshResponse as unknown as Response,
      buildCookieHeader(adminResponse.cookieCalls, 'school_os_refresh_token'),
      createRequestMock() as unknown as AuthenticatedRequest,
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
      logoutResponse as unknown as Response,
      rotatedCookie,
      createRequestMock() as unknown as AuthenticatedRequest,
    );

    expect(logoutResult).toEqual({ success: true });

    await expect(
      authController.refresh(
        {},
        createResponseMock() as unknown as Response,
        rotatedCookie,
        createRequestMock() as unknown as AuthenticatedRequest,
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
    | { accessToken?: string; user: unknown }
    | { requiresMfa: boolean; challengeToken: string },
) {
  if (!('accessToken' in result) || !result.accessToken) {
    throw new Error('Expected a session response');
  }

  return result as { accessToken: string; user: unknown };
}

function asChallenge(
  result:
    | { accessToken?: string; user: unknown }
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
): Promise<AuthenticatedRequest> {
  const request = {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'schoolos-mobile-flutter-test',
    },
  } as unknown as AuthenticatedRequest;

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as unknown as ExecutionContext;

  const cls = (
    jwtAuthGuard as unknown as {
      cls: {
        run: (
          fn: () => Promise<AuthenticatedRequest>,
        ) => Promise<AuthenticatedRequest>;
      };
    }
  ).cls;

  return cls.run(async () => {
    await jwtAuthGuard.canActivate(context);
    await rolesGuard.canActivate(context);

    return request;
  });
}
