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

/**
 * Login and, when the account still has mustChangePassword=true, perform the
 * allowlisted password-change flow so verify scripts can reach protected routes.
 * Idempotent across repeated runs (tries the derived password on re-login).
 */
export async function loginWithMustChangePasswordCleared({
  apiBaseUrl,
  tenantSlug,
  email,
  password,
  userAgent = 'flutter',
}) {
  const derivedPassword = password.endsWith('!')
    ? `${password.slice(0, -1)}2!`
    : `${password}!`;

  for (const candidatePassword of [password, derivedPassword]) {
    const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({ tenantSlug, email, password: candidatePassword }),
    });
    const loginBody = await loginResponse.json().catch(() => null);
    const token =
      loginBody?.data?.accessToken ??
      loginBody?.accessToken ??
      loginBody?.data?.user?.accessToken;
    const mustChange =
      loginBody?.data?.user?.mustChangePassword ??
      loginBody?.data?.mustChangePassword ??
      false;

    if (!token) {
      continue;
    }

    if (!mustChange) {
      return {
        status: loginResponse.status,
        token,
        password: candidatePassword,
        body: loginBody,
        ok: loginResponse.status === 200 || loginResponse.status === 201,
      };
    }

    if (candidatePassword === derivedPassword) {
      continue;
    }

    const changeResponse = await fetch(`${apiBaseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        currentPassword: candidatePassword,
        newPassword: derivedPassword,
        confirmNewPassword: derivedPassword,
        logoutOtherDevices: false,
      }),
    });

    if (!changeResponse.ok) {
      continue;
    }

    const reloginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        tenantSlug,
        email,
        password: derivedPassword,
      }),
    });
    const reloginBody = await reloginResponse.json().catch(() => null);
    const reloginToken =
      reloginBody?.data?.accessToken ?? reloginBody?.accessToken;

    if (reloginToken) {
      return {
        status: reloginResponse.status,
        token: reloginToken,
        password: derivedPassword,
        body: reloginBody,
        ok: reloginResponse.status === 200 || reloginResponse.status === 201,
      };
    }
  }

  return { status: 401, token: null, password, body: null, ok: false };
}
