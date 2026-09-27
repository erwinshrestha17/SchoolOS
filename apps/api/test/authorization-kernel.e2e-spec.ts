import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Param,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthMethod, SecurityDomain } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import {
  AuthorizeResource,
  ResourceOwnershipService,
} from '../src/authorization/resource-ownership';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import { ServiceAuthorization } from '../src/authorization/service-authorization.decorator';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Permissions } from '../src/auth/decorators/permissions.decorator';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { RequiredModule } from '../src/auth/decorators/required-module.decorator';
import { CurrentAuth } from '../src/auth/decorators/current-auth.decorator';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { PlatformGuard } from '../src/auth/guards/platform.guard';
import { EntitlementGuard } from '../src/auth/guards/entitlement.guard';
import type { AuthContext } from '../src/auth/auth.types';
import type { AuthenticatedRequest } from '../src/auth/auth-request.interface';
import { recordTestAuthorizationIdentity } from './helpers/authorization-test-helpers';

/** Server-defined synthetic identities; no request body supplies authority. */
@Injectable()
class FixtureAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const fixture = req.headers['x-fixture'];
    if (!fixture) return true;
    const platform = fixture === 'platform' || fixture === 'support';
    req.auth = {
      userId: 'synthetic-user',
      tenantId: 'synthetic-school',
      tenantSlug: 'school',
      email: null,
      authMethod: AuthMethod.PASSWORD,
      securityDomain: platform
        ? SecurityDomain.PLATFORM
        : SecurityDomain.SCHOOL,
      roles:
        fixture === 'platform'
          ? ['platform_super_admin']
          : fixture === 'principal'
            ? ['principal']
            : fixture === 'parent'
              ? ['parent']
              : ['teacher'],
      permissions:
        fixture === 'denied'
          ? []
          : fixture === 'platform'
            ? ['platform:dashboard:read']
            : fixture === 'parent'
              ? ['notices:read']
              : ['students:read', 'settings:manage'],
    };
    if (fixture === 'scoped' || fixture === 'scope-revoked') {
      req.auth.roles = ['admin'];
      req.auth.permissions = [];
      req.auth.accessGrants = [
        {
          assignmentId: 'scoped-assignment',
          tenantId: req.auth.tenantId,
          role: 'admin',
          permissions: ['students:read'],
          scopes: [
            {
              scopeType: 'CLASS',
              scopeId: 'assigned-class',
              effectiveFrom: new Date(0),
              expiresAt: null,
              revokedAt: fixture === 'scope-revoked' ? new Date() : null,
            },
          ],
        },
      ];
    }
    if (fixture === 'support')
      Object.assign(req.auth, {
        originalTenantId: 'original-platform',
        isSupportOverride: true,
        supportOverrideReadOnly: true,
        roles: [],
      });
    if (fixture !== 'unverified') recordTestAuthorizationIdentity(req);
    return true;
  }
}
@Controller('kernel')
@UseGuards(FixtureAuthenticationGuard, RolesPermissionsGuard)
class KernelController {
  @Get('valid') @Permissions('students:read') valid(
    @CurrentAuth() auth: AuthContext,
  ) {
    return { tenantId: auth.tenantId };
  }
  @Get('student/:id')
  @Permissions('students:read')
  @AuthorizeResource('STUDENT', 'id')
  scopedStudent(@Param('id') id: string) {
    return { id };
  }
  @Get('canonical') @Permissions('students:profile:read') canonical() {
    return { allowed: true };
  }
  @Get('missing') @Permissions('students:create') missing() {
    throw new Error('Unauthorized controller executed');
  }
  @Get('unknown') @Permissions('private:unknown:permission') unknown() {
    throw new Error('Unauthorized controller executed');
  }
  @Get('unprotected') unprotected() {
    throw new Error('Unauthorized controller executed');
  }
  @Get('roles') @Roles('principal') @Permissions('students:read') role() {
    return { allowed: true };
  }
  @Get('dynamic') @ServiceAuthorization('SETTING_KEY_WRITE') dynamic(
    @CurrentAuth() auth: AuthContext,
  ) {
    // Domain enforcement remains necessary after generic ALLOW.
    if (!auth.permissions.includes('settings:manage'))
      throw new ForbiddenException('Setting key authorization denied');
    return { allowed: true };
  }
  @Get('entitlement')
  @UseGuards(EntitlementGuard)
  @RequiredModule('students')
  @Permissions('students:read')
  entitled() {
    return { allowed: true };
  }
  @Get('failure') @Permissions('students:read') failure() {
    return { allowed: true };
  }
}
@Controller('platform-kernel')
@UseGuards(FixtureAuthenticationGuard, PlatformGuard)
class PlatformKernelController {
  @Get() @Permissions('platform:dashboard:read') valid() {
    return { allowed: true };
  }
  @Get('unprotected') unprotected() {
    throw new Error('Unauthorized platform controller executed');
  }
  @Get('unknown') @Permissions('platform:unknown:read') unknown() {
    throw new Error('Unauthorized platform controller executed');
  }
}

describe('Central authorization HTTP enforcement (synthetic authentication, real guards/kernel)', () => {
  let app: INestApplication;
  let server: Server;
  const entitlement = { canActivate: jest.fn(() => Promise.resolve(true)) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthorizationModule],
      controllers: [KernelController, PlatformKernelController],
      providers: [
        FixtureAuthenticationGuard,
        RolesPermissionsGuard,
        PlatformGuard,
        Reflector,
        { provide: EntitlementGuard, useValue: entitlement },
      ],
    })
      .overrideProvider(ResourceOwnershipService)
      .useValue({
        lookup: jest.fn((tenantId: string, _type: string, id: string) =>
          Promise.resolve(
            id === 'foreign' || id === 'missing'
              ? null
              : {
                  id,
                  tenantId,
                  scope: {
                    TENANT: tenantId,
                    STUDENT: id,
                    CLASS: id === 'assigned' ? 'assigned-class' : 'other-class',
                  },
                },
          ),
        ),
      })
      .overrideGuard(EntitlementGuard)
      .useValue(entitlement)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });
  beforeEach(() => {
    entitlement.canActivate.mockResolvedValue(true);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());
  it.each(['teacher', 'principal'])(
    'preserves school read for %s',
    async (fixture) => {
      await request(server)
        .get('/kernel/valid')
        .set('x-fixture', fixture)
        .expect(200);
    },
  );
  it('uses server-owned resource scope and denies unscoped lists', async () => {
    await request(server)
      .get('/kernel/student/assigned?tenantId=other&classId=other-class')
      .set('x-fixture', 'scoped')
      .expect(200);
    await request(server)
      .get('/kernel/valid')
      .set('x-fixture', 'scoped')
      .expect(403);
    await request(server)
      .get('/kernel/student/unassigned?classId=assigned-class')
      .set('x-fixture', 'scoped')
      .expect(403);
    await request(server)
      .get('/kernel/student/assigned')
      .set('x-fixture', 'scope-revoked')
      .expect(403);
  });
  it('returns the same safe HTTP result for foreign and absent objects', async () => {
    const foreign = await request(server)
      .get('/kernel/student/foreign')
      .set('x-fixture', 'scoped')
      .expect(404);
    const missing = await request(server)
      .get('/kernel/student/missing')
      .set('x-fixture', 'scoped')
      .expect(404);
    expect(foreign.body.message).toEqual(missing.body.message);
  });
  it('allows canonical required permissions identically', async () => {
    await request(server)
      .get('/kernel/canonical')
      .set('x-fixture', 'teacher')
      .expect(200);
  });
  it('requires authentication and live-check provenance', async () => {
    for (const fixture of ['', 'unverified']) {
      const r = await request(server)
        .get('/kernel/valid')
        .set('x-fixture', fixture)
        .expect(401);
      expect(r.body.meta.reasonCode).toBe(
        fixture ? 'USER_OR_SESSION_INACTIVE' : 'AUTHENTICATION_REQUIRED',
      );
    }
  });
  it.each([
    ['missing', 'PERMISSION_MISSING'],
    ['unknown', 'UNKNOWN_PERMISSION'],
    ['unprotected', 'POLICY_DENIED'],
    ['roles', 'ROLE_MISSING'],
  ])('denies %s before handler execution', async (path, code) => {
    const r = await request(server)
      .get(`/kernel/${path}`)
      .set('x-fixture', 'teacher')
      .expect(403);
    expect(r.body.meta.reasonCode).toBe(code);
  });
  it('preserves Principal role-gated read', async () => {
    await request(server)
      .get('/kernel/roles')
      .set('x-fixture', 'principal')
      .expect(200);
  });
  it('preserves reviewed metadata-less service authorization and its downstream denial', async () => {
    await request(server)
      .get('/kernel/dynamic')
      .set('x-fixture', 'teacher')
      .expect(200);
    await request(server)
      .get('/kernel/dynamic')
      .set('x-fixture', 'parent')
      .expect(403);
  });
  it('does not grant a Parent protected school read', async () => {
    await request(server)
      .get('/kernel/valid')
      .set('x-fixture', 'parent')
      .expect(403);
  });
  it('keeps support explicitly permissioned and excludes dynamic/Platform reads', async () => {
    await request(server)
      .get('/kernel/valid')
      .set('x-fixture', 'support')
      .expect(200);
    await request(server)
      .get('/kernel/dynamic')
      .set('x-fixture', 'support')
      .expect(403);
    await request(server)
      .get('/platform-kernel')
      .set('x-fixture', 'support')
      .expect(403);
  });
  it('requires the Platform domain, role and explicit permission, including unknown/meta-less denial', async () => {
    await request(server)
      .get('/platform-kernel')
      .set('x-fixture', 'platform')
      .expect(200);
    await request(server)
      .get('/platform-kernel')
      .set('x-fixture', 'teacher')
      .expect(403);
    await request(server)
      .get('/kernel/valid')
      .set('x-fixture', 'platform')
      .expect(403);
    for (const path of ['unknown', 'unprotected'])
      await request(server)
        .get(`/platform-kernel/${path}`)
        .set('x-fixture', 'platform')
        .expect(403);
  });
  it('preserves controlled entitlement errors and evaluates them before missing permissions', async () => {
    entitlement.canActivate.mockRejectedValueOnce(
      new ForbiddenException('School module is disabled'),
    );
    const r = await request(server)
      .get('/kernel/entitlement')
      .set('x-fixture', 'denied')
      .expect(403);
    expect(r.body.message).toBe('School module is disabled');
  });
  it('fails closed on entitlement infrastructure errors without leaking exception detail', async () => {
    const secret = 'private SQL SELECT details@example.invalid';
    entitlement.canActivate.mockRejectedValueOnce(new Error(secret));
    const r = await request(server)
      .get('/kernel/entitlement')
      .set('x-fixture', 'teacher')
      .expect(403);
    expect(r.body.meta.reasonCode).toBe('AUTHORIZATION_EVALUATION_ERROR');
    expect(JSON.stringify(r.body)).not.toContain(secret);
    expect(
      JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls),
    ).not.toContain(secret);
  });
  it('does not accept a client tenant as authenticated authority', async () => {
    const r = await request(server)
      .get('/kernel/valid?tenantId=foreign')
      .set('x-fixture', 'teacher')
      .expect(200);
    expect(r.body.tenantId).toBe('synthetic-school');
  });
  it('logs kernel denials safely through the production exception filter', async () => {
    await request(server)
      .get('/kernel/missing?private=medical-secret')
      .set('x-fixture', 'teacher')
      .expect(403);
    const logs = JSON.stringify(
      (Logger.prototype.error as jest.Mock).mock.calls,
    );
    expect(logs).toContain('PERMISSION_MISSING');
    expect(logs).not.toContain('medical-secret');
    expect(logs).not.toContain('stack');
  });
  it('uses the injectable central service instead of bypassing its decision', async () => {
    const spy = jest
      .spyOn(app.get(AuthorizationService), 'evaluate')
      .mockResolvedValue({
        outcome: 'DENY',
        reasonCode: 'POLICY_DENIED',
        stage: 'LIFECYCLE',
        policyId: 'test.deny',
      });
    const r = await request(server)
      .get('/kernel/failure')
      .set('x-fixture', 'teacher')
      .expect(403);
    expect(r.body.meta.reasonCode).toBe('POLICY_DENIED');
    expect(spy).toHaveBeenCalled();
  });
});
