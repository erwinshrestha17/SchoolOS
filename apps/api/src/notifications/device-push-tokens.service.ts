import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { FEATURE_KEYS } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../common/security/field-encryption';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { RegisterDevicePushTokenDto } from './dto/register-device-push-token.dto';
import { NotificationsService } from './notifications.service';

const SUPPORTED_MOBILE_ROLES = new Set([
  'admin',
  'principal',
  'head_teacher',
  'parent',
  'guardian',
  'teacher',
  'class_teacher',
  'subject_teacher',
  'driver',
  'transport',
  'staff',
  'accountant',
  'librarian',
  'receptionist',
  'support_staff',
  'hr',
  'hr_manager',
  'finance',
  'finance_officer',
]);

@Injectable()
export class DevicePushTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly plansService: PlansService,
  ) {}

  async register(dto: RegisterDevicePushTokenDto, actor: AuthContext) {
    await this.assertSupportedPersonaEntitlement(actor);

    const tokenHash = hashPushToken(dto.token);
    const existingToken = await this.prisma.mobilePushToken.findFirst({
      where: {
        tenantId: actor.tenantId,
        tokenHash,
      },
      select: {
        userId: true,
        installationId: true,
      },
    });

    if (
      existingToken &&
      (existingToken.userId !== actor.userId ||
        existingToken.installationId !== dto.installationId)
    ) {
      throw new ConflictException(
        'This device token is already owned by another active mobile session.',
      );
    }

    const tokenEncrypted = encryptPushToken(
      dto.token,
      this.configService.jwtSecret,
    );
    const token = await this.prisma.mobilePushToken.upsert({
      where: {
        tenantId_userId_installationId: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          installationId: dto.installationId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        installationId: dto.installationId,
        tokenHash,
        tokenEncrypted,
        platform: dto.platform,
        appVersion: normalizeOptionalText(dto.appVersion),
        deviceModel: normalizeOptionalText(dto.deviceModel),
        lastSeenAt: new Date(),
      },
      update: {
        tokenHash,
        tokenEncrypted,
        platform: dto.platform,
        appVersion: normalizeOptionalText(dto.appVersion),
        deviceModel: normalizeOptionalText(dto.deviceModel),
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        installationId: true,
        platform: true,
        lastSeenAt: true,
      },
    });

    const readiness = await this.notificationsService.getProviderReadiness(
      NotificationChannel.PUSH,
    );

    await this.auditService.record({
      action: 'register',
      resource: 'mobile_push_token',
      resourceId: token.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        installationId: token.installationId,
        platform: token.platform,
        providerEnabled: readiness.enabled,
        providerFailureCode: readiness.failureCode,
      },
    });

    return {
      registered: true,
      installationId: token.installationId,
      platform: token.platform,
      lastSeenAt: token.lastSeenAt.toISOString(),
      provider: readiness,
    };
  }

  async revoke(
    installationId: string,
    actor: AuthContext,
    reason = 'user_logout',
  ) {
    await this.assertSupportedPersonaEntitlement(actor);

    const result = await this.prisma.mobilePushToken.deleteMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        installationId,
      },
    });

    if (result.count > 0) {
      await this.auditService.record({
        action: 'revoke',
        resource: 'mobile_push_token',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: { installationId, reason },
      });
    }

    return {
      revoked: result.count > 0,
    };
  }

  async listActiveTokens(tenantId: string, userId: string) {
    const rows = await this.prisma.mobilePushToken.findMany({
      where: {
        tenantId,
        userId,
      },
      select: {
        tokenEncrypted: true,
      },
      orderBy: [{ lastSeenAt: 'desc' }],
      take: 20,
    });

    return rows
      .map((row) =>
        decryptSensitiveField(row.tokenEncrypted, this.configService.jwtSecret),
      )
      .filter((token): token is string => Boolean(token));
  }

  private async assertSupportedPersonaEntitlement(actor: AuthContext) {
    const roles = actor.roles.map(normalizeRole);
    const featureKey = mobileFeatureForRoles(roles);

    if (!featureKey || actor.tenantId === 'platform') {
      throw new ForbiddenException(
        'Push notifications are not available for this mobile persona.',
      );
    }

    const entitlement = await this.plansService.checkFeatureEnabled(
      actor.tenantId,
      featureKey,
    );
    if (!entitlement.allowed) {
      throw new ForbiddenException(
        entitlement.message ??
          'Push notifications are not included in this school plan.',
      );
    }
  }
}

function hashPushToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function encryptPushToken(token: string, secret: string) {
  const encrypted = encryptSensitiveField(token, secret);
  if (!encrypted) {
    throw new Error('Push token encryption failed');
  }
  return encrypted;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized?.length ? normalized : null;
}

function mobileFeatureForRoles(roles: string[]) {
  if (
    roles.some((role) => ['admin', 'principal', 'head_teacher'].includes(role))
  ) {
    return FEATURE_KEYS.MOBILE_FULL_ROLE;
  }
  if (
    roles.some((role) =>
      ['teacher', 'class_teacher', 'subject_teacher'].includes(role),
    )
  ) {
    return FEATURE_KEYS.MOBILE_TEACHER_PARENT;
  }
  if (roles.some((role) => ['parent', 'guardian'].includes(role))) {
    return FEATURE_KEYS.MOBILE_PARENT_BASIC;
  }
  if (roles.some((role) => SUPPORTED_MOBILE_ROLES.has(role))) {
    return FEATURE_KEYS.MOBILE_FULL_ROLE;
  }
  return null;
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase().replaceAll('-', '_');
}
