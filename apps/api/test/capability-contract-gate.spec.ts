import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Phase 3A ratchet: actor-facing decisions are published through the
 * canonical ResourceAuthorization contract (buildResourceAuthorization or
 * @ProjectCanonicalAuthorization). Legacy per-domain shapes — `allowedActions`
 * maps/arrays and ad-hoc `canXxx:` action flags — may only remain in the files
 * below, each of which is served by a controller that ALSO emits the canonical
 * `authorization` for the same decisions. The list may only shrink.
 */
const SRC = join(__dirname, '..', 'src');

/**
 * `canXxx` properties that are domain data, not authorization: a rule
 * attribute (a requirement can be waived), module visibility, library/wallet
 * eligibility, waitlist capacity, guardian-link attributes and internal
 * function parameters. They must never be projected as actions.
 */
const DOMAIN_CAN_FIELDS = new Set([
  'canBeWaived',
  'canView',
  'canBorrow',
  'canPurchase',
  'canPromote',
  'canPromoteFromWaitlist',
  'canAccessStudentFiles',
  'canManageAll',
  'canDelegate',
]);

/** legacy file → controller(s) that bridge its decisions to `authorization`. */
const LEGACY_CAPABILITY_FILES: Record<string, string[]> = {
  'accounting/accounting.service.ts': ['accounting/accounting.controller.ts'],
  'accounting/bank-reconciliation.service.ts': [
    'accounting/accounting.controller.ts',
  ],
  'admissions/admission-cases.service.ts': [
    'admissions/admission-cases.controller.ts',
  ],
  'attendance/attendance.service.ts': ['mobile/mobile.controller.ts'],
  'finance/finance.service.ts': ['finance/payments.controller.ts'],
  'mobile/mobile-principal.service.ts': [
    'mobile/mobile-principal.controller.ts',
  ],
  'payroll/payroll.service.ts': ['payroll/payroll.controller.ts'],
};

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function hasLegacyShape(source: string): boolean {
  if (/allowedActions\s*[:=]/.test(source)) return true;
  for (const match of source.matchAll(/\b(can[A-Z][A-Za-z]+)\s*:/g)) {
    if (!DOMAIN_CAN_FIELDS.has(match[1])) return true;
  }
  return false;
}

describe('canonical capability contract ratchet (Phase 3A)', () => {
  const found = listFiles(SRC)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .filter((file) => hasLegacyShape(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).split('\\').join('/'))
    .sort();

  it('does not add legacy capability shapes outside the migrating inventory', () => {
    expect(found.filter((file) => !(file in LEGACY_CAPABILITY_FILES))).toEqual(
      [],
    );
  });

  it('keeps the inventory honest: entries that no longer need it are removed', () => {
    expect(
      Object.keys(LEGACY_CAPABILITY_FILES).filter(
        (file) => !found.includes(file),
      ),
    ).toEqual([]);
  });

  it('serves every remaining legacy file through the canonical bridge', () => {
    for (const controllers of Object.values(LEGACY_CAPABILITY_FILES)) {
      for (const controller of controllers) {
        expect(readFileSync(join(SRC, controller), 'utf8')).toMatch(
          /@ProjectCanonicalAuthorization\(/,
        );
      }
    }
  });
});
