import { BadRequestException, Injectable } from '@nestjs/common';
import { AddressOwnerType, AddressType, type Prisma } from '@prisma/client';
import type { SchoolProfileSettings } from '@schoolos/core';
import { AddressService } from '../addresses/address.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';
import {
  schoolProfileKeyMap,
  schoolProfileSettingKeys,
} from './school-profile.keys';
import {
  optionalNepalContactPhone,
  optionalPersonName,
  optionalProfileEmail,
} from '../common/validation/contact-profile';

@Injectable()
export class SchoolSettingsProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly addressService: AddressService,
  ) {}

  async getProfile(tenantId: string): Promise<SchoolProfileSettings> {
    const [settings, registeredAddress] = await Promise.all([
      this.prisma.tenantSetting.findMany({
        where: { tenantId, key: { in: schoolProfileSettingKeys } },
        select: { key: true, value: true, updatedAt: true },
      }),
      this.addressService.getActiveAddress(
        this.prisma,
        tenantId,
        AddressOwnerType.TENANT,
        tenantId,
        AddressType.REGISTERED_OFFICE,
      ),
    ]);
    const values = new Map(settings.map((item) => [item.key, item.value]));
    let latest = settings.reduce<Date | null>(
      (current, item) =>
        !current || item.updatedAt > current ? item.updatedAt : current,
      null,
    );
    if (
      registeredAddress?.updatedAt &&
      (!latest || registeredAddress.updatedAt > latest)
    ) {
      latest = registeredAddress.updatedAt;
    }
    const read = (field: keyof typeof schoolProfileKeyMap) =>
      values.get(schoolProfileKeyMap[field]) ?? null;

    return {
      schoolName: stringValue(read('schoolName')),
      schoolAddress: stringValue(read('schoolAddress')),
      schoolPhone: stringValue(read('schoolPhone')),
      schoolEmail: stringValue(read('schoolEmail')),
      schoolPanNumber: stringValue(read('schoolPanNumber')),
      principalName: stringValue(read('principalName')),
      municipality:
        registeredAddress?.localLevel?.nameEn ??
        stringValue(read('municipality')),
      wardNumber:
        wardNumberValue(registeredAddress?.wardNumber) ??
        numberValue(read('wardNumber')),
      district:
        registeredAddress?.localLevel?.district.nameEn ??
        stringValue(read('district')),
      province:
        registeredAddress?.localLevel?.district.province.nameEn ??
        stringValue(read('province')),
      localLevelId: registeredAddress?.localLevelId ?? null,
      tole: registeredAddress?.tole ?? null,
      streetAddress: registeredAddress?.streetAddress ?? null,
      landmark: registeredAddress?.landmark ?? null,
      schoolType: schoolTypeValue(read('schoolType')),
      iemisSchoolCode: stringValue(read('iemisSchoolCode')),
      affiliationBoard: stringValue(read('affiliationBoard')),
      affiliationNumber: stringValue(read('affiliationNumber')),
      updatedAt: latest?.toISOString() ?? null,
    };
  }

  async updateProfile(
    tenantId: string,
    dto: UpdateSchoolProfileDto,
    userId: string,
  ) {
    if (dto.schoolPhone !== undefined) {
      dto.schoolPhone = optionalNepalContactPhone(dto.schoolPhone);
    }
    if (dto.schoolEmail !== undefined) {
      dto.schoolEmail = optionalProfileEmail(dto.schoolEmail);
    }
    if (dto.principalName !== undefined) {
      dto.principalName = optionalPersonName(
        dto.principalName,
        'principalName',
      );
    }
    const settingUpdates = Object.entries(schoolProfileKeyMap)
      .filter(([field]) => dto[field] !== undefined)
      .map(([field, key]) => ({
        key,
        value: normalize(dto[field as keyof UpdateSchoolProfileDto]),
      }));
    const hasAddressChange = [
      'schoolAddress',
      'localLevelId',
      'wardNumber',
      'tole',
      'streetAddress',
      'landmark',
    ].some((field) => dto[field as keyof UpdateSchoolProfileDto] !== undefined);

    if (settingUpdates.length === 0 && !hasAddressChange) {
      return this.getProfile(tenantId);
    }

    const changedKeys = await this.prisma.$transaction(async (tx) => {
      const updates = new Map(
        settingUpdates.map(({ key, value }) => [key, value] as const),
      );

      if (hasAddressChange) {
        const existing = await this.addressService.getActiveAddress(
          tx,
          tenantId,
          AddressOwnerType.TENANT,
          tenantId,
          AddressType.REGISTERED_OFFICE,
        );
        let selectedLocalLevel = existing?.localLevel ?? null;
        if (dto.localLevelId !== undefined) {
          selectedLocalLevel = await tx.nepalLocalLevel.findUnique({
            where: { id: dto.localLevelId },
            include: { district: { include: { province: true } } },
          });
          if (!selectedLocalLevel) {
            throw new BadRequestException(
              'Select a valid Nepal local level for the school address.',
            );
          }
          updates.set('municipality', selectedLocalLevel.nameEn);
          updates.set('district', selectedLocalLevel.district.nameEn);
          updates.set('province', selectedLocalLevel.district.province.nameEn);
        }

        await this.addressService.upsertAddress(tx, {
          tenantId,
          ownerType: AddressOwnerType.TENANT,
          ownerId: tenantId,
          legacyText:
            dto.schoolAddress !== undefined
              ? dto.schoolAddress
              : existing?.legacyText,
          input: {
            addressType: AddressType.REGISTERED_OFFICE,
            localLevelId:
              dto.localLevelId ?? existing?.localLevelId ?? undefined,
            wardNumber:
              dto.wardNumber !== undefined
                ? dto.wardNumber === null
                  ? undefined
                  : String(dto.wardNumber)
                : (existing?.wardNumber ?? undefined),
            tole:
              dto.tole !== undefined
                ? optionalTrim(dto.tole)
                : (existing?.tole ?? undefined),
            streetAddress:
              dto.streetAddress !== undefined
                ? optionalTrim(dto.streetAddress)
                : (existing?.streetAddress ?? undefined),
            landmark:
              dto.landmark !== undefined
                ? optionalTrim(dto.landmark)
                : (existing?.landmark ?? undefined),
          },
        });
      }

      for (const [key, value] of updates) {
        await tx.tenantSetting.upsert({
          where: { tenantId_key: { tenantId, key } },
          create: { tenantId, key, value },
          update: { value },
        });
      }
      return [
        ...updates.keys(),
        ...(hasAddressChange ? ['registered_office_address'] : []),
      ];
    });

    await this.auditService.record({
      action: 'school_profile_updated',
      resource: 'settings',
      resourceId: 'school_profile',
      tenantId,
      userId,
      after: { changedKeys },
    });

    return this.getProfile(tenantId);
  }
}

function normalize(value: unknown): Prisma.InputJsonValue {
  if (value === null) return '';
  return typeof value === 'string'
    ? value.trim()
    : (value as Prisma.InputJsonValue);
}
function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function wardNumberValue(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 99 ? parsed : null;
}
function optionalTrim(value: string | null) {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}
function schoolTypeValue(value: unknown): SchoolProfileSettings['schoolType'] {
  return value === 'PRIVATE' || value === 'COMMUNITY' || value === 'TRUST'
    ? value
    : null;
}
