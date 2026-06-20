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

    assert.equal(existsSync(join(webRoot, 'components/hr/payroll-runs.tsx')), true);
    assert.match(workspace, /import \{ PayrollRuns \} from '\.\/payroll-runs'/);
    assert.match(workspace, /label: 'Payroll Runs'/);
    assert.match(workspace, /<PayrollRuns \/>/);
    assert.doesNotMatch(workspace, /label: 'Payroll Preview'/);
    assert.doesNotMatch(workspace, /<PayrollPreview \/>/);
  });

  it('uses only preview, create, approve, post, list, and approved salary-slip PDF helpers', () => {
    const apiClient = readMany([
      'lib/api/payroll.ts',
      'lib/api/client.ts',
    ]);
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    for (const helper of [
      'listPayrollRuns',
      'createPayrollRun',
      'approvePayrollRun',
      'postPayrollRun',
      'getPayrollPreview',
    ]) {
      assert.match(apiClient, new RegExp(`${helper}:`), `Missing API helper: ${helper}`);
      assert.match(payrollRuns, new RegExp(`api\\.${helper}`), `Payroll Runs UI does not use ${helper}`);
    }

    assert.match(apiClient, /openApprovedSalarySlipPdf/);
    assert.match(apiClient, /salary-slip\.pdf/);
    assert.match(apiClient, /%PDF-/);
    assert.match(payrollRuns, /openApprovedSalarySlipPdf/);
    assert.match(payrollRuns, /selectedRun\.status === 'APPROVED'/);
    assert.match(payrollRuns, /Open Salary Slip PDF/);
    assert.match(payrollRuns, /Post to M11 Accounting/);

    assert.doesNotMatch(payrollRuns, /api\.listPayslips/);
    assert.doesNotMatch(payrollRuns, /api\.getPayslipPdf/);
    assert.doesNotMatch(payrollRuns, /listPayslips/);
    assert.doesNotMatch(payrollRuns, /getPayslipPdf/);
  });

  it('keeps Payroll Runs UI inside the Phase 2 posting boundary without disbursement or reversals', () => {
    const apiClient = readMany([
      'lib/api/payroll.ts',
      'lib/api/client.ts',
    ]);
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /Approval locks payroll calculations/i);
    assert.match(payrollRuns, /Posting is a separate APPROVED-to-POSTED action/i);
    assert.match(payrollRuns, /creates the M11 payroll accrual journal/i);
    assert.match(payrollRuns, /backend accounting posting boundary/i);
    assert.match(payrollRuns, /does not disburse salaries/i);
    assert.match(payrollRuns, /does not.*create reversal entries/i);
    assert.match(payrollRuns, /allow editing posted runs|enable editing posted runs/i);
    assert.match(payrollRuns, /selectedRun\.status === 'APPROVED'/);
    assert.match(payrollRuns, /selectedRun\.status === 'POSTED'/);

    assert.doesNotMatch(payrollRuns, /createJournalEntry/);
    assert.doesNotMatch(payrollRuns, /AccountingPostingService/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/journal-entries/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/ledger/);
    assert.doesNotMatch(payrollRuns, /\/ledger\/entries/);
    assert.doesNotMatch(payrollRuns, /disbursePayroll|paySalary|releasePayment|reversePayroll|voidPostedPayroll/i);
    assert.doesNotMatch(payrollRuns, /payslipNumber|openPdfBlob|getPayslipPdf|listPayslips/);
    assert.doesNotMatch(apiClient, /disbursePayroll|paySalary|releasePayment|reversePayroll|voidPostedPayroll/i);
  });

  it('keeps Payroll Runs permission-aware and avoids internal tenant or journal identifier leakage', () => {
    const apiClient = readMany([
      'lib/api/payroll.ts',
      'lib/api/client.ts',
    ]);
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /hasPermissions\(\['payroll:manage'\]\)/);
    assert.match(payrollRuns, /payroll:read/);
    assert.match(payrollRuns, /payroll:manage/);
    assert.doesNotMatch(payrollRuns, /tenantId/);
    assert.doesNotMatch(payrollRuns, /objectKey|storageObjectKey|database/i);
    assert.doesNotMatch(payrollRuns, /\{selectedRun\.journalEntryId\}|Journal ID|journalEntryId:/);
    assert.doesNotMatch(apiClient, /objectKey|storageObjectKey|database/i);
  });

  it('keeps staff self-service payslip downloads on the staff-scoped endpoint', () => {
    const apiClient = read('lib/api/payroll.ts');
    const myPayslips = read('components/staff/my-payslips.tsx');
    const adminPayslips = read('components/hr/payslip-list.tsx');

    assert.match(apiClient, /openMyPayslipPdf/);
    assert.match(apiClient, /\/payroll\/me\/payslips\/\$\{encodeURIComponent\(payslipNumber\)\}\.pdf/);
    assert.match(myPayslips, /api\.openMyPayslipPdf/);
    assert.match(myPayslips, /api\.listMyPayslips/);
    assert.doesNotMatch(myPayslips, /api\.openPayslipPdf/);
    assert.match(adminPayslips, /api\.openPayslipPdf/);
  });
});
