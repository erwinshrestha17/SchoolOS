import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

function readMany(relativePaths) {
  return relativePaths.map((relativePath) => read(relativePath)).join('\n');
}

describe('Payroll Runs UI contracts', () => {
  it('renders Payroll Runs from the HR workspace instead of the preview-only tab', () => {
    const workspace = read('components/hr/hr-workspace.tsx');

    assert.equal(
      existsSync(join(webRoot, 'components/hr/payroll-runs.tsx')),
      true,
    );
    assert.match(workspace, /import \{ PayrollRuns \} from '\.\/payroll-runs'/);
    assert.match(workspace, /label: 'Payroll Runs'/);
    assert.match(workspace, /<PayrollRuns \/>/);
    assert.doesNotMatch(workspace, /label: 'Payroll Preview'/);
    assert.doesNotMatch(workspace, /<PayrollPreview \/>/);
  });

  it('uses only preview, create, approve, post, list, and approved salary-slip PDF helpers', () => {
    const apiClient = readMany(['lib/api/payroll.ts', 'lib/api/client.ts']);
    const payrollRuns = read('components/hr/payroll-runs.tsx');
    const payrollWorkflow = readMany([
      'components/hr/payroll-runs.tsx',
      'components/hr/payroll-action-dialog.tsx',
    ]);

    for (const helper of [
      'listPayrollRuns',
      'createPayrollRun',
      'approvePayrollRun',
      'postPayrollRun',
      'getPayrollPreview',
    ]) {
      assert.match(
        apiClient,
        new RegExp(`${helper}:`),
        `Missing API helper: ${helper}`,
      );
      assert.match(
        payrollWorkflow,
        new RegExp(`api\\.${helper}`),
        `Payroll Runs UI does not use ${helper}`,
      );
    }

    assert.match(apiClient, /openApprovedSalarySlipPdf/);
    assert.match(apiClient, /salary-slip\.pdf/);
    assert.match(apiClient, /%PDF-/);
    assert.match(payrollRuns, /openApprovedSalarySlipPdf/);
    assert.match(payrollRuns, /selectedRun\.status === 'APPROVED'/);
    assert.match(payrollRuns, /Download Salary Slip PDF/);
    assert.match(payrollRuns, /Post to M11 Accounting/);

    assert.doesNotMatch(payrollRuns, /api\.listPayslips/);
    assert.doesNotMatch(payrollRuns, /api\.getPayslipPdf/);
    assert.doesNotMatch(payrollRuns, /listPayslips/);
    assert.doesNotMatch(payrollRuns, /getPayslipPdf/);
  });

  it('keeps Payroll Runs UI inside the posting boundary with reasoned reversal', () => {
    const apiClient = readMany(['lib/api/payroll.ts', 'lib/api/client.ts']);
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /Approval locks payroll calculations/i);
    assert.match(
      payrollRuns,
      /Posting is a separate\s+APPROVED-to-POSTED action/i,
    );
    assert.match(payrollRuns, /creates the M11 payroll accrual\s+journal/i);
    assert.match(payrollRuns, /backend accounting posting\s+boundary/i);
    assert.match(payrollRuns, /does\s+not disburse salaries/i);
    assert.match(
      payrollRuns,
      /reversal is a separate reasoned backend\s+workflow/i,
    );
    assert.match(
      payrollRuns,
      /posted runs remain\s+immutable|allow editing posted runs|enable editing posted runs/i,
    );
    assert.match(payrollRuns, /selectedRun\.status === 'APPROVED'/);
    assert.match(payrollRuns, /selectedRun\.status === 'POSTED'/);

    assert.doesNotMatch(payrollRuns, /createJournalEntry/);
    assert.doesNotMatch(payrollRuns, /AccountingPostingService/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/journal-entries/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/ledger/);
    assert.doesNotMatch(payrollRuns, /\/ledger\/entries/);
    assert.doesNotMatch(
      payrollRuns,
      /disbursePayroll|paySalary|releasePayment|voidPostedPayroll/i,
    );
    assert.doesNotMatch(
      payrollRuns,
      /payslipNumber|openPdfBlob|getPayslipPdf|listPayslips/,
    );
    assert.doesNotMatch(
      apiClient,
      /disbursePayroll|paySalary|releasePayment|voidPostedPayroll/i,
    );
    assert.match(apiClient, /reversePayrollRun/);
  });

  it('keeps Payroll Runs permission-aware and avoids internal tenant or journal identifier leakage', () => {
    const apiClient = readMany(['lib/api/payroll.ts', 'lib/api/client.ts']);
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /hasPermissions\(\['payroll:manage'\]\)/);
    assert.match(payrollRuns, /payroll:read/);
    assert.match(payrollRuns, /payroll:manage/);
    assert.doesNotMatch(payrollRuns, /tenantId/);
    assert.doesNotMatch(payrollRuns, /objectKey|storageObjectKey|database/i);
    assert.doesNotMatch(
      payrollRuns,
      /\{selectedRun\.journalEntryId\}|Journal ID|journalEntryId:/,
    );
    assert.doesNotMatch(apiClient, /objectKey|storageObjectKey|database/i);
  });

  it('keeps staff self-service payslip downloads on the staff-scoped endpoint', () => {
    const apiClient = read('lib/api/payroll.ts');
    const myPayslips = read('components/staff/my-payslips.tsx');
    const adminPayslips = read('components/hr/payslip-list.tsx');

    assert.match(apiClient, /openMyPayslipPdf/);
    assert.match(
      apiClient,
      /\/payroll\/me\/payslips\/\$\{encodeURIComponent\(payslipNumber\)\}\.pdf/,
    );
    assert.match(myPayslips, /api\.openMyPayslipPdf/);
    assert.match(myPayslips, /api\.listMyPayslips/);
    assert.doesNotMatch(myPayslips, /api\.openPayslipPdf/);
    assert.match(adminPayslips, /api\.openPayslipPdf/);
  });

  it('uses backend exception totals and maps missing payslip files to regeneration guidance', () => {
    const client = read('lib/api/client.ts');
    const hrDashboard = read('app/dashboard/hr/page.tsx');
    const adminPayslips = read('components/hr/payslip-list.tsx');
    const myPayslips = read('components/staff/my-payslips.tsx');

    assert.match(hrDashboard, /title="Payroll Exceptions"/);
    assert.match(hrDashboard, /selectedRun\?\.validationExceptionCount/);
    assert.match(hrDashboard, /href="\/dashboard\/payroll\/readiness"/);
    assert.match(hrDashboard, /Backend-owned readiness queue/);
    assert.match(client, /throw new ApiRequestError\(/);
    assert.match(adminPayslips, /error instanceof ApiRequestError/);
    assert.match(adminPayslips, /error\.statusCode === 409/);
    assert.match(adminPayslips, /Regenerate payslips before downloading/);
    assert.match(myPayslips, /error instanceof ApiRequestError/);
    assert.match(myPayslips, /error\.statusCode === 409/);
    assert.match(myPayslips, /Ask your payroll administrator to regenerate it/);
  });

  it('queues and tracks payslip regeneration behind the dedicated payroll permission', () => {
    const payrollApi = read('lib/api/payroll.ts');
    const adminPayslips = read('components/hr/payslip-list.tsx');
    const payrollController = read('../api/src/payroll/payroll.controller.ts');
    const regenerationDto = read(
      '../api/src/payroll/dto/payslip-regeneration-job.dto.ts',
    );
    const permissionCatalog = readMany([
      '../../packages/core/src/permissions/catalog/payroll.ts',
      '../../packages/core/src/permissions/roles.ts',
    ]);

    assert.match(permissionCatalog, /resource: "payroll:payslip"/);
    assert.match(permissionCatalog, /action: "generate"/);
    assert.match(permissionCatalog, /"payroll:payslip:generate"/);
    assert.match(
      payrollController,
      /@Post\('runs\/:runId\/payslips\/:payslipId\/regeneration-jobs'\)/,
    );
    assert.match(
      payrollController,
      /@Get\('runs\/:runId\/payslips\/:payslipId\/regeneration-jobs\/:jobId'\)/,
    );
    assert.match(
      payrollController,
      /@Permissions\('payroll:payslip:generate'\)/,
    );
    assert.match(payrollController, /PayslipRegenerationJobSummaryDto/);
    assert.match(
      regenerationDto,
      /export class PayslipRegenerationJobSummaryDto/,
    );
    assert.match(regenerationDto, /QUEUED/);
    assert.match(regenerationDto, /PROCESSING/);
    assert.match(regenerationDto, /SUCCEEDED/);
    assert.match(regenerationDto, /FAILED/);
    assert.match(payrollApi, /queuePayslipRegeneration:/);
    assert.match(payrollApi, /getPayslipRegenerationJob:/);
    assert.match(
      payrollApi,
      /payslips\/\$\{encodeURIComponent\(payslipId\)\}\/regeneration-jobs/,
    );
    assert.match(
      adminPayslips,
      /hasPermissions\(\[\s*["']payroll:payslip:generate["']/,
    );
    assert.match(adminPayslips, /api\.queuePayslipRegeneration/);
    assert.match(adminPayslips, /api\.getPayslipRegenerationJob/);
    assert.match(adminPayslips, /function queuePayslipRegeneration/);
    assert.match(adminPayslips, /isRegenerationPendingFor/);
    assert.match(adminPayslips, /Regenerate/);
    assert.match(adminPayslips, /refetchInterval/);
    for (const status of ['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED']) {
      assert.match(adminPayslips, new RegExp(`["']${status}["']`));
    }
    assert.match(adminPayslips, /Download regenerated PDF/);
  });
});
