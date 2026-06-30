import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deployEnvFile =
  process.env.DEPLOY_ENV_FILE ?? process.env.SCHOOLOS_DEPLOY_ENV_FILE;
const envFileErrors = loadDeployEnvFile(deployEnvFile);
const targetEnv = (
  process.env.DEPLOY_ENV ??
  process.env.NODE_ENV ??
  ''
).toLowerCase();
const strictTargets = new Set(['staging', 'production']);

if (!strictTargets.has(targetEnv) && envFileErrors.length > 0) {
  console.error('Deploy environment file preflight failed:');
  for (const error of envFileErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (!strictTargets.has(targetEnv)) {
  console.log(
    `Skipping staging/production deploy env preflight (DEPLOY_ENV/NODE_ENV is "${targetEnv || 'unset'}").`,
  );
  process.exit(0);
}

const errors = [...envFileErrors];
const requiredVars = [
  'NODE_ENV',
  'ALLOW_PROD_BOOT',
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
  'JWT_CHALLENGE_SECRET',
  'MEDICAL_ENCRYPTION_KEY',
  'TOKEN_HASH_PEPPER',
  'JWT_ISSUER',
  'JWT_AUDIENCE_WEB',
  'JWT_AUDIENCE_MOBILE',
  'PASSWORD_RESET_APP_URL',
  'NEXT_PUBLIC_API_BASE_URL',
];

for (const variable of requiredVars) {
  if (!hasValue(process.env[variable])) {
    errors.push(`${variable} is required for ${targetEnv} deploy preflight`);
  }
}

if (
  !hasValue(process.env.FRONTEND_ORIGIN) &&
  !hasValue(process.env.FRONTEND_ORIGINS)
) {
  errors.push(
    `FRONTEND_ORIGIN or FRONTEND_ORIGINS is required for ${targetEnv} deploy preflight`,
  );
}

if (process.env.NODE_ENV !== 'production') {
  errors.push(
    `${targetEnv} deploy preflight must run with NODE_ENV=production so the API uses production runtime guards`,
  );
}

if ((process.env.ALLOW_PROD_BOOT ?? '').toLowerCase() !== 'true') {
  errors.push(
    'ALLOW_PROD_BOOT must be set to true for staging/production deploy preflight',
  );
}

if ((process.env.TRUST_PROXY ?? '').toLowerCase() !== 'true') {
  errors.push(
    'TRUST_PROXY=true is required for staging/production deployments behind TLS proxy',
  );
}

requireSecret('JWT_SECRET', process.env.JWT_SECRET);
requireSecret('JWT_CHALLENGE_SECRET', process.env.JWT_CHALLENGE_SECRET);
requireSecret('MEDICAL_ENCRYPTION_KEY', process.env.MEDICAL_ENCRYPTION_KEY);
requireSecret('TOKEN_HASH_PEPPER', process.env.TOKEN_HASH_PEPPER);

rejectDefaultValue('JWT_ISSUER', process.env.JWT_ISSUER, ['schoolos']);
rejectDefaultValue('JWT_AUDIENCE_WEB', process.env.JWT_AUDIENCE_WEB, [
  'schoolos-web',
]);
rejectDefaultValue('JWT_AUDIENCE_MOBILE', process.env.JWT_AUDIENCE_MOBILE, [
  'schoolos-mobile',
]);

const redisPort = Number(process.env.REDIS_PORT);
if (!Number.isInteger(redisPort) || redisPort <= 0 || redisPort > 65535) {
  errors.push('REDIS_PORT must be an integer from 1 to 65535');
}

const configuredOrigins = [
  ...splitCsv(process.env.FRONTEND_ORIGIN),
  ...splitCsv(process.env.FRONTEND_ORIGINS),
];

for (const origin of configuredOrigins) {
  validateHttpsUrl('Frontend origin', origin);
  if (origin === '*' || origin.includes('*')) {
    errors.push(
      'Wildcard frontend origins are not allowed for staging/production',
    );
  }
}

validateHttpsUrl('PASSWORD_RESET_APP_URL', process.env.PASSWORD_RESET_APP_URL);
const webApiUrl = parseHttpsUrl(
  'NEXT_PUBLIC_API_BASE_URL',
  process.env.NEXT_PUBLIC_API_BASE_URL,
);
if (
  webApiUrl &&
  !webApiUrl.pathname.replace(/\/+$/, '').endsWith('/api/v1')
) {
  errors.push('NEXT_PUBLIC_API_BASE_URL must include the /api/v1 API prefix');
}

if ((process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase() === 'none') {
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
  if (!cookieDomain) {
    errors.push('COOKIE_DOMAIN is required when COOKIE_SAME_SITE=none');
  }
}

validateEmailProvider();
validatePushProvider();
validateStorageProvider();

if (errors.length > 0) {
  console.error(`${capitalize(targetEnv)} deploy environment preflight failed:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`${capitalize(targetEnv)} deploy environment preflight passed.`);

function validateEmailProvider() {
  if ((process.env.EMAIL_DELIVERY_MODE ?? 'log').toLowerCase() !== 'webhook') {
    return;
  }

  validateHttpsUrl('EMAIL_WEBHOOK_URL', process.env.EMAIL_WEBHOOK_URL);
  requireSecret('EMAIL_WEBHOOK_TOKEN', process.env.EMAIL_WEBHOOK_TOKEN, 16);
}

function validatePushProvider() {
  const pushMode = (process.env.PUSH_PROVIDER_MODE ?? 'disabled').toLowerCase();
  const pushEnabled = isEnabled(process.env.PUSH_PROVIDER_ENABLED);
  const pushReady = isEnabled(process.env.PUSH_PROVIDER_READY);
  const configured =
    pushMode === 'configured-provider' || pushEnabled || pushReady;

  if (pushReady && !pushEnabled) {
    errors.push('PUSH_PROVIDER_READY=true requires PUSH_PROVIDER_ENABLED=true');
  }

  if (pushEnabled && pushMode !== 'configured-provider') {
    errors.push(
      'PUSH_PROVIDER_ENABLED=true requires PUSH_PROVIDER_MODE=configured-provider',
    );
  }

  if (!configured) return;

  validateHttpsUrl('PUSH_WEBHOOK_URL', process.env.PUSH_WEBHOOK_URL);
  requireSecret('PUSH_WEBHOOK_TOKEN', process.env.PUSH_WEBHOOK_TOKEN, 16);
}

function validateStorageProvider() {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (!['local', 's3', 'r2', 'minio', 'gcp'].includes(provider)) {
    errors.push(
      'STORAGE_PROVIDER must be one of local, s3, r2, minio, or gcp',
    );
    return;
  }

  if (provider === 'local') {
    if (!hasValue(process.env.LOCAL_STORAGE_ROOT)) {
      errors.push('LOCAL_STORAGE_ROOT is required when STORAGE_PROVIDER=local');
    }
    if (!process.env.LOCAL_STORAGE_ROOT?.startsWith('/')) {
      errors.push(
        'LOCAL_STORAGE_ROOT must be an absolute path for staging/production',
      );
    }
    return;
  }

  if (provider === 'gcp') {
    requirePresent('GCP_STORAGE_BUCKET');
    requirePresent('GCP_PROJECT_ID');
    requireSecret(
      'GCP_SERVICE_ACCOUNT_JSON_BASE64',
      process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64,
    );
    return;
  }

  requirePresent(storageEnvName(provider, 'OBJECT_STORAGE_BUCKET', 'R2_BUCKET'));
  requirePresent(
    storageEnvName(
      provider,
      'OBJECT_STORAGE_ACCESS_KEY_ID',
      'R2_ACCESS_KEY_ID',
    ),
  );
  requireSecret(
    storageEnvName(
      provider,
      'OBJECT_STORAGE_SECRET_ACCESS_KEY',
      'R2_SECRET_ACCESS_KEY',
    ),
    firstEnv(
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      process.env.R2_SECRET_ACCESS_KEY,
    ),
  );

  if (provider !== 's3') {
    requirePresent(
      storageEnvName(provider, 'OBJECT_STORAGE_ENDPOINT', 'R2_ENDPOINT'),
    );
  }

  if (provider === 'r2') {
    requirePresent('OBJECT_STORAGE_PUBLIC_BASE_URL or R2_PUBLIC_BASE_URL');
  }
}

function requirePresent(name) {
  if (name.includes(' or ')) {
    const values = name.split(' or ').map((key) => process.env[key]);
    if (values.some(hasValue)) return;
  } else if (hasValue(process.env[name])) {
    return;
  }
  errors.push(`${name} is required`);
}

function requireSecret(name, value, minLength = 32) {
  if (!hasValue(value)) return;
  if (value.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters`);
  }
  if (isPlaceholderSecret(value)) {
    errors.push(`${name} must not use a local/default placeholder value`);
  }
}

function rejectDefaultValue(name, value, defaults) {
  if (!hasValue(value)) return;
  if (defaults.includes(value.trim())) {
    errors.push(`${name} must not use the default value "${value.trim()}"`);
  }
}

function validateHttpsUrl(label, value) {
  parseHttpsUrl(label, value);
}

function parseHttpsUrl(label, value) {
  if (!hasValue(value)) return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      errors.push(`${label} must use https for staging/production: ${value}`);
      return null;
    }
    return parsed;
  } catch {
    errors.push(`${label} must be a valid URL: ${value}`);
    return null;
  }
}

function hasValue(value) {
  return Boolean(value?.trim());
}

function splitCsv(value) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isEnabled(value) {
  return ['1', 'true', 'yes'].includes((value ?? '').toLowerCase());
}

function firstEnv(...values) {
  return values.find(hasValue);
}

function storageEnvName(provider, genericName, r2AliasName) {
  if (provider === 'r2') return `${genericName} or ${r2AliasName}`;
  return genericName;
}

function isPlaceholderSecret(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('replace-with') ||
    normalized.includes('change-me') ||
    normalized.includes('local') ||
    normalized.includes('password123') ||
    normalized === 'secret'
  );
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function loadDeployEnvFile(filePath) {
  if (!hasValue(filePath)) return [];

  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    return [`Deploy env file does not exist: ${resolvedPath}`];
  }

  try {
    const source = readFileSync(resolvedPath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (!hasValue(process.env[key])) {
        process.env[key] = value;
      }
    }
    return [];
  } catch (error) {
    return [
      `Could not read deploy env file ${resolvedPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    ];
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const normalized = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;
  const equalsIndex = normalized.indexOf('=');
  if (equalsIndex <= 0) return null;

  const key = normalized.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = normalized.slice(equalsIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}
