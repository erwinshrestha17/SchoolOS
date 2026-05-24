import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type {
  PlatformApiKeyCreated,
  PlatformApiKeySummary,
} from '@schoolos/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePlatformApiKeyDto,
  RevokePlatformApiKeyDto,
} from './dto/platform-core.dto';

const SECRET_PREFIX = 'sk_schoolos_';
const MAX_SCOPES = 25;

type ApiKeyRecord = {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  keySuffix: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PlatformApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listApiKeys(tenantId: string): Promise<PlatformApiKeySummary[]> {
    await this.ensureTenant(tenantId);
    const keys = await this.prisma.platformApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: this.safeSelect(),
    });

    return keys.map((key) => this.toSummary(key));
  }

  async createApiKey(
    tenantId: string,
    dto: CreatePlatformApiKeyDto,
    actorUserId: string,
  ): Promise<PlatformApiKeyCreated> {
    await this.ensureTenant(tenantId);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('API key expiry must be in the future');
    }

    const scopes = this.normalizeScopes(dto.scopes);
    const { secret, created } = await this.createUniqueKeyRecord({
      tenantId,
      name: dto.name.trim(),
      scopes,
      expiresAt,
      actorUserId,
    });

    await this.auditService.record({
      action: 'platform_api_key_created',
      resource: 'api_keys',
      tenantId,
      userId: actorUserId,
      resourceId: created.id,
      after: {
        tenantId,
        name: created.name,
        prefix: created.prefix,
        scopes: created.scopes,
        expiresAt: created.expiresAt?.toISOString() ?? null,
      },
    });

    return {
      ...this.toSummary(created),
      secret,
    };
  }

  async revokeApiKey(
    tenantId: string,
    apiKeyId: string,
    dto: RevokePlatformApiKeyDto,
    actorUserId: string,
  ): Promise<PlatformApiKeySummary> {
    await this.ensureTenant(tenantId);
    const existing = await this.prisma.platformApiKey.findFirst({
      where: { id: apiKeyId, tenantId },
      select: this.safeSelect(),
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (existing.status === 'REVOKED') {
      throw new BadRequestException('API key is already revoked');
    }

    const revoked = await this.prisma.platformApiKey.update({
      where: { id: apiKeyId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: actorUserId,
        revokeReason: dto.reason.trim(),
      },
      select: this.safeSelect(),
    });

    await this.auditService.record({
      action: 'platform_api_key_revoked',
      resource: 'api_keys',
      tenantId,
      userId: actorUserId,
      resourceId: apiKeyId,
      before: this.toSummary(existing),
      after: {
        ...this.toSummary(revoked),
        reason: dto.reason.trim(),
      },
    });

    return this.toSummary(revoked);
  }

  async validateApiKey(secret: string) {
    if (!secret.startsWith(SECRET_PREFIX)) {
      return null;
    }

    const key = await this.prisma.platformApiKey.findUnique({
      where: { keyHash: this.hashSecret(secret) },
      select: {
        id: true,
        tenantId: true,
        scopes: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!key || key.status !== 'ACTIVE') {
      return null;
    }
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await this.prisma.platformApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: key.id,
      tenantId: key.tenantId,
      scopes: key.scopes,
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }

  private normalizeScopes(scopes: string[] | undefined) {
    const normalized = Array.from(
      new Set((scopes ?? []).map((scope) => scope.trim()).filter(Boolean)),
    );
    if (normalized.length > MAX_SCOPES) {
      throw new BadRequestException('API key scope limit exceeded');
    }
    return normalized;
  }

  private generateSecret() {
    return `${SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
  }

  private async createUniqueKeyRecord(input: {
    tenantId: string;
    name: string;
    scopes: string[];
    expiresAt: Date | null;
    actorUserId: string;
  }) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const secret = this.generateSecret();
      const token = secret.slice(SECRET_PREFIX.length);
      const prefix = `${SECRET_PREFIX}${token.slice(0, 8)}`;
      const keySuffix = token.slice(-4);

      try {
        const created = await this.prisma.platformApiKey.create({
          data: {
            tenantId: input.tenantId,
            name: input.name,
            prefix,
            keyHash: this.hashSecret(secret),
            keySuffix,
            scopes: input.scopes,
            expiresAt: input.expiresAt,
            createdBy: input.actorUserId,
          },
          select: this.safeSelect(),
        });
        return { secret, created };
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Could not create API key');
  }

  private hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private safeSelect() {
    return {
      id: true,
      tenantId: true,
      name: true,
      prefix: true,
      keySuffix: true,
      scopes: true,
      status: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.PlatformApiKeySelect;
  }

  private toSummary(key: ApiKeyRecord): PlatformApiKeySummary {
    return {
      id: key.id,
      tenantId: key.tenantId,
      name: key.name,
      prefix: key.prefix,
      keyPreview: `${key.prefix}...${key.keySuffix}`,
      scopes: key.scopes,
      status: key.status,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      revokedAt: key.revokedAt?.toISOString() ?? null,
      createdBy: key.createdBy,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    };
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
