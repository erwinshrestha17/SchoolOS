const targetEnv = (process.env.DEPLOY_ENV ?? process.env.NODE_ENV ?? '').toLowerCase();

if (targetEnv !== 'production') {
  console.log(
    `Skipping production deploy env preflight (DEPLOY_ENV/NODE_ENV is "${targetEnv || 'unset'}").`,
  );
  process.exit(0);
}

const requiredVars = [
  'ALLOW_PROD_BOOT',
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
  'JWT_CHALLENGE_SECRET',
  'MEDICAL_ENCRYPTION_KEY',
];

const missing = requiredVars.filter((name) => !process.env[name]?.trim());

if (!process.env.FRONTEND_ORIGIN?.trim() && !process.env.FRONTEND_ORIGINS?.trim()) {
  missing.push('FRONTEND_ORIGIN or FRONTEND_ORIGINS');
}

const errors = [];
if (missing.length > 0) {
  for (const variable of missing) {
    errors.push(`${variable} is required for production deploy preflight`);
  }
}

if ((process.env.ALLOW_PROD_BOOT ?? '').toLowerCase() !== 'true') {
  errors.push('ALLOW_PROD_BOOT must be set to true for production deploy preflight');
}

if ((process.env.JWT_SECRET ?? '').length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters');
}

if ((process.env.JWT_CHALLENGE_SECRET ?? '').length < 32) {
  errors.push('JWT_CHALLENGE_SECRET must be at least 32 characters');
}

if ((process.env.MEDICAL_ENCRYPTION_KEY ?? '').length < 32) {
  errors.push('MEDICAL_ENCRYPTION_KEY must be at least 32 characters');
}

const configuredOrigins = [
  process.env.FRONTEND_ORIGIN,
  ...(process.env.FRONTEND_ORIGINS?.split(',') ?? []),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

for (const origin of configuredOrigins) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:') {
      errors.push(`Frontend origin must use https in production: ${origin}`);
    }
  } catch {
    errors.push(`Frontend origin must be a valid URL: ${origin}`);
  }
}

if ((process.env.EMAIL_DELIVERY_MODE ?? 'log').toLowerCase() === 'webhook') {
  if (!process.env.EMAIL_WEBHOOK_URL?.trim()) {
    errors.push('EMAIL_WEBHOOK_URL is required when EMAIL_DELIVERY_MODE=webhook');
  }
  if (!process.env.EMAIL_WEBHOOK_TOKEN?.trim()) {
    errors.push('EMAIL_WEBHOOK_TOKEN is required when EMAIL_DELIVERY_MODE=webhook');
  }
}

if ((process.env.STORAGE_PROVIDER ?? 'local').toLowerCase() === 'r2') {
  if (!process.env.R2_PUBLIC_BASE_URL?.trim()) {
    errors.push('R2_PUBLIC_BASE_URL is required when STORAGE_PROVIDER=r2');
  }
}

if (errors.length > 0) {
  console.error('Production deploy environment preflight failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Production deploy environment preflight passed.');
