import { ConflictException } from '@nestjs/common';
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

/**
 * True when the Phase 7.5 database guard (`schoolos_allocation_guard`) refused
 * an allocation write: over-allocating an invoice or a payment, a sign/type
 * violation, or lowering an invoice total below what is already allocated.
 * Services translate it into a 409 so a lost concurrency race reads as
 * "balance changed", never as a server error.
 */
export function isAllocationGuardViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('schoolos_allocation_guard')
  );
}

/** `.catch()` handler: guard refusals become a 409, everything else rethrows. */
export function rethrowAllocationGuardAsConflict(error: unknown): never {
  if (isAllocationGuardViolation(error)) {
    throw new ConflictException(
      'An invoice or payment balance changed while this was being recorded. Refresh the balances and try again.',
    );
  }
  throw error;
}
