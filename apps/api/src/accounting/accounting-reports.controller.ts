import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AccountingReportsService } from './accounting-reports.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';

@ApiTags('Accounting Reports')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
@Controller('accounting/reports')
export class AccountingReportsController {
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance report' })
  @Permissions('accounting:reports:trial-balance', 'accounting:read', 'accounting:reports:read')
  async getTrialBalance(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TrialBalanceQueryDto,
  ) {
    return this.reportsService.getTrialBalance(auth.tenantId, query);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'Get general ledger report' })
  @Permissions('accounting:reports:general-ledger', 'accounting:read', 'accounting:reports:read')
  async getGeneralLedger(
    @CurrentAuth() auth: AuthContext,
    @Query() query: GeneralLedgerQueryDto,
  ) {
    return this.reportsService.getGeneralLedger(auth.tenantId, query);
  }
}
