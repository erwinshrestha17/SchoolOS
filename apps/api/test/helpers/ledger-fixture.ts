import { Pool } from 'pg';
import { authTestDatabaseUrl } from './auth-test-isolation';

/**
 * Phase 7.3 — the ledger tables are guarded by database triggers (posted
 * journals, their lines, payments and receipts are immutable and cannot be
 * deleted). Test fixtures still need to clean up after themselves and,
 * occasionally, to simulate corruption that no application path can produce.
 *
 * `session_replication_role = replica` (superuser, transaction-local) disables
 * triggers for that one transaction only; CHECK and UNIQUE constraints still
 * apply. Never use this in product code.
 */
let pool: Pool | undefined;
function ledgerPool() {
  if (!authTestDatabaseUrl) throw new Error('No test database configured');
  pool ??= new Pool({ connectionString: authTestDatabaseUrl, max: 2 });
  return pool;
}

export async function withLedgerGuardsOff<T>(
  work: (query: Pool['query']) => Promise<T>,
): Promise<T> {
  const client = await ledgerPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    const result = await work(client.query.bind(client) as Pool['query']);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Delete every guarded finance row of one fixture tenant. */
export async function purgeGuardedLedgerRows(tenantId: string) {
  await withLedgerGuardsOff(async (query) => {
    await query('DELETE FROM "JournalLine" WHERE "tenantId" = $1', [tenantId]);
    await query('DELETE FROM "JournalEntry" WHERE "tenantId" = $1', [tenantId]);
    await query('DELETE FROM "Receipt" WHERE "tenantId" = $1', [tenantId]);
    await query('DELETE FROM "Payment" WHERE "tenantId" = $1', [tenantId]);
  });
}

export async function closeLedgerFixturePool() {
  await pool?.end();
  pool = undefined;
}
