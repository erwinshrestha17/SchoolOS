import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Phase 3A ratchet: new endpoints MUST publish actor-facing decisions through
 * the canonical ResourceAuthorization contract (buildResourceAuthorization or
 * @ProjectCanonicalAuthorization). Legacy per-domain shapes — `allowedActions`
 * maps/arrays and ad-hoc `canXxx:` booleans — may only remain in the files
 * that already had them, and this list may only shrink as domains migrate.
 */
const SRC = join(__dirname, '..', 'src');

const LEGACY_CAPABILITY_FILES = [
  'accounting/accounting.service.ts',
  'accounting/bank-reconciliation.service.ts',
  'admissions/admission-case-queues.service.ts',
  'admissions/admission-cases.service.ts',
  'admissions/admission-policy-templates.ts',
  'admissions/admission-policy.service.ts',
  'admissions/m1-admissions-hardening.service.ts',
  'attendance/attendance.service.ts',
  'finance/finance.service.ts',
  'mobile/mobile-principal.service.ts',
  'operational-summary/operational-summary.service.ts',
  'operational-summary/operational-summary.types.ts',
  'payroll/payroll.service.ts',
  'settings/school-settings-navigation-v1.service.ts',
  'students/student-qr.service.ts',
].sort();

const LEGACY_SHAPE = /allowedActions\s*[:=]|\bcan[A-Z][A-Za-z]+\s*:/;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('canonical capability contract ratchet (Phase 3A)', () => {
  it('does not add legacy capability shapes outside the migrating inventory', () => {
    const found = listFiles(SRC)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => LEGACY_SHAPE.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split('\\').join('/'))
      .sort();

    const added = found.filter(
      (file) => !LEGACY_CAPABILITY_FILES.includes(file),
    );
    expect(added).toEqual([]);
  });

  it('projects the high-risk finance domains through the canonical bridge', () => {
    for (const controller of [
      'payroll/payroll.controller.ts',
      'accounting/accounting.controller.ts',
      'finance/payments.controller.ts',
    ]) {
      expect(readFileSync(join(SRC, controller), 'utf8')).toMatch(
        /@ProjectCanonicalAuthorization\(\{ module: '(payroll|accounting|fees)' \}\)/,
      );
    }
  });
});
