import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('monthly Grade 1-10 fee seed', () => {
  const source = readFileSync(join(__dirname, 'seed-monthly-fees.ts'), 'utf8');
  const packageJson = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');

  it('keeps deterministic monthly fee totals for every Grade 1-10 plan', () => {
    const expectedTotals = [
      '1: 3500',
      '2: 3600',
      '3: 3750',
      '4: 4000',
      '5: 4250',
      '6: 4500',
      '7: 4750',
      '8: 5000',
      '9: 5500',
      '10: 6000',
    ];

    expect(source).toContain('const canonicalStudentCount = 601');
    expect(source).toContain("const canonicalAdmissionPrefix = 'EA-2083-'");
    for (const total of expectedTotals) {
      expect(source).toContain(total);
    }
  });

  it('assigns a fee plan and current-month invoice to every canonical active enrollment', () => {
    expect(source).toContain('prisma.feePlan.upsert');
    expect(source).toContain('prisma.feePlanItem.upsert');
    expect(source).toContain('prisma.studentFeeAssignment.upsert');
    expect(source).toContain('prisma.invoice.upsert');
    expect(source).toContain('studentSystemId: { startsWith: canonicalAdmissionPrefix }');
    expect(source).toContain('Monthly fee seed expected ${canonicalStudentCount} canonical students');
  });

  it('uses idempotent payment and receipt fixtures without production execution', () => {
    expect(source).toContain("process.env.NODE_ENV === 'production'");
    expect(source).toContain('tenantId_idempotencyKey');
    expect(source).toContain('seed:monthly-fee:${invoiceNumber}:payment');
    expect(source).toContain('prisma.receipt.upsert');
    expect(source).toContain('InvoiceStatus.PAID');
    expect(source).toContain('InvoiceStatus.PARTIAL');
    expect(source).toContain('InvoiceStatus.ISSUED');
  });

  it('runs after the canonical school seed through the official Prisma seed command', () => {
    expect(packageJson).toContain(
      'tsx prisma/seed.ts && tsx prisma/seed-monthly-fees.ts',
    );
  });
});
