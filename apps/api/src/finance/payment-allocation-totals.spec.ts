import { PaymentStatus, Prisma } from '@prisma/client';
import {
  sumInvoiceAllocationAmount,
  sumNetPaidAmount,
  sumRefundedAmount,
} from './payment-allocation-totals';

describe('payment allocation totals', () => {
  it('uses active allocations as invoice payment truth', () => {
    const total = sumInvoiceAllocationAmount(
      [
        { amount: new Prisma.Decimal('700.00'), reversedAt: null },
        {
          amount: new Prisma.Decimal('300.00'),
          reversedAt: new Date('2026-08-28T00:00:00.000Z'),
        },
      ],
      [
        {
          amount: new Prisma.Decimal('9999.00'),
          status: PaymentStatus.SUCCESS,
        },
      ],
    );

    expect(total.toFixed(2)).toBe('700.00');
  });

  it('falls back to legacy invoice-linked payments when no allocations exist', () => {
    const total = sumInvoiceAllocationAmount(undefined, [
      {
        amount: new Prisma.Decimal('1000.00'),
        status: PaymentStatus.SUCCESS,
        refunds: [{ amount: new Prisma.Decimal('250.00') }],
      },
      {
        amount: new Prisma.Decimal('500.00'),
        status: PaymentStatus.REVERSED,
      },
    ]);

    expect(total.toFixed(2)).toBe('750.00');
  });

  it('keeps the shared refund and net-payment helpers consistent', () => {
    expect(
      sumRefundedAmount([
        { amount: new Prisma.Decimal('100.00') },
        { amount: new Prisma.Decimal('25.50') },
      ]).toFixed(2),
    ).toBe('125.50');
    expect(
      sumNetPaidAmount([
        {
          amount: new Prisma.Decimal('500.00'),
          status: PaymentStatus.SUCCESS,
          refunds: [{ amount: new Prisma.Decimal('125.50') }],
        },
      ]).toFixed(2),
    ).toBe('374.50');
  });
});
