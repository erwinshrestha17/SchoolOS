import { Prisma } from '@prisma/client';

/** Prisma 7's PostgreSQL adapter wraps raw-query serialization errors in P2010. */
export function isFinancialTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  const metadata = error.meta;
  const adapterError = metadata?.driverAdapterError;
  const cause =
    adapterError && typeof adapterError === 'object' && 'cause' in adapterError
      ? adapterError.cause
      : null;
  const adapterCode =
    cause && typeof cause === 'object' && 'originalCode' in cause
      ? cause.originalCode
      : null;
  const code = metadata?.code ?? adapterCode;
  return code === '40001' || code === '40P01';
}
