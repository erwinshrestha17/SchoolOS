import type { PermissionKey } from '../permissions.js';
import type { ReportFormat } from './reports.js';

export type FinancialMoney = string;

export type FinancialReportFamily =
  | 'AP'
  | 'AR'
  | 'AUD'
  | 'CB'
  | 'FEE'
  | 'FS'
  | 'MGMT'
  | 'PAY'
  | 'TAX';

export type FinancialAccountingBasis = 'ACCRUAL' | 'CASH';
export type FinancialPostingBasis =
  | 'POSTED_ONLY'
  | 'POSTED_WITH_PENDING_DISCLOSED';
export type FinancialReportClassification =
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'STATUTORY_DRAFT';
export type FinancialReportValidationStatus =
  | 'VALID'
  | 'WARNING'
  | 'BLOCKED';

export type FinancialReportId =
  | 'AP-01'
  | 'AP-06'
  | 'AP-08'
  | 'AP-13'
  | 'AP-17'
  | 'AP-18'
  | 'AR-01'
  | 'AR-02'
  | 'AR-03'
  | 'AR-04'
  | 'AR-05'
  | 'AR-06'
  | 'AUD-01'
  | 'AUD-02'
  | 'AUD-03'
  | 'AUD-04'
  | 'AUD-05'
  | 'AUD-06'
  | 'AUD-07'
  | 'AUD-08'
  | 'AUD-09'
  | 'AUD-10'
  | 'AUD-11'
  | 'AUD-12'
  | 'AUD-13'
  | 'AUD-16'
  | 'CB-01'
  | 'CB-02'
  | 'CB-03'
  | 'CB-04'
  | 'CB-05'
  | 'CB-06'
  | 'CB-08'
  | 'CB-09'
  | 'CB-10'
  | 'CB-11'
  | 'CB-12'
  | 'CB-13'
  | 'FEE-01'
  | 'FEE-02'
  | 'FEE-03'
  | 'FEE-04'
  | 'FEE-05'
  | 'FEE-06'
  | 'FEE-07'
  | 'FEE-08'
  | 'FEE-09'
  | 'FEE-10'
  | 'FEE-11'
  | 'FEE-12'
  | 'FEE-13'
  | 'FEE-14'
  | 'FEE-15'
  | 'FEE-16'
  | 'FEE-17'
  | 'FEE-18'
  | 'FEE-19'
  | 'FS-01'
  | 'FS-02'
  | 'FS-04'
  | 'FS-05'
  | 'FS-06'
  | 'FS-07'
  | 'MGMT-05'
  | 'MGMT-07'
  | 'MGMT-17'
  | 'PAY-01'
  | 'PAY-02'
  | 'PAY-03'
  | 'PAY-04'
  | 'PAY-08'
  | 'PAY-09'
  | 'PAY-10'
  | 'TAX-01'
  | 'TAX-02';

export type FinancialReportDefinition = {
  id: FinancialReportId;
  name: string;
  family: FinancialReportFamily;
  ownerModule: 'M3' | 'M7' | 'M11' | 'M11/M0' | 'M3/M11' | 'M7/M11';
  slice: '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09';
  formats: readonly ReportFormat[];
  requiredPermissions: readonly PermissionKey[];
  requiresProfessionalVerification?: boolean;
};

export type FinancialReportQuery = {
  fiscalYearId: string;
  fiscalPeriodId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Readonly<Record<string, string | readonly string[] | boolean>>;
};

export type FinancialReportDrilldown = {
  kind:
    | 'ACCOUNT'
    | 'JOURNAL'
    | 'VOUCHER'
    | 'SOURCE_RECORD'
    | 'PROTECTED_FILE';
  id: string;
  route: string;
};

export type FinancialReportRow = {
  id: string;
  cells: Readonly<Record<string, string | boolean | null>>;
  drilldown?: FinancialReportDrilldown;
};

export type FinancialReportResponse<
  TRow extends FinancialReportRow = FinancialReportRow,
> = {
  report: {
    id: FinancialReportId;
    definitionVersion: string;
    title: string;
    classification: FinancialReportClassification;
    requiresProfessionalVerification: boolean;
    professionalVerificationStatus:
      | 'NOT_REQUIRED'
      | 'NEEDS_PROFESSIONAL_VERIFICATION'
      | 'VERIFIED';
  };
  fiscalContext: {
    fiscalYearId: string;
    fiscalYearLabel: string;
    fiscalPeriodId: string | null;
    fiscalPeriodLabel: string | null;
    accountingBasis: FinancialAccountingBasis;
    postingBasis: FinancialPostingBasis;
  };
  normalizedFilters: Readonly<Record<string, string | readonly string[] | boolean>>;
  generatedAt: string;
  sourceFreshness: Array<{
    module: 'M3' | 'M7' | 'M11';
    refreshedAt: string;
    includesPending: boolean;
  }>;
  validation: {
    status: FinancialReportValidationStatus;
    warnings: readonly string[];
  };
  totals: Readonly<Record<string, FinancialMoney>>;
  rows: readonly TRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const STANDARD_FORMATS = ['json', 'csv', 'pdf', 'xlsx'] as const;
const ACCOUNTING_REPORT_PERMISSION = ['accounting:reports:read'] as const;
const FEE_REPORT_PERMISSION = ['reports:read'] as const;
const PAYROLL_REPORT_PERMISSION = ['payroll:reports:read'] as const;

export const P0_FINANCIAL_REPORT_CATALOG = [
  { id: 'AP-01', name: 'Expense Register', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AP-06', name: 'Accounts Payable Summary', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AP-08', name: 'Vendor Ledger', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AP-13', name: 'Payment Due Report', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AP-17', name: 'Petty Cash Expense Report', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AP-18', name: 'Recurring Expense Report', family: 'AP', ownerModule: 'M11', slice: '06', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AR-01', name: 'Student Invoice Register', family: 'AR', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'AR-02', name: 'Accounts Receivable Summary', family: 'AR', ownerModule: 'M3/M11', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AR-03', name: 'Debtor Ledger', family: 'AR', ownerModule: 'M3/M11', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AR-04', name: 'Credit Note Register', family: 'AR', ownerModule: 'M3/M11', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AR-05', name: 'Debit Note Register', family: 'AR', ownerModule: 'M3/M11', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AR-06', name: 'Unallocated Payment Report', family: 'AR', ownerModule: 'M3', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'AUD-01', name: 'Financial Audit Trail', family: 'AUD', ownerModule: 'M11/M0', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-02', name: 'Voucher Register', family: 'AUD', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-03', name: 'Unposted Voucher Report', family: 'AUD', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-04', name: 'Reversed Transaction Report', family: 'AUD', ownerModule: 'M11', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-05', name: 'Voided Transaction Register', family: 'AUD', ownerModule: 'M11', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-06', name: 'Backdated Entry Report', family: 'AUD', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-07', name: 'Period Reopening Report', family: 'AUD', ownerModule: 'M11', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-08', name: 'Manual Journal Report', family: 'AUD', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-09', name: 'High-Value Transaction Report', family: 'AUD', ownerModule: 'M11', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-10', name: 'Duplicate Payment Report', family: 'AUD', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-11', name: 'Missing Receipt Sequence Report', family: 'AUD', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-12', name: 'Approval Exception Report', family: 'AUD', ownerModule: 'M11', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-13', name: 'User Financial Activity Report', family: 'AUD', ownerModule: 'M11/M0', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'AUD-16', name: 'Supporting Document Exception Report', family: 'AUD', ownerModule: 'M11/M0', slice: '09', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-01', name: 'Cash Book', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-02', name: 'Bank Book', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-03', name: 'Cash Position Report', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-04', name: 'Bank Balance Report', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-05', name: 'Bank Reconciliation Statement', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-06', name: 'Unreconciled Transaction Report', family: 'CB', ownerModule: 'M11', slice: '05', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-08', name: 'Cash Deposit Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-09', name: 'Undeposited Collection Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-10', name: 'Payment Gateway Settlement Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-11', name: 'Wallet and QR Reconciliation Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-12', name: 'Cashier Closing Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'CB-13', name: 'Cash Variance Report', family: 'CB', ownerModule: 'M3/M11', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FEE-01', name: 'Student Fee Ledger', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-02', name: 'Fee Collection Analysis — Class and Section', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-03', name: 'Fee Collection Analysis — Fee Head', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-04', name: 'Fee Collection Analysis — Daily', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-05', name: 'Fee Collection Analysis — Monthly', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-06', name: 'Outstanding Fee Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-07', name: 'Receivables Aging', family: 'FEE', ownerModule: 'M3/M11', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FEE-08', name: 'Advance Fee Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-09', name: 'Partial Payment Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-10', name: 'Overpayment and Credit Balance Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-11', name: 'Fee Discount Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-12', name: 'Scholarship and Concession Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-13', name: 'Late Fee Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-14', name: 'Fee Waiver Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-15', name: 'Refund Report', family: 'FEE', ownerModule: 'M3', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-16', name: 'Voided and Cancelled Receipt Register', family: 'FEE', ownerModule: 'M3', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-17', name: 'Receipt Register', family: 'FEE', ownerModule: 'M3', slice: '03', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-18', name: 'Fee Collection Analysis — Payment Method', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FEE-19', name: 'Student Withdrawal Settlement Report', family: 'FEE', ownerModule: 'M3', slice: '02', formats: STANDARD_FORMATS, requiredPermissions: FEE_REPORT_PERMISSION },
  { id: 'FS-01', name: 'Statement of Financial Performance', family: 'FS', ownerModule: 'M11', slice: '08', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FS-02', name: 'Balance Sheet', family: 'FS', ownerModule: 'M11', slice: '08', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FS-04', name: 'Trial Balance', family: 'FS', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FS-05', name: 'General Ledger', family: 'FS', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FS-06', name: 'Journal Register', family: 'FS', ownerModule: 'M11', slice: '04', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'FS-07', name: 'Receipts and Payments Account', family: 'FS', ownerModule: 'M11', slice: '08', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'MGMT-05', name: 'Monthly Financial Performance', family: 'MGMT', ownerModule: 'M11', slice: '08', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'MGMT-07', name: 'Year-to-Date Financial Summary', family: 'MGMT', ownerModule: 'M11', slice: '08', formats: STANDARD_FORMATS, requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'MGMT-17', name: 'Financial KPI Dashboard', family: 'MGMT', ownerModule: 'M11', slice: '08', formats: ['json', 'pdf'], requiredPermissions: ACCOUNTING_REPORT_PERMISSION },
  { id: 'PAY-01', name: 'Payroll Summary', family: 'PAY', ownerModule: 'M7', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'PAY-02', name: 'Salary Expense Report', family: 'PAY', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'PAY-03', name: 'Payroll Liability Report', family: 'PAY', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'PAY-04', name: 'Tax Deduction Report', family: 'PAY', ownerModule: 'M7', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION, requiresProfessionalVerification: true },
  { id: 'PAY-08', name: 'Payroll Payment Reconciliation', family: 'PAY', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'PAY-09', name: 'Unpaid Salary Report', family: 'PAY', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'PAY-10', name: 'Payroll Journal Report', family: 'PAY', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION },
  { id: 'TAX-01', name: 'TDS Deduction Report', family: 'TAX', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION, requiresProfessionalVerification: true },
  { id: 'TAX-02', name: 'TDS Payable Report', family: 'TAX', ownerModule: 'M7/M11', slice: '07', formats: STANDARD_FORMATS, requiredPermissions: PAYROLL_REPORT_PERMISSION, requiresProfessionalVerification: true },
] as const satisfies readonly FinancialReportDefinition[];

export const P0_FINANCIAL_REPORT_IDS = P0_FINANCIAL_REPORT_CATALOG.map(
  ({ id }) => id,
) as readonly FinancialReportId[];
