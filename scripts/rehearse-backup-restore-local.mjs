#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  defaultDatabaseUrl,
  defaultRestoreDatabaseUrl,
  loadSchoolOsEnv,
  repoRoot,
  resolveBackupOutputDir,
} from './lib/schoolos-env.mjs';
import {
  checkPostgresConnectivity,
  collectDatabaseMetrics,
  compareMetrics,
  countStorageFiles,
  ensureRestoreDatabase,
  parseDatabaseUrl,
  readManifest,
  runPgRestore,
  runStorageExtract,
  buildAdminDatabaseUrl,
} from './lib/backup-restore.mjs';

loadSchoolOsEnv();

const skipDockerCheck = process.argv.includes('--skip-docker-check');
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const restoreDatabaseUrl =
  process.env.RESTORE_DATABASE_URL ?? defaultRestoreDatabaseUrl;
const outputRoot = resolveBackupOutputDir();
const evidenceDir = join(repoRoot, 'docs/production/evidence');

function findLatestManifest() {
  if (!existsSync(outputRoot)) {
    throw new Error(`No backups found under ${outputRoot}. Run pnpm backup:local first.`);
  }

  const bundles = readdirSync(outputRoot)
    .map((name) => join(outputRoot, name, 'manifest.json'))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (bundles.length === 0) {
    throw new Error(`No manifest.json files found under ${outputRoot}.`);
  }

  return bundles[0].path;
}

function checkDockerPostgres() {
  const result = spawnSync('docker', ['compose', 'ps', '--status', 'running', 'postgres'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      'docker compose postgres is not running. Start it with: docker compose up -d postgres',
    );
  }
}

async function optionalReadyCheck() {
  const apiBaseUrl = process.env.SMOKE_API_BASE_URL;
  if (!apiBaseUrl) {
    return { checked: false, ok: null };
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/ready`);
    return { checked: true, ok: response.ok, status: response.status };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeEvidenceFile({
  manifestPath,
  manifest,
  restoreDatabaseUrl,
  restoreStorageRoot,
  restoredMetrics,
  mismatches,
  readyCheck,
  startedAt,
  finishedAt,
}) {
  mkdirSync(evidenceDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const evidencePath = join(
    evidenceDir,
    `backup-restore-rehearsal-${date}-local.md`,
  );

  const result = mismatches.length === 0 ? 'PASS' : 'FAIL';
  const restoreDb = parseDatabaseUrl(restoreDatabaseUrl);
  const body = `# Backup/Restore Rehearsal Evidence (Local)

- Date: ${finishedAt}
- Environment: local
- Operator: automated rehearsal script
- Git SHA: ${manifest.gitSha}
- Result: **${result}**

## Source

- Database: ${manifest.source.databaseName}@${manifest.source.databaseHost}:${manifest.source.databasePort}
- Storage root: ${manifest.source.storageRoot}
- Manifest: ${manifestPath}

## Restore target

- Database: ${restoreDb.databaseName}@${restoreDb.host}:${restoreDb.port}
- Storage root: ${restoreStorageRoot}

## Metrics

| Metric | Source | Restored |
| --- | ---: | ---: |
| Tenant | ${manifest.metrics.Tenant} | ${restoredMetrics.Tenant} |
| Student | ${manifest.metrics.Student} | ${restoredMetrics.Student} |
| User | ${manifest.metrics.User} | ${restoredMetrics.User} |
| AuditLog | ${manifest.metrics.AuditLog} | ${restoredMetrics.AuditLog} |
| storageFileCount | ${manifest.metrics.storageFileCount} | ${restoredMetrics.storageFileCount} |

## Durations

- Backup pg_dump: ${manifest.durationsMs.pgDump}ms
- Backup storage archive: ${manifest.durationsMs.storageArchive}ms
- Rehearsal started: ${startedAt}
- Rehearsal finished: ${finishedAt}

## Optional API check

- Checked: ${readyCheck.checked ? 'yes' : 'no'}
- /ready OK: ${readyCheck.checked ? String(readyCheck.ok) : 'n/a'}

## Verification command

\`\`\`bash
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm backup:local
pnpm rehearse:backup-restore:local
\`\`\`

## Follow-up

- Repeat on staging with production-like storage provider before GA.
- Keep backup artifacts outside the repo workspace in real deployments.
`;

  writeFileSync(evidencePath, body, 'utf8');
  return evidencePath;
}

async function main() {
  const startedAt = new Date().toISOString();

  if (!skipDockerCheck) {
    checkDockerPostgres();
  }

  const connected = await checkPostgresConnectivity(databaseUrl);
  if (!connected) {
    throw new Error('Source Postgres is not reachable.');
  }

  const backupResult = spawnSync('node', [join(repoRoot, 'scripts/backup-schoolos.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (backupResult.status !== 0) {
    process.exit(backupResult.status ?? 1);
  }

  const manifestPath = findLatestManifest();
  const manifest = readManifest(manifestPath);
  const bundleDir = manifest.bundleDir ?? dirname(manifestPath);
  const pgDumpPath = join(bundleDir, manifest.artifacts.pgDump);
  const storageArchivePath = join(bundleDir, manifest.artifacts.storageArchive);
  const restoreStorageRoot = join(
    outputRoot,
    'restore-storage',
    manifest.createdAt.replace(/[:.]/g, '-'),
  );

  const targetDb = parseDatabaseUrl(restoreDatabaseUrl);
  await ensureRestoreDatabase(buildAdminDatabaseUrl(restoreDatabaseUrl), targetDb.databaseName);
  runPgRestore(restoreDatabaseUrl, pgDumpPath);
  runStorageExtract(storageArchivePath, restoreStorageRoot);

  const restoredMetrics = await collectDatabaseMetrics(restoreDatabaseUrl);
  const restoredStorageFileCount = countStorageFiles(restoreStorageRoot);
  const mismatches = compareMetrics(manifest.metrics, {
    ...restoredMetrics,
    storageFileCount: restoredStorageFileCount,
  });

  const readyCheck = await optionalReadyCheck();
  const finishedAt = new Date().toISOString();
  const evidencePath = writeEvidenceFile({
    manifestPath,
    manifest,
    restoreDatabaseUrl,
    restoreStorageRoot,
    restoredMetrics: {
      ...restoredMetrics,
      storageFileCount: restoredStorageFileCount,
    },
    mismatches,
    readyCheck,
    startedAt,
    finishedAt,
  });

  console.log(`Evidence written to ${evidencePath}`);

  if (mismatches.length > 0) {
    console.error('Rehearsal failed due to metric mismatches.');
    for (const mismatch of mismatches) {
      console.error(
        `- ${mismatch.field}: expected ${mismatch.expected}, got ${mismatch.actual}`,
      );
    }
    process.exit(1);
  }

  console.log('Backup/restore rehearsal passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
