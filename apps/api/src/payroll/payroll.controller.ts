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
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { PayrollActionDto } from './dto/payroll-action.dto';
import {
  PayrollDashboardSummaryQueryDto,
  PayrollRunListQueryDto,
  PayslipListQueryDto,
  SalaryStructureListQueryDto,
  StaffContractListQueryDto,
} from './dto/payroll-list-query.dto';
import { PayrollPreviewQueryDto } from './dto/payroll-preview-query.dto';
import { PayrollReportQueryDto } from './dto/payroll-report-query.dto';
import { PayslipRegenerationJobSummaryDto } from './dto/payslip-regeneration-job.dto';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
import { PayrollSalarySlipService } from './payroll-salary-slip.service';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.payroll')
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

  @Post('preview')
  @Permissions('payroll:run:create')
  previewPayroll(
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
  listRuns(
    @Query() query: PayrollRunListQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.listPayrollRuns(query, auth);
  }

  @Get('dashboard-summary')
  @Permissions('payroll:run:read')
  getDashboardSummary(
    @Query() query: PayrollDashboardSummaryQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollDashboardSummary(query, auth);
  }

  @Get('runs/:id')
  @Permissions('payroll:run:read')
  getRun(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.payrollService.getPayrollRun(id, auth);
  }

  @Post('runs/:runId/payslips/:payslipId/regeneration-jobs')
  @Permissions('payroll:payslip:generate')
  @ApiOperation({
    summary: 'Queue or reuse a protected payslip regeneration job',
    description:
      'Requires payroll:payslip:generate. The response exposes only bounded job status and generation counts; queue payloads, storage keys, provider errors, and raw failure reasons are not returned.',
  })
  @ApiParam({ name: 'runId', description: 'Tenant-scoped payroll run id' })
  @ApiParam({ name: 'payslipId', description: 'Payslip id within the run' })
  @ApiResponse({
    status: 201,
    type: PayslipRegenerationJobSummaryDto,
    description:
      'Queued job summary, or the active tenant/run/payslip-scoped job if one is already running.',
  })
  queuePayslipRegeneration(
    @Param('runId') runId: string,
    @Param('payslipId') payslipId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.queuePayslipRegenerationJob(
      runId,
      payslipId,
      auth,
    );
  }

  @Get('runs/:runId/payslips/:payslipId/regeneration-jobs/:jobId')
  @Permissions('payroll:payslip:generate')
  @ApiOperation({
    summary: 'Read protected payslip regeneration job status',
    description:
      'Requires payroll:payslip:generate. Job lookup is scoped to the authenticated tenant, payroll run, payslip, and job id.',
  })
  @ApiParam({ name: 'runId', description: 'Tenant-scoped payroll run id' })
  @ApiParam({ name: 'payslipId', description: 'Payslip id within the run' })
  @ApiParam({ name: 'jobId', description: 'Payslip regeneration job id' })
  @ApiOkResponse({
    type: PayslipRegenerationJobSummaryDto,
    description:
      'Bounded regeneration status with QUEUED, PROCESSING, SUCCEEDED, or FAILED.',
  })
  getPayslipRegenerationJob(
    @Param('runId') runId: string,
    @Param('payslipId') payslipId: string,
    @Param('jobId') jobId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipRegenerationJob(
      runId,
      payslipId,
      jobId,
      auth,
    );
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
    return this.payrollService.submitPayrollRunForReview(id, auth);
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

  @Post('runs/:id/reverse')
  @Permissions('payroll:run:reverse')
  reverseRun(
    @Param('id') id: string,
    @Body() dto: PayrollActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.reversePayrollRun(id, dto, auth);
  }

  @Get('payslips')
  @Permissions('payroll:read')
  listPayslips(
    @Query() query: PayslipListQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.listPayslips(query, auth);
  }

  @Get('me/payslips')
  @Permissions('staff:read')
  listMyPayslips(
    @Query() query: PayslipListQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.listMyPayslips(query, auth);
  }

  @Get('me/payslips/:payslipNumber.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('staff:read')
  getMyPayslipPdf(
    @Param('payslipNumber') payslipNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdf(payslipNumber, auth);
  }

  @Get('payslips/:payslipNumber/pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:payslip:read')
  getPayslipPdfAlias(
    @Param('payslipNumber') payslipNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdf(payslipNumber, auth);
  }

  @Get('payslips/:payslipNumber.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:payslip:read')
  getPayslipPdf(
    @Param('payslipNumber') payslipNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdf(payslipNumber, auth);
  }

  @Get('runs/:runId/staff/:staffId/payslip.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('payroll:read')
  getStaffPayslipPdf(
    @Param('runId') runId: string,
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayslipPdfForRunStaff(runId, staffId, auth);
  }

  @Get('statutory-deductions')
  @Permissions('payroll:salary:read')
  listStatutoryDeductions(@CurrentAuth() auth: AuthContext) {
    return this.payrollService.listStatutoryDeductions(auth);
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
  listSalaryStructures(
    @Query() query: SalaryStructureListQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.listSalaryStructures(query, auth);
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

  @Get('runs/:id/register')
  @Permissions('payroll:reports:read')
  getPayrollRunRegister(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollRegister(auth, id);
  }

  @Get('runs/:id/register/export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll-register.csv"')
  @Permissions('payroll:exports:create')
  exportPayrollRunRegisterCsv(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.exportPayrollRegisterCsv(auth, id);
  }

  @Get('reports/register')
  @Permissions('payroll:reports:read')
  getPayrollRegister(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollRegister(auth, query);
  }

  @Get('reports/summary')
  @Permissions('payroll:reports:read')
  getPayrollSummary(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollSummary(auth, query);
  }

  @Get('reports/pf')
  @Permissions('payroll:reports:read')
  getPayrollPf(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollPfSummary(auth, query);
  }

  @Get('reports/tds')
  @Permissions('payroll:reports:read')
  getPayrollTds(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollTdsSummary(auth, query);
  }

  @Get('reports/salary-components')
  @Permissions('payroll:reports:read')
  getSalaryComponentSummary(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getSalaryComponentSummary(auth, query);
  }

  @Get('reports/leave-deductions')
  @Permissions('payroll:reports:read')
  getPayrollLeaveDeductions(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.getPayrollLeaveDeductionSummary(auth, query);
  }

  @Get('reports/register.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll-register.csv"')
  @Permissions('payroll:exports:create')
  exportPayrollRegisterCsv(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.exportPayrollRegisterCsv(auth, query);
  }

  @Get('reports/pf/export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll-pf-report.csv"')
  @Permissions('payroll:exports:create')
  exportPayrollPfCsv(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.exportPayrollPfCsv(auth, query);
  }

  @Get('reports/tds/export.csv')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="payroll-tds-report.csv"',
  )
  @Permissions('payroll:exports:create')
  exportPayrollTdsCsv(
    @Query() query: PayrollReportQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.payrollService.exportPayrollTdsCsv(auth, query);
  }
}
