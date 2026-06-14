import { BadRequestException } from '@nestjs/common';
import { ChartAccountType } from '@prisma/client';
import { M9_ACCOUNTING_SOURCE_MODULES } from './dto/m9-accounting.dto';

export function normalizeM9Token(value: string) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

export function normalizeM9SourceModule(value: string) {
  const normalized = normalizeM9Token(value);
  if (
    !(M9_ACCOUNTING_SOURCE_MODULES as readonly string[]).includes(normalized)
  ) {
    throw new BadRequestException('Unsupported accounting source module');
  }
  return normalized;
}

export function m9DateKey(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function sumM9RowsByName(rows: any[], pattern: RegExp) {
  return Math.abs(
    rows
      .filter((row) => pattern.test(`${row.name ?? ''} ${row.code ?? ''}`))
      .reduce((sum, row) => sum + Number(row.balance ?? 0), 0),
  );
}

export const NEPAL_SCHOOL_CHART_TEMPLATE: Array<{
  code: string;
  name: string;
  type: ChartAccountType;
}> = [
  { code: '1000', name: 'Cash in Hand - NPR', type: ChartAccountType.ASSET },
  { code: '1010', name: 'Bank Account - NPR', type: ChartAccountType.ASSET },
  {
    code: '1020',
    name: 'Digital Payment Clearing',
    type: ChartAccountType.ASSET,
  },
  {
    code: '1200',
    name: 'Student Fee Receivables',
    type: ChartAccountType.ASSET,
  },
  { code: '2000', name: 'Accounts Payable', type: ChartAccountType.LIABILITY },
  { code: '2200', name: 'Salary Payable', type: ChartAccountType.LIABILITY },
  { code: '2220', name: 'TDS Payable', type: ChartAccountType.LIABILITY },
  {
    code: '2230',
    name: 'Tax Payable Placeholder',
    type: ChartAccountType.LIABILITY,
  },
  {
    code: '2400',
    name: 'Canteen Wallet Liability',
    type: ChartAccountType.LIABILITY,
  },
  { code: '3000', name: 'Opening Fund Balance', type: ChartAccountType.EQUITY },
  {
    code: '3100',
    name: 'Accumulated Surplus or Deficit',
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
    name: 'Library Fine and Replacement Income',
    type: ChartAccountType.REVENUE,
  },
  {
    code: '4050',
    name: 'Canteen and Meal Income',
    type: ChartAccountType.REVENUE,
  },
  { code: '5010', name: 'Salary Expense', type: ChartAccountType.EXPENSE },
  {
    code: '5200',
    name: 'Canteen Inventory Purchase Expense',
    type: ChartAccountType.EXPENSE,
  },
  {
    code: '5300',
    name: 'Transport Fuel and Maintenance Expense',
    type: ChartAccountType.EXPENSE,
  },
];
