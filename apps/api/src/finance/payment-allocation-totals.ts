import { PaymentStatus, Prisma } from '@prisma/client';

export function sumRefundedAmount(refunds: Array<{ amount: Prisma.Decimal }>) {
  return refunds.reduce(
    (sum, refund) => sum.add(refund.amount),
    new Prisma.Decimal(0),
  );
}

export function sumNetPaidAmount(
  payments: Array<{
    amount: Prisma.Decimal;
    status?: PaymentStatus;
    refunds?: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return payments.reduce((sum, payment) => {
    if (payment.status === PaymentStatus.REVERSED) return sum;
    return sum
      .add(payment.amount)
      .sub(sumRefundedAmount(payment.refunds ?? []));
  }, new Prisma.Decimal(0));
}

export function sumInvoiceAllocationAmount(
  allocations:
    | Array<{
        amount: Prisma.Decimal;
        reversedAt?: Date | null;
      }>
    | undefined,
  legacyPayments: Array<{
    amount: Prisma.Decimal;
    status?: PaymentStatus;
    refunds?: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  if (
    allocations !== undefined &&
    (allocations.length > 0 || legacyPayments.length === 0)
  ) {
    return allocations.reduce(
      (sum, allocation) =>
        allocation.reversedAt ? sum : sum.add(allocation.amount),
      new Prisma.Decimal(0),
    );
  }

  return sumNetPaidAmount(legacyPayments);
}
