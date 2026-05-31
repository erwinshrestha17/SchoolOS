import { ChartAccountType, FeeFrequency, PaymentMethod } from '@prisma/client';

export const DEFAULT_CHART_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: ChartAccountType;
}> = [
  { code: '1000', name: 'Cash in Hand', type: ChartAccountType.ASSET },
  { code: '1010', name: 'Bank Account', type: ChartAccountType.ASSET },
  { code: '1100', name: 'Accounts Receivable', type: ChartAccountType.ASSET },
  { code: '1200', name: 'Student Receivables', type: ChartAccountType.ASSET },
  { code: '1300', name: 'Library Assets', type: ChartAccountType.ASSET },
  { code: '1400', name: 'Equipment/Furniture', type: ChartAccountType.ASSET },
  { code: '2200', name: 'Salary Payable', type: ChartAccountType.LIABILITY },
  { code: '2210', name: 'PF Payable', type: ChartAccountType.LIABILITY },
  { code: '2220', name: 'TDS Payable', type: ChartAccountType.LIABILITY },
  { code: '2230', name: 'VAT Payable', type: ChartAccountType.LIABILITY },
  {
    code: '2240',
    name: 'Advance Fees Liability',
    type: ChartAccountType.LIABILITY,
  },
  {
    code: '2300',
    name: 'Statutory Deductions Payable',
    type: ChartAccountType.LIABILITY,
  },
  {
    code: '2400',
    name: 'Canteen Wallet Liability',
    type: ChartAccountType.LIABILITY,
  },
  {
    code: '3000',
    name: 'Opening Balance Equity',
    type: ChartAccountType.EQUITY,
  },
  {
    code: '3100',
    name: 'Retained Surplus/Deficit',
    type: ChartAccountType.EQUITY,
  },
  { code: '4000', name: 'Tuition Fee Income', type: ChartAccountType.REVENUE },
  {
    code: '4010',
    name: 'Admission Fee Income',
    type: ChartAccountType.REVENUE,
  },
  { code: '4020', name: 'Exam Fee Income', type: ChartAccountType.REVENUE },
  {
    code: '4030',
    name: 'Transport Fee Income',
    type: ChartAccountType.REVENUE,
  },
  {
    code: '4040',
    name: 'Library Fine Income',
    type: ChartAccountType.REVENUE,
  },
  {
    code: '4050',
    name: 'Meal Plan Fee Income',
    type: ChartAccountType.REVENUE,
  },
  { code: '4090', name: 'Other Income', type: ChartAccountType.REVENUE },
  { code: '4100', name: 'Canteen Revenue', type: ChartAccountType.REVENUE },
  { code: '5000', name: 'Operating Expenses', type: ChartAccountType.EXPENSE },
  { code: '5010', name: 'Salary Expense', type: ChartAccountType.EXPENSE },
  {
    code: '5020',
    name: 'PF Employer Contribution Expense',
    type: ChartAccountType.EXPENSE,
  },
  {
    code: '5030',
    name: 'Staff Allowance Expense',
    type: ChartAccountType.EXPENSE,
  },
  { code: '5040', name: 'Stationery Expense', type: ChartAccountType.EXPENSE },
  { code: '5050', name: 'Rent Expense', type: ChartAccountType.EXPENSE },
  { code: '5060', name: 'Utilities Expense', type: ChartAccountType.EXPENSE },
  { code: '5070', name: 'Maintenance Expense', type: ChartAccountType.EXPENSE },
  { code: '5080', name: 'Academic Expense', type: ChartAccountType.EXPENSE },
  {
    code: '5100',
    name: 'Fee Waivers & Discounts',
    type: ChartAccountType.EXPENSE,
  },
  {
    code: '5200',
    name: 'Canteen Inventory Purchases',
    type: ChartAccountType.EXPENSE,
  },
];

export const DEFAULT_FEE_HEADS: Array<{
  code: string;
  name: string;
  frequency: FeeFrequency;
  defaultAmount: string;
  vatApplicable: boolean;
}> = [
  {
    code: 'TUITION',
    name: 'Tuition Fee',
    frequency: FeeFrequency.MONTHLY,
    defaultAmount: '0',
    vatApplicable: true,
  },
  {
    code: 'ADMISSION',
    name: 'Admission Fee',
    frequency: FeeFrequency.ONE_TIME,
    defaultAmount: '0',
    vatApplicable: true,
  },
  {
    code: 'EXAM',
    name: 'Exam Fee',
    frequency: FeeFrequency.TERM,
    defaultAmount: '0',
    vatApplicable: true,
  },
  {
    code: 'TRANSPORT',
    name: 'Transport Fee',
    frequency: FeeFrequency.MONTHLY,
    defaultAmount: '0',
    vatApplicable: true,
  },
  {
    code: 'LIBFINE',
    name: 'Library Fine',
    frequency: FeeFrequency.ONE_TIME,
    defaultAmount: '0',
    vatApplicable: false,
  },
];

export function resolveCashAccountCode(method: PaymentMethod) {
  return method === PaymentMethod.CASH ? '1000' : '1010';
}
