import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantSettingKey, TenantSettingSummary } from '@schoolos/core';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly allowedKeys: TenantSettingKey[] = [
    'school_logo',
    'branding_primary_color',
    'timezone',
    'currency',
    'date_format',
    'attendance_lock_hours',
    'receipt_format',
    'fee_reminder_days',
    'sms_provider',
    'feature_toggles',
  ];

  private readonly publicKeys: TenantSettingKey[] = [
    'school_logo',
    'branding_primary_color',
    'timezone',
    'currency',
    'date_format',
  ];

  async getSettings(tenantId: string): Promise<TenantSettingSummary[]> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: { tenantId },
    });

    return settings.map((s) => ({
      key: s.key as TenantSettingKey,
      value: s.value,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getPublicSettings(tenantId: string): Promise<TenantSettingSummary[]> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: { in: this.publicKeys },
      },
    });

    return settings.map((s) => ({
      key: s.key as TenantSettingKey,
      value: s.value,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getSetting(tenantId: string, key: TenantSettingKey): Promise<any> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    return setting?.value || null;
  }

  async updateSetting(
    tenantId: string,
    key: string,
    value: any,
    userId: string,
  ): Promise<void> {
    if (!this.allowedKeys.includes(key as TenantSettingKey)) {
      throw new BadRequestException(`Invalid setting key: ${key}`);
    }

    this.validateSettingValue(key as TenantSettingKey, value);

    const existing = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        value,
      },
      update: {
        value,
      },
    });

    await this.auditService.record({
      action: 'setting_updated',
      resource: 'settings',
      resourceId: key,
      tenantId,
      userId,
      before: existing ? { value: existing.value } : null,
      after: { value },
    });
  }

  private validateSettingValue(key: TenantSettingKey, value: any): void {
    switch (key) {
      case 'branding_primary_color':
        if (typeof value !== 'string' || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
          throw new BadRequestException('Invalid color format. Expected hex code.');
        }
        break;
      case 'attendance_lock_hours':
      case 'fee_reminder_days':
        if (typeof value !== 'number' || value < 0) {
          throw new BadRequestException(`Invalid value for ${key}. Expected positive number.`);
        }
        break;
      case 'timezone':
      case 'currency':
      case 'date_format':
      case 'receipt_format':
      case 'sms_provider':
      case 'school_logo':
        if (typeof value !== 'string') {
          throw new BadRequestException(`Invalid value for ${key}. Expected string.`);
        }
        break;
      case 'feature_toggles':
        if (typeof value !== 'object' || value === null) {
          throw new BadRequestException('Invalid value for feature_toggles. Expected object.');
        }
        break;
      default:
        // No specific validation for others yet
        break;
    }
  }
}
