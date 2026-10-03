import { Prisma } from '@prisma/client';
import {
  billContentFingerprint,
  isPayablesGuardViolation,
  vendorDuplicateKey,
} from './payables.service';

describe('payables helpers (Phase 7.11c)', () => {
  const bill = {
    vendorId: 'vendor-1',
    vendorBillNumber: 'SS-1',
    expenseDate: new Date('2030-02-01T00:00:00.000Z'),
    dueDate: new Date('2030-02-15T00:00:00.000Z'),
    description: 'Exercise books',
    expenseAccountId: 'account-1',
    amount: new Prisma.Decimal('10000'),
    taxAmount: new Prisma.Decimal('1300'),
    totalAmount: new Prisma.Decimal('11300'),
    supportingFileAssetId: null,
    fiscalPeriodId: 'period-1',
  };

  it('fingerprints exactly what the approver signs off on', () => {
    const base = billContentFingerprint(bill);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    // Same money, different representation: same fingerprint.
    expect(
      billContentFingerprint({
        ...bill,
        amount: new Prisma.Decimal('10000.00'),
      }),
    ).toBe(base);
    for (const change of [
      { amount: new Prisma.Decimal('10000.01') },
      { taxAmount: new Prisma.Decimal('0') },
      { expenseAccountId: 'account-2' },
      { vendorBillNumber: 'SS-2' },
      { dueDate: null },
      { supportingFileAssetId: 'file-1' },
      { fiscalPeriodId: 'period-2' },
    ]) {
      expect(billContentFingerprint({ ...bill, ...change })).not.toBe(base);
    }
  });

  it('normalizes vendor names for the duplicate check only', () => {
    expect(vendorDuplicateKey('  Sagarmatha   Stationers Pvt. Ltd. ')).toBe(
      vendorDuplicateKey('SAGARMATHA STATIONERS PVT LTD'),
    );
    expect(vendorDuplicateKey('Sagarmatha Stationers')).not.toBe(
      vendorDuplicateKey('Sagarmatha Traders'),
    );
  });

  it('recognises payables database guard refusals and nothing else', () => {
    expect(
      isPayablesGuardViolation(
        new Error(
          'FinancePayableSettlement_guard: Settlement would exceed the payable balance',
        ),
      ),
    ).toBe(true);
    expect(
      isPayablesGuardViolation(
        new Error(
          'new row for relation "FinanceExpense" violates check constraint "FinanceExpense_amounts"',
        ),
      ),
    ).toBe(true);
    expect(isPayablesGuardViolation(new Error('connection reset'))).toBe(false);
    expect(isPayablesGuardViolation('FinanceExpense_guard')).toBe(false);
  });
});
