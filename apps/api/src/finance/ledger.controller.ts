import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';
import { ListLedgerEntriesQueryDto } from './dto/list-finance-records.query.dto';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
export class LedgerController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('entries')
  @Permissions('ledger:read')
  listEntries(
    @Query() query: ListLedgerEntriesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.listLedgerEntries(query, auth);
  }

  @Get('accounts')
  @Permissions('ledger:read')
  listAccounts(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listAccounts(auth);
  }
}
