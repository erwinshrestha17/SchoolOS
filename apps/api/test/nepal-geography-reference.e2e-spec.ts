import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GeographyService } from '../src/geography/geography.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  nepalProvinceSeeds,
  nepalDistrictSeeds,
  nepalLocalLevelTypeSeeds,
  nepalLocalLevelSeeds,
} from '../prisma/data/nepal-geography.data';

/**
 * Hand-rolled fake standing in for the real Postgres-backed Prisma client,
 * built directly from the same seed rows the real migration/seed script
 * loads. This exercises GeographyService's hierarchical-validation, locale,
 * and search logic without requiring a live database in CI, following the
 * makePrisma() convention used by attendance-teacher-scope-integration.
 */
function makePrisma() {
  const provinceById = new Map(nepalProvinceSeeds.map((p) => [p.id, p]));
  const districtById = new Map(nepalDistrictSeeds.map((d) => [d.id, d]));
  const typeById = new Map(nepalLocalLevelTypeSeeds.map((t) => [t.id, t]));

  const withProvince = (d: (typeof nepalDistrictSeeds)[number]) => ({
    ...d,
    province: provinceById.get(d.provinceId),
  });
  const withDistrictAndType = (l: (typeof nepalLocalLevelSeeds)[number]) => ({
    ...l,
    district: withProvince(districtById.get(l.districtId)!),
    type: typeById.get(l.typeId),
  });

  const containsInsensitive = (haystack: string, needle: string) =>
    haystack.toLowerCase().includes(needle.toLowerCase());

  return {
    nepalProvince: {
      findMany: async (args: any = {}) => {
        let rows = [...nepalProvinceSeeds];
        const or = args?.where?.OR;
        if (or) {
          const [enClause, neClause] = or;
          rows = rows.filter(
            (p) =>
              containsInsensitive(p.nameEn, enClause.nameEn.contains) ||
              p.nameNe.includes(neClause.nameNe.contains),
          );
        }
        if (args?.take) rows = rows.slice(0, args.take);
        return rows;
      },
      findUnique: async ({ where: { id } }: any) =>
        provinceById.get(id) ?? null,
    },
    nepalDistrict: {
      findMany: async (args: any = {}) => {
        let rows = nepalDistrictSeeds.map(withProvince);
        if (args?.where?.provinceId !== undefined) {
          rows = rows.filter((d) => d.provinceId === args.where.provinceId);
        }
        const or = args?.where?.OR;
        if (or) {
          const [enClause, neClause] = or;
          rows = rows.filter(
            (d) =>
              containsInsensitive(d.nameEn, enClause.nameEn.contains) ||
              d.nameNe.includes(neClause.nameNe.contains),
          );
        }
        if (args?.take) rows = rows.slice(0, args.take);
        return rows;
      },
      findUnique: async ({ where: { id } }: any) =>
        districtById.get(id) ?? null,
    },
    nepalLocalLevelType: {
      findMany: async () => [...nepalLocalLevelTypeSeeds],
      findUnique: async ({ where: { id } }: any) => typeById.get(id) ?? null,
    },
    nepalLocalLevel: {
      findMany: async (args: any = {}) => {
        let rows = nepalLocalLevelSeeds.map(withDistrictAndType);
        if (args?.where?.districtId !== undefined) {
          rows = rows.filter((l) => l.districtId === args.where.districtId);
        }
        if (args?.where?.typeId !== undefined) {
          rows = rows.filter((l) => l.typeId === args.where.typeId);
        }
        const or = args?.where?.OR;
        if (or) {
          const [enClause, neClause] = or;
          rows = rows.filter(
            (l) =>
              containsInsensitive(l.nameEn, enClause.nameEn.contains) ||
              l.nameNe.includes(neClause.nameNe.contains),
          );
        }
        if (args?.take) rows = rows.slice(0, args.take);
        return rows;
      },
      findUnique: async ({ where: { id } }: any) => {
        const level = nepalLocalLevelSeeds.find((l) => l.id === id);
        return level ? withDistrictAndType(level) : null;
      },
    },
    referenceDatasetVersion: {
      findUnique: async ({ where: { datasetKey } }: any) =>
        datasetKey === 'nepal-administrative-hierarchy'
          ? {
              id: 'fixture-id',
              datasetKey,
              version: '1.0.0',
              generatedOn: new Date('2026-07-18'),
              checksum: 'fixture-checksum',
              recordCounts: { provinces: 7, districts: 77, localLevels: 753 },
              source: 'fixture',
              importedAt: new Date(),
              status: 'ACTIVE',
            }
          : null,
    },
  };
}

describe('Nepal geography reference API (GeographyService)', () => {
  function makeService() {
    const prisma = makePrisma();
    const service = new GeographyService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it('lists all 7 provinces with bilingual names', async () => {
    const { service } = makeService();
    const provinces = await service.listProvinces();
    expect(provinces).toHaveLength(7);
    const lumbini = provinces.find((p) => p.nameEn === 'Lumbini Province');
    expect(lumbini?.nameNe).toBe('लुम्बिनी प्रदेश');
    expect(lumbini?.label).toBe('Lumbini Province');
  });

  it('switches the label field to Nepali when locale=ne', async () => {
    const { service } = makeService();
    const provinces = await service.listProvinces('ne');
    const lumbini = provinces.find((p) => p.nameEn === 'Lumbini Province');
    expect(lumbini?.label).toBe('लुम्बिनी प्रदेश');
  });

  it('cascades districts by provinceId (only Lumbini Province districts returned)', async () => {
    const { service } = makeService();
    const districts = await service.listDistricts(5);
    expect(districts).toHaveLength(12);
    expect(districts.every((d) => d.provinceId === 5)).toBe(true);
    expect(districts.some((d) => d.nameEn === 'Rupandehi')).toBe(true);
  });

  it('rejects an invalid provinceId when cascading to districts (404, not empty-array guessing)', async () => {
    const { service } = makeService();
    await expect(service.listDistricts(999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cascades local levels by districtId and confirms Tilottama -> Rupandehi -> Lumbini Province', async () => {
    const { service } = makeService();
    const rupandehi = nepalDistrictSeeds.find((d) => d.nameEn === 'Rupandehi')!;
    const levels = await service.listLocalLevels(rupandehi.id, undefined);
    expect(levels.every((l) => l.districtId === rupandehi.id)).toBe(true);

    const tilottama = levels.find((l) => l.nameEn === 'Tilottama');
    expect(tilottama).toBeDefined();
    expect(tilottama!.district.nameEn).toBe('Rupandehi');
    expect(tilottama!.province.nameEn).toBe('Lumbini Province');
  });

  it('rejects an invalid districtId when cascading to local levels', async () => {
    const { service } = makeService();
    await expect(service.listLocalLevels(999999, undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an invalid typeId filter', async () => {
    const { service } = makeService();
    const rupandehi = nepalDistrictSeeds.find((d) => d.nameEn === 'Rupandehi')!;
    await expect(service.listLocalLevels(rupandehi.id, 999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('gets a single local level by id with 404 on unknown id', async () => {
    const { service } = makeService();
    const tilottama = nepalLocalLevelSeeds.find(
      (l) => l.nameEn === 'Tilottama',
    )!;
    const result = await service.getLocalLevelById(tilottama.id);
    expect(result.nameEn).toBe('Tilottama');
    expect(result.type.code).toBe('MUNICIPALITY');

    await expect(service.getLocalLevelById(999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('searches by English name and returns hierarchical path', async () => {
    const { service } = makeService();
    const results = await service.search('Tilottama', 20);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      level: 'LOCAL_LEVEL',
      nameEn: 'Tilottama',
      path: 'Tilottama, Rupandehi, Lumbini Province',
    });
  });

  it('searches by Nepali script text', async () => {
    const { service } = makeService();
    // तिलोत्तमा == "Tilottama" in Devanagari
    const results = await service.search('तिलोत्तमा', 20);
    expect(results.some((r) => r.nameEn === 'Tilottama')).toBe(true);
  });

  it('rejects a search query shorter than 2 characters', async () => {
    const { service } = makeService();
    await expect(service.search('T', 20)).rejects.toThrow(BadRequestException);
  });

  it('exposes dataset version metadata for client cache invalidation', async () => {
    const { service } = makeService();
    const version = await service.getVersion();
    expect(version.datasetKey).toBe('nepal-administrative-hierarchy');
    expect(version.recordCounts).toBeDefined();
  });
});
