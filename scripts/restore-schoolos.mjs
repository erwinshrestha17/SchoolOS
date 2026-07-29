#!/usr/bin/env node

import { dirname, join } from 'node:path';
import {
  defaultDatabaseUrl,
  defaultRestoreDatabaseUrl,
  loadSchoolOsEnv,
  resolveBackupOutputDir,
} from './lib/schoolos-env.mjs';
import {
  assertSafeRestoreTarget,
  buildAdminDatabaseUrl,
  collectDatabaseMetrics,
  compareMetrics,
  countStorageFiles,
  ensureRestoreDatabase,
  parseDatabaseUrl,
  readManifest,
  resolveManifestPathArg,
  runPgRestore,
  runStorageExtract,
} from './lib/backup-restore.mjs';

loadSchoolOsEnv();

const args = process.argv.slice(2);
const sourceDatabaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const restoreDatabaseUrl =
  process.env.RESTORE_DATABASE_URL ?? defaultRestoreDatabaseUrl;

async function main() {
  const manifestPath = resolveManifestPathArg(args);
  const manifest = readManifest(manifestPath);
  const bundleDir = manifest.bundleDir ?? dirname(manifestPath);

  assertSafeRestoreTarget(sourceDatabaseUrl, restoreDatabaseUrl);

  const pgDumpPath = join(bundleDir, manifest.artifacts.pgDump);
  const storageArchivePath = join(bundleDir, manifest.artifacts.storageArchive);
  const restoreStorageRoot =
    process.env.RESTORE_STORAGE_ROOT ??
    join(resolveBackupOutputDir(), 'restore-storage', manifest.createdAt.replace(/[:.]/g, '-'));

  const targetDb = parseDatabaseUrl(restoreDatabaseUrl);
  const adminDatabaseUrl = buildAdminDatabaseUrl(restoreDatabaseUrl);

  console.log(`Restoring Postgres into ${targetDb.databaseName}`);
  await ensureRestoreDatabase(adminDatabaseUrl, targetDb.databaseName);

  const pgRestoreMs = runPgRestore(restoreDatabaseUrl, pgDumpPath);
  runStorageExtract(storageArchivePath, restoreStorageRoot);

  const restoredMetrics = await collectDatabaseMetrics(restoreDatabaseUrl);
  const restoredStorageFileCount = countStorageFiles(restoreStorageRoot);

  const actual = {
    ...restoredMetrics,
    storageFileCount: restoredStorageFileCount,
  };
  const mismatches = compareMetrics(manifest.metrics, actual);

  console.log('Restore completed.');
  console.log(
    `Restore database: ${targetDb.databaseName}@${targetDb.host}:${targetDb.port}`,
  );
  console.log(`Restore storage root: ${restoreStorageRoot}`);
  console.log(`pg_restore duration: ${pgRestoreMs}ms`);
  console.log(
    `Restored metrics: Tenant=${restoredMetrics.Tenant}, Student=${restoredMetrics.Student}, User=${restoredMetrics.User}, AuditLog=${restoredMetrics.AuditLog}, storageFileCount=${restoredStorageFileCount}`,
  );

  if (mismatches.length > 0) {
    console.error('Restore verification failed:');
    for (const mismatch of mismatches) {
      console.error(
        `- ${mismatch.field}: expected ${mismatch.expected}, got ${mismatch.actual}`,
      );
    }
    process.exit(1);
  }

  console.log('Restore verification passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
