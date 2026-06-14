import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AccountingM9Service } from './accounting-m9.service';
import { NEPAL_SCHOOL_CHART_TEMPLATE } from './m9-accounting.utils';
import { M9SourceService } from './m9-source.service';
import { M9TemplateService } from './m9-template.service';

@Controller('accounting/m9')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.accounting')
export class AccountingM9Controller {
  constructor(
    private readonly m9: AccountingM9Service,
    private readonly sources: M9SourceService,
    private readonly templates: M9TemplateService,
  ) {}

  @Get('health')
  @Permissions('accounting:reports:read')
  health() {
    return this.m9.health();
  }

  @Get('source-mappings')
  @Permissions('accounting:reports:read')
  listSourceMappings(@CurrentAuth() auth: AuthContext) {
    return this.sources.listMappings(auth);
  }

  @Get('source-mappings/health')
  @Permissions('accounting:reports:read')
  getSourceMappingHealth(@CurrentAuth() auth: AuthContext) {
    return this.sources.getSourceMappingHealth(auth);
  }

  @Get('chart-templates/nepal/preview')
  @Permissions('accounting:accounts:read')
  previewNepalChartTemplate() {
    return {
      template: 'NEPAL_SCHOOL_STANDARD',
      status: 'available',
      accountCount: NEPAL_SCHOOL_CHART_TEMPLATE.length,
      accounts: NEPAL_SCHOOL_CHART_TEMPLATE,
    };
  }

  @Post('chart-templates/nepal/import')
  @Permissions('accounting:accounts:write')
  importNepalChartTemplate(@CurrentAuth() auth: AuthContext) {
    return this.templates.importNepalChartTemplate(auth);
  }

  @Get('principal/snapshot')
  @Permissions('accounting:reports:read')
  principalSnapshot() {
    return { readOnly: true, status: 'pending-report-snapshot-service' };
  }
}
