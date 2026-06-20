import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SchoolProfileSettings, TenantSettingKey } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';
import { schoolProfileKeyMap, schoolProfileSettingKeys } from './school-profile.keys';

@Injectable()
export class SchoolSettingsProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(tenantId: string): Promise<SchoolProfileSettings> {
    const settings = await this.prisma.tenantSetting.findMany({
      where: { tenantId, key: { in: schoolProfileSettingKeys } },
      select: { key: true, value: true, updatedAt: true },
    });
    const values = new Map(settings.map((item) => [item.key, item.value]));
    const latest = settings.reduce<Date | null>(
      (current, item) => !current || item.updatedAt > current ? item.updatedAt : current,
      null,
    );
    const read = (field: keyof typeof schoolProfileKeyMap) =>
      values.get(schoolProfileKeyMap[field]) ?? null;

    return {
      schoolName: stringValue(read('schoolName')),
      schoolAddress: stringValue(read('schoolAddress')),
      schoolPhone: stringValue(read('schoolPhone')),
      schoolEmail: stringValue(read('schoolEmail')),
      schoolPanNumber: stringValue(read('schoolPanNumber')),
      principalName: stringValue(read('principalName')),
      municipality: stringValue(read('municipality')),
      wardNumber: numberValue(read('wardNumber')),
      district: stringValue(read('district')),
      province: stringValue(read('province')),
      schoolType: schoolTypeValue(read('schoolType')),
      iemisSchoolCode: stringValue(read('iemisSchoolCode')),
      updatedAt: latest?.toISOString() ?? null,
    };
  }

  async updateProfile(tenantId: string, dto: UpdateSchoolProfileDto, userId: string) {
    const updates = Object.entries(schoolProfileKeyMap)
      .filter(([field]) => dto[field as keyof UpdateSchoolProfileDto] !== undefined)
      .map(([field, key]) => ({
        key: key as TenantSettingKey,
        value: normalize(dto[field as keyof UpdateSchoolProfileDto]),
      }));

    if (updates.length === 0) return this.getProfile(tenantId);

    await this.prisma.$transaction(updates.map(({ key, value }) =>
      this.prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, value },
        update: { value },
      }),
    ));

    await this.auditService.record({
      action: 'school_profile_updated',
      resource: 'settings',
      resourceId: 'school_profile',
      tenantId,
      userId,
      after: { changedKeys: updates.map(({ key }) => key) },
    });

    return this.getProfile(tenantId);
  }
}

function normalize(value: unknown): Prisma.InputJsonValue {
  if (value === null) return '';
  return typeof value === 'string' ? value.trim() : value as Prisma.InputJsonValue;
}
function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function schoolTypeValue(value: unknown): SchoolProfileSettings['schoolType'] {
  return value === 'PRIVATE' || value === 'COMMUNITY' || value === 'TRUST' ? value : null;
}
