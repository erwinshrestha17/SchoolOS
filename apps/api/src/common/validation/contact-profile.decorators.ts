import {
  isValidDateOfBirth,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizePersonName,
  tryNormalizeNepalPhone,
} from '@schoolos/core';
import { Transform } from 'class-transformer';
import { ValidateBy, type ValidationOptions } from 'class-validator';

export const NormalizeNepalPhone = () =>
  Transform((parameters) => {
    const value: unknown = parameters.value;
    if (typeof value !== 'string') return value;
    return tryNormalizeNepalPhone(value) ?? value;
  });

export const NormalizePersonName = () =>
  Transform((parameters) => {
    const value: unknown = parameters.value;
    return typeof value === 'string' ? normalizePersonName(value) : value;
  });

export const NormalizeEmailAddress = () =>
  Transform((parameters) => {
    const value: unknown = parameters.value;
    return typeof value === 'string' ? normalizeEmail(value) : value;
  });

export function IsNepalPhone(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isNepalPhone',
      validator: {
        validate: (value) =>
          typeof value === 'string' && tryNormalizeNepalPhone(value) !== null,
        defaultMessage: () =>
          'Enter a valid 10-digit Nepal mobile number with an NTC or Ncell prefix.',
      },
    },
    validationOptions,
  );
}

export function IsPersonName(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isPersonName',
      validator: {
        validate: (value) =>
          typeof value === 'string' && isValidPersonName(value),
        defaultMessage: () =>
          'Use 2–120 Nepali or English letters, spaces, apostrophes, hyphens, or dots.',
      },
    },
    validationOptions,
  );
}

export function IsProfileEmail(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isProfileEmail',
      validator: {
        validate: (value) => typeof value === 'string' && isValidEmail(value),
        defaultMessage: () =>
          'Enter a valid email address (maximum 254 characters).',
      },
    },
    validationOptions,
  );
}

export function IsDateOfBirth(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isDateOfBirth',
      validator: {
        validate: (value) =>
          typeof value === 'string' && isValidDateOfBirth(value),
        defaultMessage: () =>
          'Date of birth must be YYYY-MM-DD, not future, and within 120 years.',
      },
    },
    validationOptions,
  );
}
