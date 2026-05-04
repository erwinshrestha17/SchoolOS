import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { PayrollSalarySlipService } from './payroll-salary-slip.service';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly salarySlipService: PayrollSalarySlipService,
  ) {}

  @Get('preview')
  @Permissions('payroll:read')
  getPreview(
    @Query() query: PayrollPreviewQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollPreview(query, auth);
  }

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

  @Post('runs/preview-to-draft')
  @Permissions('payroll:manage')
  createDraftFromPreview(
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

  @Get('runs/:runId/lines/:lineId/salary-slip.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:read')
  getApprovedSalarySlipPdf(
    @Param('runId') runId: string,
    @Param('lineId') lineId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.salarySlipService.getApprovedSalarySlipPdf(runId, lineId, auth);
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
