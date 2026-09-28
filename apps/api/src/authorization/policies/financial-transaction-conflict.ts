import { Prisma } from '@prisma/client';

/** Prisma 7's PostgreSQL adapter wraps raw-query serialization errors in P2010. */
export function isFinancialTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  const metadata = error.meta as
    | {
        code?: string;
        driverAdapterError?: { cause?: { originalCode?: string } };
      }
    | undefined;
  const code =
    metadata?.code ?? metadata?.driverAdapterError?.cause?.originalCode;
  return code === '40001' || code === '40P01';
}
