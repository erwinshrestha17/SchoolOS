import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import {
  buildAdminDatabaseUrl,
  parseDatabaseUrl,
  repoRoot,
} from './schoolos-env.mjs';

const requireApiDependency = createRequire(
  resolve(repoRoot, 'apps/api/package.json'),
);
const { Client: PgClient } = requireApiDependency('pg');

export const METRIC_TABLES = ['Tenant', 'Student', 'User', 'AuditLog'];

export function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
}

export function createBackupBundleDir(outputRoot, timestamp = formatTimestamp()) {
  const bundleDir = join(outputRoot, timestamp);
  mkdirSync(bundleDir, { recursive: true });
  return { bundleDir, timestamp };
}

export function assertCliAvailable(binary) {
  if (isCliAvailable(binary)) {
    return;
  }
  throw new Error(
    `${binary} is not available on PATH. Install PostgreSQL client tools (e.g. brew install libpq) or ensure the schoolos_postgres container is running for docker-exec fallback.`,
  );
}

function isCliAvailable(binary) {
  const result = spawnSync('which', [binary], { encoding: 'utf8' });
  return result.status === 0;
}

function isDockerPostgresRunning() {
  return (
    isDockerContainerRunning('schoolos_staging_postgres') ||
    isDockerContainerRunning('schoolos_postgres')
  );
}

function getPostgresDockerContainer() {
  if (process.env.POSTGRES_DOCKER_CONTAINER) {
    return process.env.POSTGRES_DOCKER_CONTAINER;
  }
  if (isDockerContainerRunning('schoolos_staging_postgres')) {
    return 'schoolos_staging_postgres';
  }
  return 'schoolos_postgres';
}

function isDockerContainerRunning(name) {
  const result = spawnSync(
    'docker',
    ['inspect', '-f', '{{.State.Running}}', name],
    { encoding: 'utf8' },
  );
  return result.status === 0 && result.stdout.trim() === 'true';
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}${stderr ? `\n${stderr}` : ''}`,
    );
  }

  return result;
}

export function getGitSha() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

export async function withPgClient(connectionString, fn) {
  const client = new PgClient({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function collectDatabaseMetrics(connectionString) {
  return withPgClient(connectionString, async (client) => {
    const metrics = {};
    for (const table of METRIC_TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      metrics[table] = result.rows[0]?.count ?? 0;
    }
    return metrics;
  });
}

export function countStorageFiles(storageRoot) {
  if (!existsSync(storageRoot)) {
    return 0;
  }

  let count = 0;
  const stack = [storageRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
      } else if (stats.isFile()) {
        count += 1;
      }
    }
  }

  return count;
}

export async function ensureRestoreDatabase(adminConnectionString, databaseName) {
  await withPgClient(adminConnectionString, async (client) => {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
      return;
    }

    await client.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  });
}

export function assertSafeRestoreTarget(sourceUrl, restoreUrl) {
  const source = parseDatabaseUrl(sourceUrl);
  const target = parseDatabaseUrl(restoreUrl);

  if (
    source.databaseName === target.databaseName &&
    process.env.ALLOW_RESTORE_INPLACE !== '1'
  ) {
    throw new Error(
      `Refusing in-place restore into "${target.databaseName}". Set RESTORE_DATABASE_URL to a separate database or ALLOW_RESTORE_INPLACE=1 to override.`,
    );
  }
}

export function writeManifest(bundleDir, manifest) {
  const manifestPath = join(bundleDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

export function readManifest(manifestPath) {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function runPgDump(databaseUrl, outputPath) {
  const started = Date.now();
  const parsed = parseDatabaseUrl(databaseUrl);

  if (isCliAvailable('pg_dump')) {
    runCommand('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      `--file=${outputPath}`,
      databaseUrl,
    ]);
    return Date.now() - started;
  }

  if (!isDockerPostgresRunning()) {
    assertCliAvailable('pg_dump');
  }

  const container = getPostgresDockerContainer();
  runCommand('docker', [
    'exec',
    container,
    'pg_dump',
    '-U',
    parsed.user,
    '-d',
    parsed.databaseName,
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '-f',
    '/tmp/schoolos-backup.dump',
  ]);
  runCommand('docker', [
    'cp',
    `${container}:/tmp/schoolos-backup.dump`,
    outputPath,
  ]);
  runCommand('docker', [
    'exec',
    container,
    'rm',
    '-f',
    '/tmp/schoolos-backup.dump',
  ]);
  return Date.now() - started;
}

export function runPgRestore(databaseUrl, dumpPath) {
  const started = Date.now();
  const parsed = parseDatabaseUrl(databaseUrl);

  if (isCliAvailable('pg_restore')) {
    runCommand('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      `--dbname=${databaseUrl}`,
      dumpPath,
    ]);
    return Date.now() - started;
  }

  if (!isDockerPostgresRunning()) {
    assertCliAvailable('pg_restore');
  }

  const container = getPostgresDockerContainer();
  runCommand('docker', [
    'cp',
    dumpPath,
    `${container}:/tmp/schoolos-restore.dump`,
  ]);
  runCommand('docker', [
    'exec',
    container,
    'pg_restore',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '-U',
    parsed.user,
    '-d',
    parsed.databaseName,
    '/tmp/schoolos-restore.dump',
  ]);
  runCommand('docker', [
    'exec',
    container,
    'rm',
    '-f',
    '/tmp/schoolos-restore.dump',
  ]);
  return Date.now() - started;
}

export function runStorageArchive(storageRoot, outputPath) {
  const started = Date.now();

  if (!existsSync(storageRoot)) {
    mkdirSync(storageRoot, { recursive: true });
  }

  assertCliAvailable('tar');
  runCommand('tar', ['-czf', outputPath, '-C', storageRoot, '.']);
  return Date.now() - started;
}

export function runStorageExtract(archivePath, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  assertCliAvailable('tar');
  runCommand('tar', ['-xzf', archivePath, '-C', outputDir]);
}

export function buildManifest({
  timestamp,
  sourceDatabaseUrl,
  storageRoot,
  bundleDir,
  pgDumpFile,
  storageArchiveFile,
  metrics,
  storageFileCount,
  durationsMs,
}) {
  const parsed = parseDatabaseUrl(sourceDatabaseUrl);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    gitSha: getGitSha(),
    bundleDir,
    source: {
      databaseHost: parsed.host,
      databasePort: parsed.port,
      databaseName: parsed.databaseName,
      storageRoot,
    },
    artifacts: {
      pgDump: basename(pgDumpFile),
      storageArchive: basename(storageArchiveFile),
    },
    metrics: {
      ...metrics,
      storageFileCount,
    },
    durationsMs,
  };
}

export function compareMetrics(expected, actual) {
  const mismatches = [];

  for (const table of METRIC_TABLES) {
    if (expected[table] !== actual[table]) {
      mismatches.push({
        field: table,
        expected: expected[table],
        actual: actual[table],
      });
    }
  }

  if (expected.storageFileCount !== actual.storageFileCount) {
    mismatches.push({
      field: 'storageFileCount',
      expected: expected.storageFileCount,
      actual: actual.storageFileCount,
    });
  }

  return mismatches;
}

export async function checkPostgresConnectivity(connectionString) {
  try {
    await withPgClient(connectionString, (client) => client.query('SELECT 1'));
    return true;
  } catch {
    return false;
  }
}

export function resolveManifestPathArg(args) {
  const manifestIndex = args.indexOf('--manifest');
  if (manifestIndex === -1 || !args[manifestIndex + 1]) {
    throw new Error('Missing required --manifest <path> argument.');
  }
  return resolve(process.cwd(), args[manifestIndex + 1]);
}

export { buildAdminDatabaseUrl, parseDatabaseUrl };
