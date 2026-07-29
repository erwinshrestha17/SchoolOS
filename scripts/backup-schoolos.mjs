#!/usr/bin/env node

import { join } from 'node:path';
import {
  defaultDatabaseUrl,
  loadSchoolOsEnv,
  resolveBackupOutputDir,
  resolveStorageRoot,
} from './lib/schoolos-env.mjs';
import {
  buildManifest,
  checkPostgresConnectivity,
  collectDatabaseMetrics,
  countStorageFiles,
  createBackupBundleDir,
  runPgDump,
  runStorageArchive,
  writeManifest,
} from './lib/backup-restore.mjs';

loadSchoolOsEnv();

const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const storageRoot = resolveStorageRoot();
const outputRoot = resolveBackupOutputDir();

async function main() {
  const connected = await checkPostgresConnectivity(databaseUrl);
  if (!connected) {
    console.error(
      'Postgres is not reachable. Start it with: docker compose up -d postgres',
    );
    process.exit(1);
  }

  const { bundleDir, timestamp } = createBackupBundleDir(outputRoot);
  const pgDumpPath = join(bundleDir, `schoolos-${timestamp}.dump`);
  const storageArchivePath = join(bundleDir, `schoolos-storage-${timestamp}.tgz`);

  console.log(`Creating backup bundle in ${bundleDir}`);

  const metrics = await collectDatabaseMetrics(databaseUrl);
  const storageFileCount = countStorageFiles(storageRoot);

  if (metrics.Tenant === 0) {
    console.warn(
      'Warning: source database has zero tenants. Run `pnpm db:seed` before rehearsal evidence.',
    );
  }

  const pgDumpMs = runPgDump(databaseUrl, pgDumpPath);
  const storageArchiveMs = runStorageArchive(storageRoot, storageArchivePath);

  const manifest = buildManifest({
    timestamp,
    sourceDatabaseUrl: databaseUrl,
    storageRoot,
    bundleDir,
    pgDumpFile: pgDumpPath,
    storageArchiveFile: storageArchivePath,
    metrics,
    storageFileCount,
    durationsMs: {
      pgDump: pgDumpMs,
      storageArchive: storageArchiveMs,
      total: pgDumpMs + storageArchiveMs,
    },
  });

  const manifestPath = writeManifest(bundleDir, manifest);

  console.log('Backup completed successfully.');
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Postgres dump: ${pgDumpPath}`);
  console.log(`Storage archive: ${storageArchivePath}`);
  console.log(
    `Metrics: Tenant=${metrics.Tenant}, Student=${metrics.Student}, User=${metrics.User}, AuditLog=${metrics.AuditLog}, storageFileCount=${storageFileCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
