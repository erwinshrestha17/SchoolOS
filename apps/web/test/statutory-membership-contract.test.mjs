import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('Phase 7.8 statutory membership UI contracts', () => {
  const panel = read('components/hr/statutory-membership-panel.tsx');

  it('is gated by hr:tax permissions and renders nothing without read access', () => {
    assert.match(panel, /hasPermissions\(\['hr:tax:read'\]\)/);
    assert.match(panel, /hasPermissions\(\['hr:tax:write'\]\)/);
    assert.match(panel, /if \(!canRead\) return null;/);
    assert.match(panel, /enabled: canRead/);
  });

  it('masks the member number until the viewer chooses to reveal it', () => {
    assert.match(panel, /maskIdentifier\(row\.memberIdentifier\)/);
    assert.match(panel, /revealed\[row\.id\]/);
  });

  it('never shows or edits contribution or tax rates', () => {
    assert.doesNotMatch(panel, /employeeRate|employerRate|ratePercent/);
  });

  it('is mounted on the staff payroll tab and uses the documented endpoints', () => {
    const workspace = read('components/hr/staff-detail-workspace.tsx');
    assert.match(
      workspace,
      /<StatutoryMembershipPanel staffId=\{staffId\} \/>/,
    );
    const client = read('lib/api/payroll.ts');
    assert.match(client, /\/statutory-memberships/);
    assert.match(client, /\/hr\/statutory-memberships\//);
    assert.match(client, /\/payroll\/statutory-policy/);
  });

  it('explains that the salary-structure switches rely on membership and policy', () => {
    const dialog = read('components/hr/salary-structure-dialog.tsx');
    assert.match(dialog, /approved (statutory )?policy/i);
  });
});
