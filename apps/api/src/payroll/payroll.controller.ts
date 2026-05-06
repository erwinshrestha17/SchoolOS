import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { PayrollActionDto } from './dto/payroll-action.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
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
  @Permissions('payroll:run:read')
  getPreview(
    @Query() query: PayrollPreviewQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollPreview(query, auth);
  }

  @Post('runs/preview')
  @Permissions('payroll:run:create')
  previewRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollPreview(
      {
        year: dto.periodYear,
        month: dto.periodMonth,
        workingDays: dto.workingDays,
      },
      auth,
    );
  }

  @Get('runs')
  @Permissions('payroll:run:read')
  listRuns(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listPayrollRuns(auth);
  }

  @Get('runs/:id')
  @Permissions('payroll:run:read')
  getRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRun(id, auth);
  }

  @Post('runs')
  @Permissions('payroll:run:create')
  createRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.createPayrollRun(dto, auth);
  }

  @Post('runs/preview-to-draft')
  @Permissions('payroll:run:create')
  createDraftFromPreview(
    @Body() dto: CreatePayrollRunDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.createPayrollRun(dto, auth);
  }

  @Post('runs/:id/approve')
  @Permissions('payroll:run:approve')
  approveRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.approvePayrollRun(id, auth);
  }

  @Post('runs/:id/review')
  @Permissions('payroll:run:review')
  reviewRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.reviewPayrollRun(id, auth);
  }

  @Post('runs/:id/submit-review')
  @Permissions('payroll:run:review')
  submitReview(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.reviewPayrollRun(id, auth);
  }

  @Post('runs/:id/reject')
  @Permissions('payroll:run:review')
  rejectRun(
    @Param('id') id: string,
    @Body() dto: PayrollActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.rejectPayrollRun(id, dto, auth);
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
  @Permissions('payroll:run:post')
  postRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.postPayrollRun(id, auth);
  }

  @Post('runs/:id/post-to-accounting')
  @Permissions('payroll:run:post')
  postRunToAccounting(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.postPayrollRun(id, auth);
  }

  @Post('runs/:id/mark-paid')
  @Permissions('payroll:run:pay')
  markPaid(
    @Param('id') id: string,
    @Body() dto: PayrollActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.markPayrollRunPaid(id, dto, auth);
  }

  @Get('payslips')
  @Permissions('payroll:payslip:read')
  listPayslips(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listPayslips(auth);
  }

  @Get('me/payslips')
  @Permissions('staff:read')
  listMyPayslips(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listMyPayslips(auth);
  }

  @Get('payslips/:payslipNumber.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:read', 'staff:read')
  getPayslipPdf(
    @Param('payslipNumber') payslipNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdf(payslipNumber, auth);
  }

  @Get('runs/:runId/staff/:staffId/payslip.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:payslip:read')
  getStaffPayslipPdf(
    @Param('runId') runId: string,
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdfForRunStaff(runId, staffId, auth);
  }

  @Get('statutory-deductions')
  @Permissions('payroll:salary:read')
  listStatutoryDeductions() {
    return this.payrollService.listStatutoryDeductions();
  }

  @Post('salary-structures')
  @Permissions('payroll:salary:write')
  createSalaryStructure(
    @Body() dto: CreateSalaryStructureDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.createSalaryStructure(dto, auth);
  }

  @Get('salary-structures')
  @Permissions('payroll:salary:read')
  listSalaryStructures(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listSalaryStructures(auth);
  }

  @Get('staff/:staffId/salary-structure')
  @Permissions('payroll:salary:read')
  getSalaryStructure(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getActiveSalaryStructure(staffId, auth);
  }

  @Patch('salary-structures/:id')
  @Permissions('payroll:salary:write')
  updateSalaryStructure(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryStructureDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.updateSalaryStructure(id, dto, auth);
  }

  @Post('salary-structures/:id/activate')
  @Permissions('payroll:salary:write')
  activateSalaryStructure(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.activateSalaryStructure(id, auth);
  }

  @Post('salary-structures/:id/archive')
  @Permissions('payroll:salary:write')
  archiveSalaryStructure(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.archiveSalaryStructure(id, auth);
  }

  @Get('reports/register')
  @Permissions('payroll:reports:read')
  getPayrollRegister(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRegister(auth);
  }

  @Get('reports/summary')
  @Permissions('payroll:reports:read')
  getPayrollSummary(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollSummary(auth);
  }

  @Get('reports/pf')
  @Permissions('payroll:reports:read')
  getPayrollPf(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRegister(auth);
  }

  @Get('reports/tds')
  @Permissions('payroll:reports:read')
  getPayrollTds(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRegister(auth);
  }

  @Get('reports/leave-deductions')
  @Permissions('payroll:reports:read')
  getPayrollLeaveDeductions(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRegister(auth);
  }

  @Get('reports/register.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll-register.csv"')
  @Permissions('payroll:exports:create')
  exportPayrollRegisterCsv(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.exportPayrollRegisterCsv(auth);
  }
}
