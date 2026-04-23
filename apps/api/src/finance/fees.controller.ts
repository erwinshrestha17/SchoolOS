import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { FinanceService } from './finance.service';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class FeesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('heads')
  @Permissions('fees:manage')
  listFeeHeads(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listFeeHeads(auth);
  }

  @Post('heads')
  @Permissions('fees:manage')
  createFeeHead(
    @Body() dto: CreateFeeHeadDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createFeeHead(dto, auth);
  }

  @Get('plans')
  @Permissions('fees:manage')
  listFeePlans(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listFeePlans(auth);
  }

  @Post('plans')
  @Permissions('fees:manage')
  createFeePlan(
    @Body() dto: CreateFeePlanDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.financeService.createFeePlan(dto, auth);
  }

  @Get('invoices')
  @Permissions('fees:manage')
  listInvoices(@CurrentAuth() auth: AuthContext) {
    return this.financeService.listInvoices(auth);
  }
}
