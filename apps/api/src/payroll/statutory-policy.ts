import { Prisma } from '@prisma/client';

/**
 * Phase 7.8 — statutory policy contract and calculation.
 *
 * Statutory rates, bases, caps and slabs are NOT code. They live in an
 * approved `NepalHrPolicyVersion` of kind STATUTORY_SCHEME_TAX (national
 * scope, independent reviewer and approver, source checksum — all enforced by
 * the database). This module defines the typed payload those versions must
 * carry (payloadSchemaVersion 1), validates it, and computes amounts from it.
 *
 * Nothing here knows a Nepal rate. A payload that uses a method this engine
 * cannot compute faithfully is rejected rather than approximated.
 */

export const STATUTORY_PAYLOAD_VERSION = 1;

export const STATUTORY_SCHEME_CODES = [
  'SSF',
  'PF',
  'REMUNERATION_TAX',
] as const;
export type StatutorySchemeCode = (typeof STATUTORY_SCHEME_CODES)[number];

export const STATUTORY_BASES = [
  'BASIC',
  'BASIC_PLUS_ALLOWANCES',
  'GROSS',
] as const;
export type StatutoryBase = (typeof STATUTORY_BASES)[number];

export type StatutoryMethod = 'FLAT_RATE' | 'MARGINAL_SLABS';

export interface StatutorySlab {
  /** Upper bound of the band (period amount); null for the open last band. */
  upTo: Prisma.Decimal | null;
  rate: Prisma.Decimal;
}

export interface StatutorySchemeRule {
  code: StatutorySchemeCode;
  base: StatutoryBase;
  method: StatutoryMethod;
  employeeRate: Prisma.Decimal | null;
  employerRate: Prisma.Decimal | null;
  /** Ceiling on the base the rate is applied to, per payroll period. */
  baseCap: Prisma.Decimal | null;
  slabs: StatutorySlab[];
  /** Members must carry an identifier (SSF/PF number) to be payable. */
  requiresIdentifier: boolean;
}

export interface StatutoryPolicyDefinition {
  schemes: StatutorySchemeRule[];
}

export interface ResolvedStatutoryPolicy {
  versionId: string;
  policyKey: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceTitle: string;
  sourceChecksumSha256: string | null;
  definition: StatutoryPolicyDefinition;
}

export class StatutoryPolicyInvalidError extends Error {
  constructor(readonly reasons: string[]) {
    super(`Invalid statutory policy payload: ${reasons.join('; ')}`);
    this.name = 'StatutoryPolicyInvalidError';
  }
}

/** Raised when a line needs a scheme the resolved policy cannot supply. */
export class StatutoryConfigurationError extends Error {
  constructor(
    readonly code:
      | 'STATUTORY_POLICY_REQUIRED'
      | 'STATUTORY_SCHEME_NOT_IN_POLICY'
      | 'STATUTORY_SCHEME_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'StatutoryConfigurationError';
  }
}

const RATE_PATTERN = /^(?:0|1|0\.\d{1,6}|1\.0{1,6})$/;
const MONEY_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRate(
  value: unknown,
  label: string,
  reasons: string[],
): Prisma.Decimal | null {
  if (value === undefined || value === null) return null;
  // Strings only: a JSON number would already have been through a float.
  if (typeof value !== 'string' || !RATE_PATTERN.test(value)) {
    reasons.push(`${label} must be a decimal string between 0 and 1`);
    return null;
  }
  return new Prisma.Decimal(value);
}

function parseMoney(
  value: unknown,
  label: string,
  reasons: string[],
): Prisma.Decimal | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) {
    reasons.push(`${label} must be a non-negative decimal string`);
    return null;
  }
  return new Prisma.Decimal(value);
}

/**
 * Parses and validates a STATUTORY_SCHEME_TAX payload. Throws
 * StatutoryPolicyInvalidError listing every problem found.
 */
export function parseStatutoryPolicyPayload(
  payload: unknown,
): StatutoryPolicyDefinition {
  const reasons: string[] = [];
  if (!isRecord(payload) || !Array.isArray(payload.schemes)) {
    throw new StatutoryPolicyInvalidError(['payload.schemes must be an array']);
  }
  if (payload.schemes.length === 0) {
    throw new StatutoryPolicyInvalidError([
      'payload.schemes must not be empty',
    ]);
  }

  const schemes: StatutorySchemeRule[] = [];
  const seen = new Set<string>();
  payload.schemes.forEach((raw: unknown, index: number) => {
    const at = `schemes[${index}]`;
    if (!isRecord(raw)) {
      reasons.push(`${at} must be an object`);
      return;
    }
    const code = raw.code;
    if (code === 'CIT') {
      reasons.push(
        `${at}.code CIT is not supported yet: no ledger payable mapping exists for it`,
      );
      return;
    }
    if (
      typeof code !== 'string' ||
      !(STATUTORY_SCHEME_CODES as readonly string[]).includes(code)
    ) {
      reasons.push(
        `${at}.code must be one of ${STATUTORY_SCHEME_CODES.join(', ')}`,
      );
      return;
    }
    const schemeCode = code as StatutorySchemeCode;
    if (seen.has(schemeCode)) {
      reasons.push(`${at}.code ${schemeCode} appears more than once`);
      return;
    }
    seen.add(schemeCode);

    const base = raw.base;
    if (
      typeof base !== 'string' ||
      !(STATUTORY_BASES as readonly string[]).includes(base)
    ) {
      reasons.push(`${at}.base must be one of ${STATUTORY_BASES.join(', ')}`);
      return;
    }
    const method = raw.method ?? 'FLAT_RATE';
    if (method !== 'FLAT_RATE' && method !== 'MARGINAL_SLABS') {
      reasons.push(`${at}.method must be FLAT_RATE or MARGINAL_SLABS`);
      return;
    }
    const isTax = schemeCode === 'REMUNERATION_TAX';
    if (method === 'MARGINAL_SLABS' && !isTax) {
      reasons.push(`${at}: only REMUNERATION_TAX may use MARGINAL_SLABS`);
      return;
    }

    const employeeRate = parseRate(
      raw.employeeRate,
      `${at}.employeeRate`,
      reasons,
    );
    const employerRate = parseRate(
      raw.employerRate,
      `${at}.employerRate`,
      reasons,
    );
    const baseCap = parseMoney(raw.baseCap, `${at}.baseCap`, reasons);

    const slabs: StatutorySlab[] = [];
    if (method === 'FLAT_RATE') {
      if (raw.slabs !== undefined) {
        reasons.push(`${at}.slabs is only valid with MARGINAL_SLABS`);
      }
      if (employeeRate === null && employerRate === null) {
        reasons.push(`${at} needs an employeeRate or employerRate`);
      }
    } else {
      if (employeeRate !== null || employerRate !== null) {
        reasons.push(`${at}: MARGINAL_SLABS uses slabs, not flat rates`);
      }
      if (!Array.isArray(raw.slabs) || raw.slabs.length === 0) {
        reasons.push(`${at}.slabs must be a non-empty array`);
      } else {
        let previous: Prisma.Decimal | null = null;
        raw.slabs.forEach((slab: unknown, slabIndex: number) => {
          const slabAt = `${at}.slabs[${slabIndex}]`;
          const last = slabIndex === (raw.slabs as unknown[]).length - 1;
          if (!isRecord(slab)) {
            reasons.push(`${slabAt} must be an object`);
            return;
          }
          const rate = parseRate(slab.rate, `${slabAt}.rate`, reasons);
          const upTo = parseMoney(slab.upTo, `${slabAt}.upTo`, reasons);
          if (rate === null) {
            if (slab.rate === undefined || slab.rate === null)
              reasons.push(`${slabAt}.rate is required`);
            return;
          }
          if (last && slab.upTo !== null && slab.upTo !== undefined) {
            reasons.push(`${slabAt}.upTo must be null on the last band`);
          }
          if (!last) {
            if (upTo === null) {
              reasons.push(
                `${slabAt}.upTo is required except on the last band`,
              );
              return;
            }
            if (previous !== null && upTo.lte(previous)) {
              reasons.push(`${slabAt}.upTo must increase`);
            }
            previous = upTo;
          }
          slabs.push({ upTo: last ? null : upTo, rate });
        });
      }
    }

    if (isTax && employerRate !== null) {
      reasons.push(`${at}: REMUNERATION_TAX has no employer rate`);
    }

    if (
      raw.requiresIdentifier !== undefined &&
      typeof raw.requiresIdentifier !== 'boolean'
    ) {
      reasons.push(`${at}.requiresIdentifier must be a boolean`);
    }

    schemes.push({
      code: schemeCode,
      base: base as StatutoryBase,
      method,
      employeeRate,
      employerRate,
      baseCap,
      slabs,
      requiresIdentifier: !isTax && raw.requiresIdentifier === true,
    });
  });

  if (reasons.length) throw new StatutoryPolicyInvalidError(reasons);
  return { schemes };
}

export function findStatutoryScheme(
  policy: StatutoryPolicyDefinition | null | undefined,
  code: StatutorySchemeCode,
): StatutorySchemeRule | null {
  return policy?.schemes.find((scheme) => scheme.code === code) ?? null;
}

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

export interface StatutoryBaseAmounts {
  basic: Prisma.Decimal;
  basicPlusAllowances: Prisma.Decimal;
  gross: Prisma.Decimal;
}

export interface StatutoryAmount {
  code: StatutorySchemeCode;
  base: StatutoryBase;
  /** Base after the policy ceiling, i.e. what the rate was applied to. */
  baseAmount: Prisma.Decimal;
  employee: Prisma.Decimal;
  employer: Prisma.Decimal;
}

function pickBase(rule: StatutorySchemeRule, amounts: StatutoryBaseAmounts) {
  switch (rule.base) {
    case 'BASIC':
      return amounts.basic;
    case 'BASIC_PLUS_ALLOWANCES':
      return amounts.basicPlusAllowances;
    default:
      return amounts.gross;
  }
}

function marginal(base: Prisma.Decimal, slabs: StatutorySlab[]) {
  let tax = new Prisma.Decimal(0);
  let lower = new Prisma.Decimal(0);
  for (const slab of slabs) {
    if (base.lte(lower)) break;
    const upper = slab.upTo === null || base.lt(slab.upTo) ? base : slab.upTo;
    tax = tax.add(upper.sub(lower).mul(slab.rate));
    if (slab.upTo === null) break;
    lower = slab.upTo;
  }
  return tax;
}

/** Computes one scheme for one payroll line from the policy's own numbers. */
export function computeStatutoryAmount(
  rule: StatutorySchemeRule,
  amounts: StatutoryBaseAmounts,
): StatutoryAmount {
  let base = pickBase(rule, amounts);
  if (rule.baseCap !== null && base.gt(rule.baseCap)) base = rule.baseCap;
  base = money(base);
  if (rule.method === 'MARGINAL_SLABS') {
    return {
      code: rule.code,
      base: rule.base,
      baseAmount: base,
      employee: money(marginal(base, rule.slabs)),
      employer: new Prisma.Decimal(0),
    };
  }
  return {
    code: rule.code,
    base: rule.base,
    baseAmount: base,
    employee: rule.employeeRate
      ? money(base.mul(rule.employeeRate))
      : new Prisma.Decimal(0),
    employer: rule.employerRate
      ? money(base.mul(rule.employerRate))
      : new Prisma.Decimal(0),
  };
}

export interface StatutoryEnrollment {
  /** Retirement scheme the staff member belongs to on the period end date. */
  retirementScheme: 'SSF' | 'PF' | null;
  /** Remuneration tax withholding applies. */
  taxWithholding: boolean;
}

export interface StatutoryLineResult {
  pfEmployee: Prisma.Decimal;
  pfEmployer: Prisma.Decimal;
  tds: Prisma.Decimal;
  amounts: StatutoryAmount[];
}

/**
 * Resolves what a line owes under a policy. A line that owes a scheme the
 * policy does not define is a configuration error, never a silent zero.
 */
export function computeStatutoryForLine(
  policy: StatutoryPolicyDefinition | null,
  enrollment: StatutoryEnrollment,
  amounts: StatutoryBaseAmounts,
): StatutoryLineResult {
  const result: StatutoryLineResult = {
    pfEmployee: new Prisma.Decimal(0),
    pfEmployer: new Prisma.Decimal(0),
    tds: new Prisma.Decimal(0),
    amounts: [],
  };
  const needed: StatutorySchemeCode[] = [];
  if (enrollment.retirementScheme) needed.push(enrollment.retirementScheme);
  if (enrollment.taxWithholding) needed.push('REMUNERATION_TAX');
  if (!needed.length) return result;
  if (!policy) {
    throw new StatutoryConfigurationError(
      'STATUTORY_POLICY_REQUIRED',
      'No approved statutory policy version covers this payroll period',
    );
  }
  for (const code of needed) {
    const rule = findStatutoryScheme(policy, code);
    if (!rule) {
      throw new StatutoryConfigurationError(
        'STATUTORY_SCHEME_NOT_IN_POLICY',
        `The approved statutory policy does not define ${code}`,
      );
    }
    const amount = computeStatutoryAmount(rule, amounts);
    result.amounts.push(amount);
    if (code === 'REMUNERATION_TAX') result.tds = amount.employee;
    else {
      result.pfEmployee = amount.employee;
      result.pfEmployer = amount.employer;
    }
  }
  return result;
}

/** Serialisable breakdown stored on the payroll line (no identifiers). */
export function statutoryBreakdownJson(
  policyVersionId: string | null,
  amounts: StatutoryAmount[],
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!policyVersionId || !amounts.length) return Prisma.JsonNull;
  return {
    schemaVersion: STATUTORY_PAYLOAD_VERSION,
    policyVersionId,
    schemes: amounts.map((amount) => ({
      code: amount.code,
      base: amount.base,
      baseAmount: amount.baseAmount.toFixed(2),
      employee: amount.employee.toFixed(2),
      employer: amount.employer.toFixed(2),
    })),
  };
}
