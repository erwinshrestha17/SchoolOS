import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildSchoolSettingsDomainVersion,
  canWriteSchoolSettingKey,
  getSchoolSettingsDomainForKey,
  getSchoolSettingsKeysForDomain,
  isPrincipalRestrictedFromInstitutionalSettings,
  type SchoolSettingsDomain,
  type TenantSettingKey,
  type TenantSettingSummary,
  type UpdateSchoolSettingsDomainResult,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSchoolSettingsDomainDto } from './dto/update-school-settings-domain.dto';
import { validateSchoolSettingValue } from './settings-value-validation';

const SCHOOL_SETTINGS_DOMAINS: readonly SchoolSettingsDomain[] = [
  'identity',
  'academic',
  'attendance',
  'finance',
  'hr',
  'accounting',
  'communication',
  'security',
];

@Injectable()
export class SettingsDomainMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async updateDomain(
    rawDomain: string,
    dto: UpdateSchoolSettingsDomainDto,
    auth: AuthContext,
  ): Promise<UpdateSchoolSettingsDomainResult> {
    const domain = this.parseDomain(rawDomain);
    if (isPrincipalRestrictedFromInstitutionalSettings(auth.roles)) {
      throw new ForbiddenException(
        'Institutional settings require School Configuration Owner access.',
      );
    }

    const reason = dto.reason.trim();
    const seenKeys = new Set<string>();
    const changes = dto.changes.map((change) => {
      const key = change.key as TenantSettingKey;
      if (seenKeys.has(key)) {
        throw new BadRequestException(`Duplicate school setting key: ${key}`);
      }
      seenKeys.add(key);

      if (key === 'school_logo') {
        throw new BadRequestException(
          'School logo must be updated through the protected branding upload workflow.',
        );
      }
      if (getSchoolSettingsDomainForKey(key) !== domain) {
        throw new BadRequestException(
          `School setting ${key} does not belong to the ${domain} domain.`,
        );
      }
      if (!canWriteSchoolSettingKey(auth.permissions, key)) {
        throw new ForbiddenException(
          'Your role cannot change one or more settings in this school policy.',
        );
      }
      validateSchoolSettingValue(key, change.value);
      return {
        key,
        value: change.value as Prisma.InputJsonValue,
      };
    });

    const requestFingerprint = this.buildRequestFingerprint(
      domain,
      dto.expectedVersion,
      reason,
      changes,
    );
    const domainKeys = [...getSchoolSettingsKeysForDomain(domain)];
    const lockKey = `${auth.tenantId}:settings:${dto.idempotencyKey}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );

      const prior = await tx.auditLog.findFirst({
        where: {
          tenantId: auth.tenantId,
          action: 'settings_domain_updated',
          resource: 'settings_domain',
          requestId: dto.idempotencyKey,
        },
        select: {
          resourceId: true,
          after: true,
        },
      });
      if (prior) {
        if (prior.resourceId !== domain) {
          throw new ConflictException(
            'This settings request key was already used for another policy update.',
          );
        }
        const replay = this.parseReplay(
          prior.after,
          domain,
          requestFingerprint,
        );
        if (!replay) {
          throw new ConflictException(
            'This settings request key was already used with a different payload. Refresh before trying again.',
          );
        }
        return replay;
      }

      const beforeRows = await tx.tenantSetting.findMany({
        where: {
          tenantId: auth.tenantId,
          key: { in: domainKeys },
        },
        select: { key: true, value: true, updatedAt: true },
      });
      const currentVersion = buildSchoolSettingsDomainVersion(
        this.toSummaries(beforeRows),
        domain,
      );
      if (dto.expectedVersion !== currentVersion) {
        throw new ConflictException(
          'School settings changed since this page loaded. Refresh and review the latest values.',
        );
      }

      for (const change of changes) {
        await tx.tenantSetting.upsert({
          where: {
            tenantId_key: { tenantId: auth.tenantId, key: change.key },
          },
          create: {
            tenantId: auth.tenantId,
            key: change.key,
            value: change.value,
          },
          update: { value: change.value },
        });
      }

      const afterRows = await tx.tenantSetting.findMany({
        where: {
          tenantId: auth.tenantId,
          key: { in: domainKeys },
        },
        select: { key: true, value: true, updatedAt: true },
      });
      const nextVersion = buildSchoolSettingsDomainVersion(
        this.toSummaries(afterRows),
        domain,
      );
      const changedKeys = changes.map(({ key }) => key);

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'settings_domain_updated',
          resource: 'settings_domain',
          resourceId: domain,
          requestId: dto.idempotencyKey,
          before: {
            version: currentVersion,
            changedKeys,
          },
          after: {
            version: nextVersion,
            changedKeys,
            reason,
            requestFingerprint,
          },
        },
      });

      return {
        success: true,
        domain,
        changedKeys,
        version: nextVersion,
        replayed: false,
      };
    });
  }

  private parseDomain(value: string): SchoolSettingsDomain {
    if (!SCHOOL_SETTINGS_DOMAINS.includes(value as SchoolSettingsDomain)) {
      throw new BadRequestException('Unknown school settings domain.');
    }
    return value as SchoolSettingsDomain;
  }

  private toSummaries(
    rows: Array<{
      key: string;
      value: Prisma.JsonValue;
      updatedAt: Date;
    }>,
  ): TenantSettingSummary[] {
    return rows.map((row) => ({
      key: row.key as TenantSettingKey,
      value: row.value,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private buildRequestFingerprint(
    domain: SchoolSettingsDomain,
    expectedVersion: string,
    reason: string,
    changes: Array<{ key: TenantSettingKey; value: Prisma.InputJsonValue }>,
  ): string {
    const canonicalChanges = [...changes].sort((left, right) =>
      left.key.localeCompare(right.key),
    );
    return createHash('sha256')
      .update(
        JSON.stringify({
          domain,
          expectedVersion,
          reason,
          changes: canonicalChanges,
        }),
      )
      .digest('hex');
  }

  private parseReplay(
    value: Prisma.JsonValue | null,
    domain: SchoolSettingsDomain,
    requestFingerprint: string,
  ): UpdateSchoolSettingsDomainResult | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const record = value as Record<string, Prisma.JsonValue>;
    const version = record.version;
    const changedKeys = record.changedKeys;
    const priorFingerprint = record.requestFingerprint;
    if (
      priorFingerprint !== requestFingerprint ||
      typeof version !== 'string' ||
      !Array.isArray(changedKeys) ||
      !changedKeys.every((key) => typeof key === 'string')
    ) {
      return null;
    }
    return {
      success: true,
      domain,
      changedKeys: changedKeys as TenantSettingKey[],
      version,
      replayed: true,
    };
  }
}
