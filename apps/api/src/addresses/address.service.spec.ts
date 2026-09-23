import { BadRequestException } from '@nestjs/common';
import {
  AddressMappingStatus,
  AddressOwnerType,
  AddressType,
} from '@prisma/client';
import { AddressService } from './address.service';
import { PrismaService } from '../prisma/prisma.service';

interface AddressRow {
  id: string;
  isHistorical: boolean;
  tenantId?: string;
  ownerType?: AddressOwnerType;
  ownerId?: string;
  addressType?: AddressType;
  wardNumber?: string;
  [key: string]: unknown;
}

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const addresses: AddressRow[] = [];
  return {
    nepalLocalLevel: {
      findUnique: jest.fn(
        async ({ where: { id } }: { where: { id: number } }) =>
          id === 500 ? { id: 500, nameEn: 'Tilottama' } : null,
      ),
    },
    address: {
      findFirst: jest.fn(
        async ({ where }: { where: Partial<AddressRow> }) =>
          addresses.find(
            (a) =>
              a.tenantId === where.tenantId &&
              a.ownerType === where.ownerType &&
              a.ownerId === where.ownerId &&
              a.addressType === where.addressType &&
              a.isHistorical === where.isHistorical,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Partial<AddressRow> }) => {
        const row = {
          id: `addr-${String(addresses.length + 1)}`,
          isHistorical: false,
          ...data,
        };
        addresses.push(row);
        return row;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<AddressRow>;
        }) => {
          const row = addresses.find((a) => a.id === where.id);
          if (!row) {
            throw new Error(`Address fixture ${where.id} was not created`);
          }
          Object.assign(row, data);
          return row;
        },
      ),
    },
    _addresses: addresses,
    ...overrides,
  };
}

describe('AddressService', () => {
  it('rejects an unknown localLevelId rather than silently persisting it', async () => {
    const db = makeDb();
    const service = new AddressService({} as PrismaService);

    await expect(
      service.upsertAddress(db as never, {
        tenantId: 'tenant-1',
        ownerType: AddressOwnerType.STAFF,
        ownerId: 'staff-1',
        input: { localLevelId: 999999 },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks an address CONFIRMED when the caller explicitly picked a localLevelId', async () => {
    const db = makeDb();
    const service = new AddressService({} as PrismaService);

    const created = await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: { localLevelId: 500, addressType: AddressType.PERMANENT },
      legacyText: 'Old free-text address, Kathmandu',
    });

    expect(created.mappingStatus).toBe(AddressMappingStatus.CONFIRMED);
    expect(created.legacyText).toBe('Old free-text address, Kathmandu');
    expect(created.localLevelId).toBe(500);
  });

  it('marks an address MANUAL_REVIEW_REQUIRED when only legacy text is given (no structured pick)', async () => {
    const db = makeDb();
    const service = new AddressService({} as PrismaService);

    const created = await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: { addressType: AddressType.PERMANENT },
      legacyText: 'Some legacy address text',
    });

    expect(created.mappingStatus).toBe(
      AddressMappingStatus.MANUAL_REVIEW_REQUIRED,
    );
  });

  it('updates the existing active address in place instead of creating a duplicate row', async () => {
    const db = makeDb();
    const service = new AddressService({} as PrismaService);

    await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: {
        localLevelId: 500,
        addressType: AddressType.PERMANENT,
        wardNumber: '4',
      },
    });
    await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: {
        localLevelId: 500,
        addressType: AddressType.PERMANENT,
        wardNumber: '7',
      },
    });

    expect(db._addresses).toHaveLength(1);
    expect(db._addresses[0].wardNumber).toBe('7');
  });

  it('keeps PERMANENT and CURRENT addresses as separate rows for the same owner', async () => {
    const db = makeDb();
    const service = new AddressService({} as PrismaService);

    await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: { localLevelId: 500, addressType: AddressType.PERMANENT },
    });
    await service.upsertAddress(db as never, {
      tenantId: 'tenant-1',
      ownerType: AddressOwnerType.STAFF,
      ownerId: 'staff-1',
      input: { localLevelId: 500, addressType: AddressType.CURRENT },
    });

    expect(db._addresses).toHaveLength(2);
  });
});
