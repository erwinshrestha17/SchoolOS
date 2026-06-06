import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.fees')
export class LedgerController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('entries')
  @Permissions('ledger:read')
  listEntries(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listLedgerEntries(auth);
  }

  @Get('accounts')
  @Permissions('ledger:read')
  listAccounts(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listAccounts(auth);
  }
}
