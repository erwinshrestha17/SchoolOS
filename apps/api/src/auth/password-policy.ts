import { BadRequestException } from '@nestjs/common';

const COMMON_PASSWORDS = new Set([
  'admin123',
  'password123',
  'school123',
  'qwerty123',
  'welcome123',
  'letmein123',
]);

export function assertStrongPassword(
  password: string,
  identityHints: Array<string | null | undefined> = [],
) {
  const normalized = password.toLowerCase();

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    COMMON_PASSWORDS.has(normalized)
  ) {
    throw new BadRequestException('Password must be stronger.');
  }

  for (const hint of identityHints) {
    const parts = normalizedIdentityParts(hint);
    if (parts.some((part) => normalized.includes(part))) {
      throw new BadRequestException('Password must be stronger.');
    }
  }
}

export function assertPasswordsMatch(password: string, confirmation: string) {
  if (password !== confirmation) {
    throw new BadRequestException('Confirm password must match new password.');
  }
}

function normalizedIdentityParts(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}
