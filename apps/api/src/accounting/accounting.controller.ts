import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AccountingService } from './accounting.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('periods')
  @Permissions('accounting:read')
  listPeriods(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.listPeriods(auth);
  }

  @Post('periods')
  @Permissions('accounting:close')
  createPeriod(
    @Body() dto: CreateAccountingPeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accountingService.createPeriod(dto, auth);
  }

  @Get('reports')
  @Permissions('accounting:read')
  reports(@CurrentAuth() auth: AuthContext) {
    return this.accountingService.buildReports(auth);
  }

  @Post('closing/:id')
  @Permissions('accounting:close')
  closePeriod(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.accountingService.closePeriod(id, auth);
  }
}
