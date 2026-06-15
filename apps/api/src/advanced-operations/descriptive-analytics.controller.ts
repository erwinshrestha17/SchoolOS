import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { DescriptiveAnalyticsService } from './descriptive-analytics.service';
import {
  AnalyticsSummaryQueryDto,
  RefreshAnalyticsSummaryDto,
} from './dto/analytics.dto';

@ApiTags('advanced-analytics')
@Controller('advanced/analytics')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class DescriptiveAnalyticsController {
  constructor(private readonly service: DescriptiveAnalyticsService) {}

  @Get('summaries')
  @Permissions('advanced:analytics:read')
  listSummaries(
    @Query() query: AnalyticsSummaryQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listSummaries(auth, query);
  }

  @Post('refresh')
  @Permissions('advanced:analytics:refresh')
  refresh(
    @Body() dto: RefreshAnalyticsSummaryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.refresh(dto, auth);
  }
}
