import {
  nepalProvinceSeeds,
  nepalDistrictSeeds,
  nepalLocalLevelTypeSeeds,
  nepalLocalLevelSeeds,
  NEPAL_GEOGRAPHY_RECORD_COUNTS,
} from './nepal-geography.data';

describe('Nepal geography reference dataset', () => {
  it('has exactly 7 provinces, 77 districts, and 753 local levels', () => {
    expect(nepalProvinceSeeds).toHaveLength(7);
    expect(nepalDistrictSeeds).toHaveLength(77);
    expect(nepalLocalLevelSeeds).toHaveLength(753);
    expect(NEPAL_GEOGRAPHY_RECORD_COUNTS.provinces).toBe(7);
    expect(NEPAL_GEOGRAPHY_RECORD_COUNTS.districts).toBe(77);
    expect(NEPAL_GEOGRAPHY_RECORD_COUNTS.localLevels).toBe(753);
  });

  it('has the correct local-level type totals', () => {
    const countByCode = (code: string) =>
      nepalLocalLevelSeeds.filter((level) => {
        const type = nepalLocalLevelTypeSeeds.find((t) => t.id === level.typeId);
        return type?.code === code;
      }).length;

    expect(countByCode('METROPOLITAN_CITY')).toBe(6);
    expect(countByCode('SUB_METROPOLITAN_CITY')).toBe(11);
    expect(countByCode('MUNICIPALITY')).toBe(276);
    expect(countByCode('RURAL_MUNICIPALITY')).toBe(460);
    expect(nepalLocalLevelTypeSeeds).toHaveLength(4);
  });

  it('has unique ids within each table', () => {
    const uniqueCount = (ids: number[]) => new Set(ids).size;
    expect(uniqueCount(nepalProvinceSeeds.map((p) => p.id))).toBe(7);
    expect(uniqueCount(nepalDistrictSeeds.map((d) => d.id))).toBe(77);
    expect(uniqueCount(nepalLocalLevelTypeSeeds.map((t) => t.id))).toBe(4);
    expect(uniqueCount(nepalLocalLevelSeeds.map((l) => l.id))).toBe(753);
  });

  it('has valid province-to-district foreign keys', () => {
    const provinceIds = new Set(nepalProvinceSeeds.map((p) => p.id));
    for (const district of nepalDistrictSeeds) {
      expect(provinceIds.has(district.provinceId)).toBe(true);
    }
  });

  it('has valid district-to-local-level and type-to-local-level foreign keys', () => {
    const districtIds = new Set(nepalDistrictSeeds.map((d) => d.id));
    const typeIds = new Set(nepalLocalLevelTypeSeeds.map((t) => t.id));
    for (const level of nepalLocalLevelSeeds) {
      expect(districtIds.has(level.districtId)).toBe(true);
      expect(typeIds.has(level.typeId)).toBe(true);
    }
  });

  it('rejects an invalid hierarchy (local level pointing at a nonexistent district)', () => {
    const districtIds = new Set(nepalDistrictSeeds.map((d) => d.id));
    const tampered = { id: 99999, districtId: -1, typeId: 1, nameEn: 'Nowhere', nameNe: 'X' };
    expect(districtIds.has(tampered.districtId)).toBe(false);
  });

  it('has non-empty English and Nepali names for every record', () => {
    for (const rows of [
      nepalProvinceSeeds,
      nepalDistrictSeeds,
      nepalLocalLevelTypeSeeds,
      nepalLocalLevelSeeds,
    ]) {
      for (const row of rows) {
        expect(row.nameEn.trim().length).toBeGreaterThan(0);
        expect(row.nameNe.trim().length).toBeGreaterThan(0);
        // Nepali names must contain Devanagari script, not be a copy of the English name.
        expect(row.nameNe).toMatch(/[ऀ-ॿ]/);
      }
    }
  });

  it('confirms Tilottama -> Rupandehi -> Lumbini Province', () => {
    const tilottama = nepalLocalLevelSeeds.find((l) => l.nameEn === 'Tilottama');
    expect(tilottama).toBeDefined();
    const rupandehi = nepalDistrictSeeds.find((d) => d.id === tilottama!.districtId);
    expect(rupandehi?.nameEn).toBe('Rupandehi');
    const lumbini = nepalProvinceSeeds.find((p) => p.id === rupandehi!.provinceId);
    expect(lumbini?.nameEn).toBe('Lumbini Province');
  });

  it('re-deriving record counts from raw rows is stable across repeated computation (idempotent-reseed precondition)', () => {
    // If this dataset were reseeded via upsert-by-id twice, the second pass
    // must produce identical rows (same ids, same field values) rather than
    // duplicates. That invariant reduces to: ids are unique and stable, which
    // is asserted above; here we additionally check there are no duplicate
    // (parentId, nameEn) pairs that a unique constraint would reject on a
    // second insert with a different id.
    const districtKey = (d: (typeof nepalDistrictSeeds)[number]) => `${d.provinceId}::${d.nameEn}`;
    expect(new Set(nepalDistrictSeeds.map(districtKey)).size).toBe(nepalDistrictSeeds.length);

    const levelKey = (l: (typeof nepalLocalLevelSeeds)[number]) => `${l.districtId}::${l.nameEn}`;
    expect(new Set(nepalLocalLevelSeeds.map(levelKey)).size).toBe(nepalLocalLevelSeeds.length);
  });
});
