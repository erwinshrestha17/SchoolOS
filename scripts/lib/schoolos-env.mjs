import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const repoRoot = resolve(new URL('../..', import.meta.url).pathname);

export const defaultDatabaseUrl =
  'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public';

export const defaultRestoreDatabaseUrl =
  'postgresql://schoolos:password123@localhost:5433/schoolos_db_restore?schema=public';

export function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadSchoolOsEnv() {
  loadEnvFile(resolve(repoRoot, 'apps/api/.env'));
}

export function resolveStorageRoot() {
  const configured = process.env.LOCAL_STORAGE_ROOT ?? 'storage';
  return resolve(repoRoot, 'apps/api', configured);
}

export function resolveBackupOutputDir() {
  const configured = process.env.BACKUP_OUTPUT_DIR ?? '.backups';
  return resolve(repoRoot, configured);
}

export function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, '').split('?')[0];
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    databaseName,
  };
}

export function buildAdminDatabaseUrl(connectionString) {
  const parsed = parseDatabaseUrl(connectionString);
  const url = new URL(connectionString);
  url.pathname = '/postgres';
  return url.toString();
}
