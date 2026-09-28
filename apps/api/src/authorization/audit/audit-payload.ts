import { Prisma } from '@prisma/client';

const protectedKeys =
  /^(.*password.*|.*token(?:hash)?|.*secret.*|apiKey|authorization|cookie|otp|backupCodes?|recoveryCodes?|bankAccount|bankAccountNumber|citizenshipNo|panNumber)$/i;

/** Audit metadata must never become a second credential or bank-data store. */
export function safeAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 20) return '[TRUNCATED]';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.map((item) => safeAuditPayload(item, depth + 1));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        protectedKeys.test(key.replace(/[_\s-]/g, ''))
          ? '[REDACTED]'
          : safeAuditPayload(item, depth + 1),
      ]),
    );
  return value;
}
