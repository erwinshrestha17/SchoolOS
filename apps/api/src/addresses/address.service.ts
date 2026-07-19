import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AddressMappingStatus,
  AddressOwnerType,
  AddressType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddressInputDto } from './dto/address-input.dto';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Generic, reusable address service backing every SchoolOS entity that needs
 * a physical address (staff, guardians, students, campuses, transport stops,
 * vendors, assets, ...). One Address table, owned polymorphically via
 * (ownerType, ownerId) -- see apps/api/prisma/schema/geography.prisma.
 *
 * Callers stay responsible for authorization (tenant + record ownership);
 * this service only owns address validation and normalized-vs-legacy-text
 * bookkeeping.
 */
@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Never trust a client-submitted localLevelId -- confirm it actually
   * exists in the Nepal reference tables before writing it onto any address.
   */
  async assertLocalLevelExists(db: Db, localLevelId: number): Promise<void> {
    const level = await db.nepalLocalLevel.findUnique({
      where: { id: localLevelId },
    });
    if (!level) {
      throw new BadRequestException(
        `localLevelId ${localLevelId} does not match a known Nepal local level`,
      );
    }
  }

  /**
   * Creates or updates the single *active* (non-historical) address of a
   * given type for an owner. Legacy free-text is preserved verbatim in
   * `legacyText` rather than discarded, per the controlled-migration
   * requirement -- nothing here ever deletes a caller-supplied legacy string.
   */
  async upsertAddress(
    db: Db,
    params: {
      tenantId: string;
      ownerType: AddressOwnerType;
      ownerId: string;
      input: AddressInputDto;
      legacyText?: string | null;
      mappingStatus?: AddressMappingStatus;
    },
  ) {
    const { tenantId, ownerType, ownerId, input, legacyText } = params;
    const addressType = input.addressType ?? AddressType.OTHER;

    if (input.localLevelId !== undefined) {
      await this.assertLocalLevelExists(db, input.localLevelId);
    }

    const mappingStatus =
      params.mappingStatus ??
      (input.localLevelId !== undefined
        ? AddressMappingStatus.CONFIRMED
        : legacyText
          ? AddressMappingStatus.MANUAL_REVIEW_REQUIRED
          : AddressMappingStatus.UNMATCHED);

    const existing = await db.address.findFirst({
      where: { tenantId, ownerType, ownerId, addressType, isHistorical: false },
    });

    const data = {
      tenantId,
      ownerType,
      ownerId,
      addressType,
      localLevelId: input.localLevelId ?? null,
      wardNumber: input.wardNumber ?? null,
      tole: input.tole ?? null,
      streetAddress: input.streetAddress ?? null,
      landmark: input.landmark ?? null,
      postalCode: input.postalCode ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      legacyText: legacyText ?? existing?.legacyText ?? null,
      mappingStatus,
    };

    if (existing) {
      return db.address.update({ where: { id: existing.id }, data });
    }
    return db.address.create({ data });
  }

  async listForOwner(
    tenantId: string,
    ownerType: AddressOwnerType,
    ownerId: string,
  ) {
    return this.prisma.address.findMany({
      where: { tenantId, ownerType, ownerId },
      include: {
        localLevel: { include: { district: { include: { province: true } } } },
      },
      orderBy: [{ isHistorical: 'asc' }, { addressType: 'asc' }],
    });
  }

  async getActiveAddress(
    db: Db,
    tenantId: string,
    ownerType: AddressOwnerType,
    ownerId: string,
    addressType: AddressType,
  ) {
    return db.address.findFirst({
      where: { tenantId, ownerType, ownerId, addressType, isHistorical: false },
      include: {
        localLevel: { include: { district: { include: { province: true } } } },
      },
    });
  }
}
