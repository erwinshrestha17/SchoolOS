import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
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

  it('uses only preview, create, approve, and list helpers for the payroll runs workflow', () => {
    const apiClient = read('lib/api.ts');
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    for (const helper of [
      'listPayrollRuns',
      'createPayrollRun',
      'approvePayrollRun',
      'getPayrollPreview',
    ]) {
      assert.match(apiClient, new RegExp(`${helper}:`), `Missing API helper: ${helper}`);
      assert.match(payrollRuns, new RegExp(`api\\.${helper}`), `Payroll Runs UI does not use ${helper}`);
    }

    assert.doesNotMatch(payrollRuns, /api\.postPayrollRun/);
    assert.doesNotMatch(payrollRuns, /api\.listPayslips/);
    assert.doesNotMatch(payrollRuns, /api\.getPayslipPdf/);
    assert.doesNotMatch(payrollRuns, /postPayrollRun/);
    assert.doesNotMatch(payrollRuns, /listPayslips/);
    assert.doesNotMatch(payrollRuns, /getPayslipPdf/);
  });

  it('keeps Payroll Runs UI inside the Phase 2 approval boundary without M9 posting', () => {
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /Approval locks the payroll run/i);
    assert.match(payrollRuns, /does not post to accounting/i);
    assert.match(payrollRuns, /does not post to M9 Accounting/i);
    assert.match(payrollRuns, /salary slips are not generated yet|salary slip PDFs are deferred|does not.*generate salary slips/i);
    assert.match(payrollRuns, /disburse salaries|payroll disbursement/i);

    assert.doesNotMatch(payrollRuns, /createJournalEntry/);
    assert.doesNotMatch(payrollRuns, /AccountingPostingService/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/journal-entries/);
    assert.doesNotMatch(payrollRuns, /\/accounting\/ledger/);
    assert.doesNotMatch(payrollRuns, /\/ledger\/entries/);
    assert.doesNotMatch(payrollRuns, /payslipNumber|openPdfBlob|getPayslipPdf|listPayslips/);
  });

  it('keeps Payroll Runs permission-aware and avoids internal tenant leakage', () => {
    const payrollRuns = read('components/hr/payroll-runs.tsx');

    assert.match(payrollRuns, /hasPermissions\(\['payroll:manage'\]\)/);
    assert.match(payrollRuns, /payroll:read/);
    assert.match(payrollRuns, /payroll:manage/);
    assert.doesNotMatch(payrollRuns, /tenantId/);
    assert.doesNotMatch(payrollRuns, /objectKey|storageObjectKey|database/i);
  });
});
