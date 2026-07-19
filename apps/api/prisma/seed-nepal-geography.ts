import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import {
  NEPAL_GEOGRAPHY_DATASET_KEY,
  NEPAL_GEOGRAPHY_DATASET_VERSION,
  NEPAL_GEOGRAPHY_GENERATED_ON,
  NEPAL_GEOGRAPHY_SOURCE,
  NEPAL_GEOGRAPHY_CHECKSUM,
  NEPAL_GEOGRAPHY_RECORD_COUNTS,
  nepalProvinceSeeds,
  nepalDistrictSeeds,
  nepalLocalLevelTypeSeeds,
  nepalLocalLevelSeeds,
} from './data/nepal-geography.data';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:admin@localhost:5432/school_os?schema=public',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Nepal Geography Reference Seed: Starting ---');

  for (const province of nepalProvinceSeeds) {
    await prisma.nepalProvince.upsert({
      where: { id: province.id },
      create: province,
      update: {
        nameEn: province.nameEn,
        nameNe: province.nameNe,
        headquartersEn: province.headquartersEn,
        headquartersNe: province.headquartersNe,
      },
    });
  }
  console.log(`Provinces seeded: ${nepalProvinceSeeds.length}`);

  for (const type of nepalLocalLevelTypeSeeds) {
    await prisma.nepalLocalLevelType.upsert({
      where: { id: type.id },
      create: type,
      update: {
        code: type.code,
        slug: type.slug,
        nameEn: type.nameEn,
        nameNe: type.nameNe,
      },
    });
  }
  console.log(`Local level types seeded: ${nepalLocalLevelTypeSeeds.length}`);

  for (const district of nepalDistrictSeeds) {
    await prisma.nepalDistrict.upsert({
      where: { id: district.id },
      create: district,
      update: {
        provinceId: district.provinceId,
        nameEn: district.nameEn,
        nameNe: district.nameNe,
        headquartersEn: district.headquartersEn,
        headquartersNe: district.headquartersNe,
      },
    });
  }
  console.log(`Districts seeded: ${nepalDistrictSeeds.length}`);

  for (const level of nepalLocalLevelSeeds) {
    await prisma.nepalLocalLevel.upsert({
      where: { id: level.id },
      create: level,
      update: {
        districtId: level.districtId,
        typeId: level.typeId,
        nameEn: level.nameEn,
        nameNe: level.nameNe,
      },
    });
  }
  console.log(`Local levels seeded: ${nepalLocalLevelSeeds.length}`);

  await verifyCounts();

  await prisma.referenceDatasetVersion.upsert({
    where: { datasetKey: NEPAL_GEOGRAPHY_DATASET_KEY },
    create: {
      datasetKey: NEPAL_GEOGRAPHY_DATASET_KEY,
      version: NEPAL_GEOGRAPHY_DATASET_VERSION,
      generatedOn: new Date(NEPAL_GEOGRAPHY_GENERATED_ON),
      checksum: NEPAL_GEOGRAPHY_CHECKSUM,
      recordCounts: NEPAL_GEOGRAPHY_RECORD_COUNTS,
      source: NEPAL_GEOGRAPHY_SOURCE,
      status: 'ACTIVE',
    },
    update: {
      version: NEPAL_GEOGRAPHY_DATASET_VERSION,
      generatedOn: new Date(NEPAL_GEOGRAPHY_GENERATED_ON),
      checksum: NEPAL_GEOGRAPHY_CHECKSUM,
      recordCounts: NEPAL_GEOGRAPHY_RECORD_COUNTS,
      source: NEPAL_GEOGRAPHY_SOURCE,
      status: 'ACTIVE',
    },
  });

  console.log('--- Nepal Geography Reference Seed: Complete ---');
}

/**
 * Fails loudly (non-zero exit via main().catch) rather than silently
 * completing with a corrupted dataset, per the spec's CI-gate requirement.
 */
async function verifyCounts() {
  const [provinceCount, districtCount, typeCount, levelCount] = await Promise.all([
    prisma.nepalProvince.count(),
    prisma.nepalDistrict.count(),
    prisma.nepalLocalLevelType.count(),
    prisma.nepalLocalLevel.count(),
  ]);

  const failures: string[] = [];
  if (provinceCount !== NEPAL_GEOGRAPHY_RECORD_COUNTS.provinces) {
    failures.push(`provinces: expected ${NEPAL_GEOGRAPHY_RECORD_COUNTS.provinces}, got ${provinceCount}`);
  }
  if (districtCount !== NEPAL_GEOGRAPHY_RECORD_COUNTS.districts) {
    failures.push(`districts: expected ${NEPAL_GEOGRAPHY_RECORD_COUNTS.districts}, got ${districtCount}`);
  }
  if (typeCount !== NEPAL_GEOGRAPHY_RECORD_COUNTS.localLevelTypes) {
    failures.push(`local level types: expected ${NEPAL_GEOGRAPHY_RECORD_COUNTS.localLevelTypes}, got ${typeCount}`);
  }
  if (levelCount !== NEPAL_GEOGRAPHY_RECORD_COUNTS.localLevels) {
    failures.push(`local levels: expected ${NEPAL_GEOGRAPHY_RECORD_COUNTS.localLevels}, got ${levelCount}`);
  }

  const byType = await prisma.nepalLocalLevel.groupBy({
    by: ['typeId'],
    _count: { _all: true },
  });
  const typeById = new Map(nepalLocalLevelTypeSeeds.map((t) => [t.id, t.code]));
  const countByCode = new Map(byType.map((row) => [typeById.get(row.typeId), row._count._all]));
  const expectedByCode: Record<string, number> = {
    METROPOLITAN_CITY: NEPAL_GEOGRAPHY_RECORD_COUNTS.metropolitanCities,
    SUB_METROPOLITAN_CITY: NEPAL_GEOGRAPHY_RECORD_COUNTS.subMetropolitanCities,
    MUNICIPALITY: NEPAL_GEOGRAPHY_RECORD_COUNTS.municipalities,
    RURAL_MUNICIPALITY: NEPAL_GEOGRAPHY_RECORD_COUNTS.ruralMunicipalities,
  };
  for (const [code, expected] of Object.entries(expectedByCode)) {
    const actual = countByCode.get(code) ?? 0;
    if (actual !== expected) {
      failures.push(`${code}: expected ${expected}, got ${actual}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Nepal geography seed validation failed:\n  ${failures.join('\n  ')}`);
  }

  console.log('Post-seed validation passed:', NEPAL_GEOGRAPHY_RECORD_COUNTS);
}

main()
  .catch((error) => {
    console.error('❌ Nepal geography seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
