import { ChartAccountType, FeeFrequency, PaymentMethod } from '@prisma/client';

export const DEFAULT_CHART_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: ChartAccountType;
}> = [
  { code: '1000', name: 'Cash In Hand', type: ChartAccountType.ASSET },
  { code: '1010', name: 'Bank Account', type: ChartAccountType.ASSET },
  {
    code: '2000',
    name: 'Advance Fees Received',
    type: ChartAccountType.LIABILITY,
  },
  { code: '2100', name: 'VAT Payable', type: ChartAccountType.LIABILITY },
  { code: '4000', name: 'Tuition Fee Income', type: ChartAccountType.INCOME },
  { code: '4010', name: 'Admission Fee Income', type: ChartAccountType.INCOME },
  { code: '4020', name: 'Exam Fee Income', type: ChartAccountType.INCOME },
  { code: '4030', name: 'Transport Fee Income', type: ChartAccountType.INCOME },
  { code: '4040', name: 'Library Fine Income', type: ChartAccountType.INCOME },
  { code: '5000', name: 'Operating Expenses', type: ChartAccountType.EXPENSE },
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
