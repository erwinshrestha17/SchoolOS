import { z } from "zod";

export const NEPAL_MOBILE_PREFIXES = {
  NTC: ["974", "975", "976", "984", "985", "986"],
  Ncell: ["970", "971", "980", "981", "982"],
} as const;

export type NepalMobileCarrier = keyof typeof NEPAL_MOBILE_PREFIXES;

const NEPALI_DIGITS = "०१२३४५६७८९";
const ALL_NEPAL_MOBILE_PREFIXES = new Set<string>(
  Object.values(NEPAL_MOBILE_PREFIXES).flat(),
);
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toLatinDigits(value: string): string {
  return Array.from(value, (character) => {
    const index = NEPALI_DIGITS.indexOf(character);
    return index >= 0 ? String(index) : character;
  }).join("");
}

export function tryNormalizeNepalPhone(value: string): string | null {
  let normalized = toLatinDigits(value)
    .trim()
    .replace(/[\s()-]/g, "");
  if (normalized.startsWith("+977")) normalized = normalized.slice(4);
  else if (normalized.startsWith("00977")) normalized = normalized.slice(5);

  if (!/^\d{10}$/.test(normalized)) return null;
  if (!ALL_NEPAL_MOBILE_PREFIXES.has(normalized.slice(0, 3))) return null;
  return `+977${normalized}`;
}

export function normalizeNepalPhone(value: string): string {
  const normalized = tryNormalizeNepalPhone(value);
  if (!normalized) {
    throw new Error("Enter a valid 10-digit Nepal mobile number.");
  }
  return normalized;
}

export function getNepalMobileCarrier(
  value: string,
): NepalMobileCarrier | null {
  const normalized = tryNormalizeNepalPhone(value);
  if (!normalized) return null;
  const prefix = normalized.slice(4, 7);
  return NEPAL_MOBILE_PREFIXES.NTC.includes(prefix as never) ? "NTC" : "Ncell";
}

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidPersonName(value: string): boolean {
  const normalized = normalizePersonName(value);
  return (
    normalized.length >= 2 &&
    normalized.length <= 120 &&
    PERSON_NAME_PATTERN.test(normalized) &&
    /\p{L}/u.test(normalized)
  );
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && z.email().safeParse(normalized).success;
}

export function isValidDateOfBirth(value: string, today = new Date()): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (date > todayUtc) return false;

  const oldestAllowed = new Date(todayUtc);
  oldestAllowed.setUTCFullYear(oldestAllowed.getUTCFullYear() - 120);
  return date >= oldestAllowed;
}

export const nepalPhoneSchema = z
  .string()
  .refine((value) => tryNormalizeNepalPhone(value) !== null, {
    message: "Enter a valid 10-digit Nepal mobile number.",
  })
  .transform(normalizeNepalPhone);

export const personNameSchema = z
  .string()
  .transform(normalizePersonName)
  .refine(isValidPersonName, {
    message:
      "Use 2–120 Nepali or English letters, spaces, apostrophes, hyphens, or dots.",
  });

export const normalizedEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .refine(isValidEmail, { message: "Enter a valid email address." });

export const dateOfBirthSchema = z.string().refine(isValidDateOfBirth, {
  message:
    "Date of birth must be YYYY-MM-DD, not future, and within 120 years.",
});
