import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GeographyLocale = 'en' | 'ne';

export interface ProvinceResponse {
  id: number;
  nameEn: string;
  nameNe: string;
  label: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
}

export interface DistrictResponse {
  id: number;
  provinceId: number;
  nameEn: string;
  nameNe: string;
  label: string;
  headquartersEn: string | null;
  headquartersNe: string | null;
  province: { id: number; nameEn: string; nameNe: string; label: string };
}

export interface LocalLevelTypeResponse {
  id: number;
  code: string;
  slug: string;
  nameEn: string;
  nameNe: string;
  label: string;
}

export interface LocalLevelResponse {
  id: number;
  districtId: number;
  typeId: number;
  nameEn: string;
  nameNe: string;
  label: string;
  district: { id: number; nameEn: string; nameNe: string; label: string };
  province: { id: number; nameEn: string; nameNe: string; label: string };
  type: LocalLevelTypeResponse;
}

export interface GeographySearchResult {
  level: 'PROVINCE' | 'DISTRICT' | 'LOCAL_LEVEL';
  id: number;
  nameEn: string;
  nameNe: string;
  label: string;
  path: string;
}

function label(
  nameEn: string,
  nameNe: string,
  locale: GeographyLocale,
): string {
  return locale === 'ne' ? nameNe : nameEn;
}

function resolveLocale(locale?: string): GeographyLocale {
  return locale === 'ne' ? 'ne' : 'en';
}

@Injectable()
export class GeographyService {
  constructor(private readonly prisma: PrismaService) {}

  async listProvinces(locale?: string): Promise<ProvinceResponse[]> {
    const resolvedLocale = resolveLocale(locale);
    const provinces = await this.prisma.nepalProvince.findMany({
      orderBy: { id: 'asc' },
    });
    return provinces.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameNe: p.nameNe,
      label: label(p.nameEn, p.nameNe, resolvedLocale),
      headquartersEn: p.headquartersEn,
      headquartersNe: p.headquartersNe,
    }));
  }

  async listDistricts(
    provinceId: number | undefined,
    locale?: string,
  ): Promise<DistrictResponse[]> {
    const resolvedLocale = resolveLocale(locale);

    if (provinceId !== undefined) {
      const province = await this.prisma.nepalProvince.findUnique({
        where: { id: provinceId },
      });
      if (!province) {
        throw new NotFoundException('Province not found');
      }
    }

    const districts = await this.prisma.nepalDistrict.findMany({
      where: provinceId !== undefined ? { provinceId } : undefined,
      include: { province: true },
      orderBy: { id: 'asc' },
    });

    return districts.map((d) => ({
      id: d.id,
      provinceId: d.provinceId,
      nameEn: d.nameEn,
      nameNe: d.nameNe,
      label: label(d.nameEn, d.nameNe, resolvedLocale),
      headquartersEn: d.headquartersEn,
      headquartersNe: d.headquartersNe,
      province: {
        id: d.province.id,
        nameEn: d.province.nameEn,
        nameNe: d.province.nameNe,
        label: label(d.province.nameEn, d.province.nameNe, resolvedLocale),
      },
    }));
  }

  async listLocalLevelTypes(
    locale?: string,
  ): Promise<LocalLevelTypeResponse[]> {
    const resolvedLocale = resolveLocale(locale);
    const types = await this.prisma.nepalLocalLevelType.findMany({
      orderBy: { id: 'asc' },
    });
    return types.map((t) => ({
      id: t.id,
      code: t.code,
      slug: t.slug,
      nameEn: t.nameEn,
      nameNe: t.nameNe,
      label: label(t.nameEn, t.nameNe, resolvedLocale),
    }));
  }

  async listLocalLevels(
    districtId: number | undefined,
    typeId: number | undefined,
    locale?: string,
  ): Promise<LocalLevelResponse[]> {
    const resolvedLocale = resolveLocale(locale);

    if (districtId !== undefined) {
      const district = await this.prisma.nepalDistrict.findUnique({
        where: { id: districtId },
      });
      if (!district) {
        throw new NotFoundException('District not found');
      }
    }
    if (typeId !== undefined) {
      const type = await this.prisma.nepalLocalLevelType.findUnique({
        where: { id: typeId },
      });
      if (!type) {
        throw new NotFoundException('Local level type not found');
      }
    }

    const where: { districtId?: number; typeId?: number } = {};
    if (districtId !== undefined) where.districtId = districtId;
    if (typeId !== undefined) where.typeId = typeId;

    const levels = await this.prisma.nepalLocalLevel.findMany({
      where,
      include: {
        district: { include: { province: true } },
        type: true,
      },
      orderBy: { id: 'asc' },
    });

    return levels.map((l) => this.toLocalLevelResponse(l, resolvedLocale));
  }

  async getLocalLevelById(
    id: number,
    locale?: string,
  ): Promise<LocalLevelResponse> {
    const resolvedLocale = resolveLocale(locale);
    const level = await this.prisma.nepalLocalLevel.findUnique({
      where: { id },
      include: {
        district: { include: { province: true } },
        type: true,
      },
    });
    if (!level) {
      throw new NotFoundException('Local level not found');
    }
    return this.toLocalLevelResponse(level, resolvedLocale);
  }

  async search(q: string, limit: number): Promise<GeographySearchResult[]> {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException(
        'Search query must be at least 2 characters',
      );
    }
    const resolvedLocale: GeographyLocale = 'en';

    const [provinces, districts, localLevels] = await Promise.all([
      this.prisma.nepalProvince.findMany({
        where: {
          OR: [
            { nameEn: { contains: trimmed, mode: 'insensitive' } },
            { nameNe: { contains: trimmed } },
          ],
        },
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.nepalDistrict.findMany({
        where: {
          OR: [
            { nameEn: { contains: trimmed, mode: 'insensitive' } },
            { nameNe: { contains: trimmed } },
          ],
        },
        include: { province: true },
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.nepalLocalLevel.findMany({
        where: {
          OR: [
            { nameEn: { contains: trimmed, mode: 'insensitive' } },
            { nameNe: { contains: trimmed } },
          ],
        },
        include: { district: { include: { province: true } } },
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    const results: GeographySearchResult[] = [
      ...provinces.map((p) => ({
        level: 'PROVINCE' as const,
        id: p.id,
        nameEn: p.nameEn,
        nameNe: p.nameNe,
        label: label(p.nameEn, p.nameNe, resolvedLocale),
        path: p.nameEn,
      })),
      ...districts.map((d) => ({
        level: 'DISTRICT' as const,
        id: d.id,
        nameEn: d.nameEn,
        nameNe: d.nameNe,
        label: label(d.nameEn, d.nameNe, resolvedLocale),
        path: `${d.nameEn}, ${d.province.nameEn}`,
      })),
      ...localLevels.map((l) => ({
        level: 'LOCAL_LEVEL' as const,
        id: l.id,
        nameEn: l.nameEn,
        nameNe: l.nameNe,
        label: label(l.nameEn, l.nameNe, resolvedLocale),
        path: `${l.nameEn}, ${l.district.nameEn}, ${l.district.province.nameEn}`,
      })),
    ];

    return results.slice(0, limit);
  }

  async getVersion() {
    const version = await this.prisma.referenceDatasetVersion.findUnique({
      where: { datasetKey: 'nepal-administrative-hierarchy' },
    });
    if (!version) {
      throw new NotFoundException(
        'Nepal geography dataset has not been seeded yet',
      );
    }
    return version;
  }

  private toLocalLevelResponse(
    level: {
      id: number;
      districtId: number;
      typeId: number;
      nameEn: string;
      nameNe: string;
      district: {
        id: number;
        nameEn: string;
        nameNe: string;
        province: { id: number; nameEn: string; nameNe: string };
      };
      type: {
        id: number;
        code: string;
        slug: string;
        nameEn: string;
        nameNe: string;
      };
    },
    locale: GeographyLocale,
  ): LocalLevelResponse {
    return {
      id: level.id,
      districtId: level.districtId,
      typeId: level.typeId,
      nameEn: level.nameEn,
      nameNe: level.nameNe,
      label: label(level.nameEn, level.nameNe, locale),
      district: {
        id: level.district.id,
        nameEn: level.district.nameEn,
        nameNe: level.district.nameNe,
        label: label(level.district.nameEn, level.district.nameNe, locale),
      },
      province: {
        id: level.district.province.id,
        nameEn: level.district.province.nameEn,
        nameNe: level.district.province.nameNe,
        label: label(
          level.district.province.nameEn,
          level.district.province.nameNe,
          locale,
        ),
      },
      type: {
        id: level.type.id,
        code: level.type.code,
        slug: level.type.slug,
        nameEn: level.type.nameEn,
        nameNe: level.type.nameNe,
        label: label(level.type.nameEn, level.type.nameNe, locale),
      },
    };
  }
}
