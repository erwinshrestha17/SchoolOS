import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Phase 7.3 — atomic document numbering.
 *
 * One INSERT .. ON CONFLICT DO UPDATE .. RETURNING statement takes a row lock
 * on (tenantId, sequenceKey), so concurrent allocations are serialized and
 * receive distinct values. Inside the caller's transaction a rollback also
 * rolls the counter back (gap-free); outside one, a value is simply consumed.
 * Never derive a number from a row count: counts repeat after deletions and
 * race under concurrency.
 */
export const DOCUMENT_SEQUENCE_KEYS = {
  invoice: (formattedFiscalYear: string) => `INVOICE:${formattedFiscalYear}`,
  refund: 'REFUND',
  cashierClose: 'CASHIER_CLOSE',
  employee: 'EMPLOYEE',
} as const;

export type DocumentSequenceClient = Pick<
  Prisma.TransactionClient,
  '$queryRaw'
>;

export async function allocateDocumentNumber(
  client: DocumentSequenceClient,
  tenantId: string,
  sequenceKey: string,
): Promise<number> {
  const rows = await client.$queryRaw<Array<{ lastValue: number }>>(
    Prisma.sql`
      INSERT INTO "DocumentSequence" ("tenantId", "sequenceKey", "lastValue", "updatedAt")
      VALUES (${tenantId}, ${sequenceKey}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId", "sequenceKey") DO UPDATE
      SET "lastValue" = "DocumentSequence"."lastValue" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastValue"
    `,
  );
  const value = rows[0]?.lastValue;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConflictException(
      'Document number could not be allocated safely.',
    );
  }
  return value;
}
