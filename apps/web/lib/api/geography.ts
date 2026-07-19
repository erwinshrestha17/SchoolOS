import { request, withQuery } from './client';

export type GeographyLocale = 'en' | 'ne';

export interface NepalProvince {
  id: number;
  nameEn: string;
  nameNe: string;
  label: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
}

export interface NepalDistrict {
  id: number;
  provinceId: number;
  nameEn: string;
  nameNe: string;
  label: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
  province: { id: number; nameEn: string; nameNe: string; label: string };
}

export interface NepalLocalLevelType {
  id: number;
  code: string;
  slug: string;
  nameEn: string;
  nameNe: string;
  label: string;
}

export interface NepalLocalLevel {
  id: number;
  districtId: number;
  typeId: number;
  nameEn: string;
  nameNe: string;
  label: string;
  district: { id: number; nameEn: string; nameNe: string; label: string };
  province: { id: number; nameEn: string; nameNe: string; label: string };
  type: NepalLocalLevelType;
}

export interface NepalGeographySearchResult {
  level: 'PROVINCE' | 'DISTRICT' | 'LOCAL_LEVEL';
  id: number;
  nameEn: string;
  nameNe: string;
  label: string;
  path: string;
}

export interface NepalGeographyVersion {
  datasetKey: string;
  version: string;
  generatedOn: string;
  checksum: string;
  recordCounts: Record<string, number>;
  source: string;
  importedAt: string;
  status: string;
}

export const geographyApi = {
  listProvinces: (locale?: GeographyLocale) =>
    request<NepalProvince[]>(
      withQuery('/reference/nepal/provinces', { locale }),
    ),
  listDistricts: (provinceId?: number, locale?: GeographyLocale) =>
    request<NepalDistrict[]>(
      withQuery('/reference/nepal/districts', { provinceId, locale }),
    ),
  listLocalLevels: (
    districtId?: number,
    typeId?: number,
    locale?: GeographyLocale,
  ) =>
    request<NepalLocalLevel[]>(
      withQuery('/reference/nepal/local-levels', { districtId, typeId, locale }),
    ),
  getLocalLevel: (id: number, locale?: GeographyLocale) =>
    request<NepalLocalLevel>(
      withQuery(`/reference/nepal/local-levels/${id}`, { locale }),
    ),
  search: (q: string, limit?: number) =>
    request<NepalGeographySearchResult[]>(
      withQuery('/reference/nepal/search', { q, limit }),
    ),
  getVersion: () => request<NepalGeographyVersion>('/reference/nepal/version'),
};
