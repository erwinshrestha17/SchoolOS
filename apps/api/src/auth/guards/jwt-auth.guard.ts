import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../../audit/audit.service';
import { ConfigService } from '../../config/config.service';
import { PrismaService, TENANT_ID_KEY } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth-request.interface';
import { AuthContext, JwtAccessPayload } from '../auth.types';
import { parseCookie } from '../auth.utils';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { AuthzCacheService } from '../authz-cache.service';
import { RequestCacheService } from '../../common/cache/request-cache.service';
import {
  isPlatformRoleName,
  isSupportOverrideScope,
  resolveSupportOverridePermissions,
  type SupportOverrideScope,
} from '@schoolos/core';
import { SecurityDomain } from '@prisma/client';
import { SUPPORT_OVERRIDE_READ_SCOPES_KEY } from '../decorators/allow-support-override-read.decorator';

const READ_ONLY_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly mustChangePasswordGuard: MustChangePasswordGuard,
    private readonly authzCache: AuthzCacheService,
    private readonly requestCache: RequestCacheService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.resolveAccessToken(request);

    let payload: JwtAccessPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.configService.jwtSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.iss !== this.configService.jwtIssuer) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    const userAgent = request.headers['user-agent']?.toLowerCase() ?? '';
    const isMobile =
      userAgent.includes('dart') || userAgent.includes('flutter');
    const expectedAudience = isMobile
      ? this.configService.jwtAudienceMobile
      : this.configService.jwtAudienceWeb;

    if (payload.aud !== expectedAudience) {
      throw new UnauthorizedException('Invalid token audience');
    }

    // Authentication necessarily precedes tenant context: the tenant is only
    // trusted once this user is resolved and checked against the token below.
    // (RefreshToken/OtpCode/Tenant are tenant-scope-excluded for the same
    // reason; User is not, so the region is declared explicitly here.)
    const user = await this.prisma.runWithoutTenantScope(
      'authenticate: resolve token subject before tenant context exists',
      () =>
        // Liveness only, and never cached: deactivating an account or
        // suspending a tenant must fail closed on the very next request.
        // The previous `include: { tenant: true }` also pulled every column of
        // both rows — including `passwordHash` — into process memory on every
        // request; this selects only what the guard uses.
        this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            status: true,
            tenantId: true,
            mustChangePassword: true,
            tenant: {
              select: {
                id: true,
                slug: true,
                isActive: true,
                securityDomain: true,
              },
            },
          },
        }),
    );

    if (user?.status !== 'ACTIVE' || !user.tenant.isActive) {
      throw new UnauthorizedException('User or tenant is inactive');
    }

    if (user.tenantId !== payload.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    // Roles and permissions are derived, slow-changing data with an explicit
    // invalidation contract (see AuthzCacheService). Resolving them here
    // replaces four nested-include round-trips on every authenticated request.
    let { roles, permissions: permissionKeys } = await this.authzCache.resolve(
      payload.tenantId,
      user.id,
      user.tenant.securityDomain,
    );

    if (
      user.tenant.securityDomain === SecurityDomain.SCHOOL &&
      roles.some(isPlatformRoleName)
    ) {
      throw new ForbiddenException(
        'Platform roles are invalid in the school security domain',
      );
    }

    const overrideTenantId = resolveHeader(
      request.headers['x-schoolos-tenant-id'],
    );
    const overrideReason = resolveHeader(
      request.headers['x-schoolos-tenant-override-reason'],
    );
    const overrideId = resolveHeader(
      request.headers['x-schoolos-support-override-id'],
    );
    const isPlatformUser =
      user.tenant.securityDomain === SecurityDomain.PLATFORM &&
      roles.includes('platform_super_admin');

    let effectiveTenantId = payload.tenantId;
    let effectiveTenantSlug = user.tenant.slug;
    let supportOverrideScopes: AuthContext['supportOverrideScopes'];
    let supportOverrideReadOnly: boolean | undefined;

    if (overrideTenantId) {
      if (!overrideId) {
        throw new ForbiddenException(
          'Tenant override requires the active support session identifier',
        );
      }
      if (!isPlatformUser) {
        throw new ForbiddenException(
          'Tenant override requires platform super admin',
        );
      }

      const activeOverride = await this.prisma.runWithoutTenantScope(
        'authenticate: resolve a purpose-limited support override before target tenant context exists',
        () =>
          this.prisma.supportOverride.findFirst({
            where: {
              id: overrideId,
              platformUserId: user.id,
              tenantId: overrideTenantId,
              isActive: true,
              expiresAt: { gt: new Date() },
            },
            select: {
              id: true,
              reason: true,
              permissionScopes: true,
              readOnly: true,
              expiresAt: true,
            },
          }),
      );

      if (!activeOverride) {
        throw new ForbiddenException(
          'No active support override session found or session expired',
        );
      }

      const reason = overrideReason?.trim();
      if (
        !reason ||
        reason.length < 5 ||
        reason !== activeOverride.reason.trim()
      ) {
        throw new ForbiddenException(
          'Tenant override reason does not match the active support session',
        );
      }

      const approvedScopes = activeOverride.permissionScopes.filter(
        isSupportOverrideScope,
      );
      if (
        !activeOverride.readOnly ||
        approvedScopes.length === 0 ||
        approvedScopes.length !== activeOverride.permissionScopes.length
      ) {
        throw new ForbiddenException(
          'Support override is missing an approved read-only scope',
        );
      }

      if (
        !READ_ONLY_HTTP_METHODS.has((request.method ?? 'GET').toUpperCase())
      ) {
        throw new ForbiddenException('Support override is read-only');
      }

      const effectiveTenant =
        await this.resolveOverrideTenant(overrideTenantId);
      const routeScopes =
        this.reflector.getAllAndOverride<SupportOverrideScope[]>(
          SUPPORT_OVERRIDE_READ_SCOPES_KEY,
          [context.getHandler()],
        ) ?? [];
      if (!routeScopes.some((scope) => approvedScopes.includes(scope))) {
        await this.auditService.record({
          action: 'tenant_override_denied',
          resource: 'auth',
          tenantId: payload.tenantId,
          userId: user.id,
          after: {
            originalTenantId: payload.tenantId,
            requestedTenantId: overrideTenantId,
            reason,
            permissionScopes: approvedScopes,
            readOnly: true,
            overrideId: activeOverride.id,
            requestMethod: (request.method ?? 'GET').toUpperCase(),
            routeController: context.getClass().name || 'anonymous',
            routeHandler: context.getHandler().name || 'anonymous',
            denialReason: 'route_not_approved_for_support_override',
          },
        });
        throw new ForbiddenException(
          'Support override is not approved for this route',
        );
      }

      supportOverrideScopes = approvedScopes;
      supportOverrideReadOnly = true;
      roles = [];
      permissionKeys = resolveSupportOverridePermissions(supportOverrideScopes);

      await this.auditService.record({
        action: 'tenant_override',
        resource: 'auth',
        tenantId: payload.tenantId,
        userId: user.id,
        after: {
          originalTenantId: payload.tenantId,
          effectiveTenantId: overrideTenantId,
          reason,
          permissionScopes: supportOverrideScopes,
          readOnly: true,
          overrideId: activeOverride.id,
          requestMethod: (request.method ?? 'GET').toUpperCase(),
          routeController: context.getClass().name || 'anonymous',
          routeHandler: context.getHandler().name || 'anonymous',
        },
      });

      effectiveTenantId = effectiveTenant.id;
      effectiveTenantSlug = effectiveTenant.slug;
    } else if (overrideReason || overrideId) {
      throw new ForbiddenException(
        'Support override headers require an active target tenant header',
      );
    }

    request.auth = {
      userId: user.id,
      tenantId: effectiveTenantId,
      originalTenantId: payload.tenantId,
      isSupportOverride: effectiveTenantId !== payload.tenantId,
      supportOverrideScopes,
      supportOverrideReadOnly,
      securityDomain: user.tenant.securityDomain,
      tenantSlug: effectiveTenantSlug,
      email: user.email,
      authMethod: payload.authMethod,
      mustChangePassword: user.mustChangePassword,
      roles: Array.from(new Set(roles)),
      permissions: Array.from(new Set(permissionKeys)),
    };
    const hasActiveCls =
      typeof this.cls.isActive === 'function' ? this.cls.isActive() : true;

    if (hasActiveCls) {
      this.cls.set(TENANT_ID_KEY, effectiveTenantId);

      // EntitlementGuard reads the same `{ id, isActive }` projection of this
      // tenant immediately after, via PlansService.getTenantStatus. Priming the
      // request-scoped memo with the row just read live saves that query
      // without weakening anything: it is the same read, in the same request.
      //
      // Only for the caller's own tenant. Under a support override the
      // effective tenant is a different row that was validated separately, so
      // seeding this key would answer a later lookup with the wrong tenant.
      if (effectiveTenantId === user.tenantId) {
        this.requestCache.seed(`tenantStatus:${user.tenantId}`, {
          id: user.tenantId,
          isActive: user.tenant.isActive,
        });
      }
    }

    this.mustChangePasswordGuard.canActivate(context);

    return true;
  }

  private resolveAccessToken(request: AuthenticatedRequest) {
    const header = request.headers.authorization;

    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const cookieToken = parseCookie(
      resolveHeader(request.headers.cookie),
      this.configService.accessCookieName,
    );

    if (cookieToken) {
      return cookieToken;
    }

    throw new UnauthorizedException('Missing access token');
  }

  private async resolveOverrideTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        isActive: true,
        securityDomain: true,
      },
    });

    if (!tenant?.isActive || tenant.securityDomain !== SecurityDomain.SCHOOL) {
      throw new ForbiddenException('Tenant override is not allowed');
    }

    return tenant;
  }
}

function resolveHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
