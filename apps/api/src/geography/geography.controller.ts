import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { GeographyService } from './geography.service';
import { ListDistrictsDto } from './dto/list-districts.dto';
import { ListLocalLevelsDto } from './dto/list-local-levels.dto';
import { SearchGeographyDto } from './dto/search-geography.dto';

const LONG_CACHE = 'public, max-age=86400';
const NO_CACHE = 'private, no-cache';

function computeEtag(payload: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  return `"${hash}"`;
}

/**
 * Sends a cached, ETag-validated payload. Returns true if a 304 was sent
 * (caller must not write to `res` again); false if the caller should still
 * return `data` to let the response-envelope interceptor wrap and send it.
 */
function sendCached(
  res: Response,
  ifNoneMatch: string | undefined,
  data: unknown,
  cacheControl: string,
): boolean {
  const etag = computeEtag(data);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('ETag', etag);
  if (ifNoneMatch === etag) {
    res.status(304).end();
    return true;
  }
  return false;
}

// Read-only, globally-shared reference data. No tenant data is exposed here;
// JwtAuthGuard + TenantActiveGuard only ensure the caller is an authenticated,
// active member of some tenant (prevents anonymous scraping) -- every Teacher,
// admin, or other persona reads the same rows, so no permission check gates
// these routes beyond "is logged in."
@Controller('reference/nepal')
@UseGuards(JwtAuthGuard, TenantActiveGuard)
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}

  @Get('provinces')
  async listProvinces(
    @Query('locale') locale: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geographyService.listProvinces(locale);
    if (sendCached(res, ifNoneMatch, data, LONG_CACHE)) return;
    return data;
  }

  @Get('districts')
  async listDistricts(
    @Query() query: ListDistrictsDto,
    @Query('locale') locale: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geographyService.listDistricts(
      query.provinceId,
      locale,
    );
    if (sendCached(res, ifNoneMatch, data, LONG_CACHE)) return;
    return data;
  }

  @Get('local-level-types')
  async listLocalLevelTypes(
    @Query('locale') locale: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geographyService.listLocalLevelTypes(locale);
    if (sendCached(res, ifNoneMatch, data, LONG_CACHE)) return;
    return data;
  }

  @Get('local-levels')
  async listLocalLevels(
    @Query() query: ListLocalLevelsDto,
    @Query('locale') locale: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geographyService.listLocalLevels(
      query.districtId,
      query.typeId,
      locale,
    );
    if (sendCached(res, ifNoneMatch, data, LONG_CACHE)) return;
    return data;
  }

  @Get('local-levels/:id')
  async getLocalLevel(
    @Param('id', ParseIntPipe) id: number,
    @Query('locale') locale: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geographyService.getLocalLevelById(id, locale);
    if (sendCached(res, ifNoneMatch, data, LONG_CACHE)) return;
    return data;
  }

  @Get('search')
  async search(
    @Query() query: SearchGeographyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', NO_CACHE);
    return this.geographyService.search(query.q, query.limit ?? 20);
  }

  @Get('version')
  async getVersion(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', NO_CACHE);
    return this.geographyService.getVersion();
  }
}
