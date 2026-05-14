import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { PayrollService } from '../payroll/payroll.service';
import { CreateStaffContractDto } from './dto/create-staff-contract.dto';

@Controller('hr/contracts')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrContractsController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @Permissions('hr:read')
  listContracts(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listContracts(auth);
  }

  @Post()
  @Permissions('hr:manage')
  createContract(
    @Body() dto: CreateStaffContractDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.createContract(dto, auth);
  }
}
