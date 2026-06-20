import { BadRequestException } from '@nestjs/common';
import {
  isValidDateOfBirth,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizeNepalPhone,
  normalizePersonName,
} from '@schoolos/core';

export function requirePersonName(value: string, field: string): string {
  const normalized = normalizePersonName(value);
  if (!isValidPersonName(normalized)) {
    throw new BadRequestException(`${field} is not a valid person name`);
  }
  return normalized;
}

export function optionalPersonName(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === null || value === undefined || !value.trim()) return null;
  return requirePersonName(value, field);
}

export function requireProfileEmail(value: string): string {
  const normalized = normalizeEmail(value);
  if (!isValidEmail(normalized)) {
    throw new BadRequestException('Email is not valid');
  }
  return normalized;
}

export function optionalProfileEmail(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !value.trim()) return null;
  return requireProfileEmail(value);
}

export function requireNepalPhone(value: string): string {
  try {
    return normalizeNepalPhone(value);
  } catch {
    throw new BadRequestException(
      'Phone must be a valid Nepal mobile number with an NTC or Ncell prefix',
    );
  }
}

export function optionalNepalPhone(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !value.trim()) return null;
  return requireNepalPhone(value);
}

export function parseDateOfBirth(value: string): Date {
  if (!isValidDateOfBirth(value)) {
    throw new BadRequestException(
      'Date of birth must be YYYY-MM-DD, not future, and within 120 years',
    );
  }
  return new Date(`${value}T00:00:00.000Z`);
}
