import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('runs')
  @Permissions('payroll:read')
  listRuns(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listPayrollRuns(auth);
  }

  @Post('runs')
  @Permissions('payroll:manage')
  createRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.createPayrollRun(dto, auth);
  }

  @Post('runs/:id/approve')
  @Permissions('payroll:manage')
  approveRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.approvePayrollRun(id, auth);
  }

  @Post('runs/:id/review')
  @Permissions('payroll:manage')
  reviewRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.reviewPayrollRun(id, auth);
  }

  @Post('runs/:id/post')
  @Permissions('payroll:manage')
  postRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.postPayrollRun(id, auth);
  }

  @Get('payslips')
  @Permissions('payroll:read')
  listPayslips(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listPayslips(auth);
  }

  @Get('payslips/:payslipNumber.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:read')
  getPayslipPdf(
    @Param('payslipNumber') payslipNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdf(payslipNumber, auth);
  }

  @Get('statutory-deductions')
  @Permissions('payroll:read')
  listStatutoryDeductions() {
    return this.payrollService.listStatutoryDeductions();
  }
}
