import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AccountingBudgetService } from './accounting-budget.service';
import { CreateFiscalBudgetDto } from './dto/create-fiscal-budget.dto';
import { UpsertFiscalBudgetLinesDto } from './dto/upsert-fiscal-budget-lines.dto';
import { ApproveFiscalBudgetDto } from './dto/approve-fiscal-budget.dto';

@ApiTags('Accounting Budgets')
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.accounting')
@Controller('accounting/budgets')
export class AccountingBudgetController {
  constructor(private readonly budgetService: AccountingBudgetService) {}

  @Get()
  @ApiOperation({ summary: 'List fiscal budgets' })
  @Permissions('accounting:budgets:read', 'accounting:read')
  async listBudgets(
    @CurrentAuth() auth: AuthContext,
    @Query('fiscalYearId') fiscalYearId?: string,
  ) {
    return this.budgetService.listBudgets(auth.tenantId, fiscalYearId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a fiscal budget draft' })
  @Permissions('accounting:budgets:write', 'accounting:read')
  async createBudget(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateFiscalBudgetDto,
  ) {
    return this.budgetService.createBudget(auth.tenantId, auth.userId, dto);
  }

  @Put(':id/lines')
  @ApiOperation({ summary: 'Upsert fiscal budget lines' })
  @Permissions('accounting:budgets:write', 'accounting:read')
  async upsertLines(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpsertFiscalBudgetLinesDto,
  ) {
    return this.budgetService.upsertBudgetLines(
      auth.tenantId,
      auth.userId,
      id,
      dto,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a fiscal budget' })
  @Permissions('accounting:budgets:write', 'accounting:read')
  async approveBudget(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: ApproveFiscalBudgetDto,
  ) {
    return this.budgetService.approveBudget(
      auth.tenantId,
      auth.userId,
      id,
      dto,
    );
  }
}
