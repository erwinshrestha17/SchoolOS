/**
 * Duplicate-active-credential preflight for the StudentQrCredential
 * partial unique index (tenantId, studentId) WHERE status = 'ACTIVE'
 * introduced by migration 20260712160000_student_qr_protected_artifact.
 *
 * Run this against a database BEFORE applying that migration. A non-empty
 * result means the migration will fail when applied, and the listed
 * tenant/student pairs need an approved manual resolution first (see the
 * remediation steps printed below). This script never mutates data.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... tsx prisma/qr-migration-replay/duplicate-active-preflight.ts
 *
 * Exit codes:
 *   0 - no duplicate ACTIVE credentials found
 *   1 - duplicate ACTIVE credentials found (unsafe to migrate)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

interface DuplicateActiveRow {
  tenantId: string;
  studentId: string;
  activeCredentialCount: bigint;
}

export async function findDuplicateActiveCredentials(
  prisma: PrismaClient,
): Promise<DuplicateActiveRow[]> {
  try {
    return await prisma.$queryRaw<DuplicateActiveRow[]>`
      SELECT
        "tenantId",
        "studentId",
        COUNT(*) AS "activeCredentialCount"
      FROM "StudentQrCredential"
      WHERE "status" = 'ACTIVE'
      GROUP BY "tenantId", "studentId"
      HAVING COUNT(*) > 1
      ORDER BY "tenantId", "studentId"
    `;
  } catch (error) {
    // A database being provisioned for the first time (or replayed from
    // before migration 20260523032511_add_homework_submission_required,
    // which created this table) has no StudentQrCredential table yet.
    // There is nothing to check for duplicates - let migrate deploy proceed
    // and create the table itself. Any other error must still fail loudly.
    const knownRequestError = error as {
      code?: string;
      meta?: { driverAdapterError?: { cause?: { originalCode?: string } } };
    };
    const isUndefinedTable =
      knownRequestError?.code === 'P2010' &&
      knownRequestError?.meta?.driverAdapterError?.cause?.originalCode ===
        '42P01';
    if (isUndefinedTable) {
      return [];
    }
    throw error;
  }
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const duplicates = await findDuplicateActiveCredentials(prisma);

    if (duplicates.length === 0) {
      console.log(
        'QR credential preflight: no duplicate ACTIVE credentials found. Safe to apply the uniqueness migration.',
      );
      process.exit(0);
    }

    console.error(
      `QR credential preflight FAILED: ${duplicates.length} tenant/student pair(s) have more than one ACTIVE credential.`,
    );
    console.error(
      'Only safe identifiers are listed below (no token hashes, object keys, or file metadata):',
    );
    for (const row of duplicates) {
      console.error(
        `  tenantId=${row.tenantId} studentId=${row.studentId} activeCredentialCount=${row.activeCredentialCount}`,
      );
    }
    console.error('');
    console.error('Required remediation (manual, domain-approved — do not automate):');
    console.error('  1. Identify the duplicate active credentials for each pair above.');
    console.error('  2. Investigate credential history and audit records (audit resource "student_qr").');
    console.error('  3. Select the correct active credential through an approved operational decision.');
    console.error('  4. Revoke the incorrect duplicates using StudentQrService.revokeQr or an explicitly reviewed repair script.');
    console.error('  5. Preserve audit/history — do not delete rows.');
    console.error('  6. Re-run this preflight.');
    console.error('  7. Apply the migration.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('QR credential preflight crashed:', error);
    process.exit(1);
  });
}
