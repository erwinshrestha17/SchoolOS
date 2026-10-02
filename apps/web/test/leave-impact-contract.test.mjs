import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('Phase 7.6 leave impact and coverage contracts', () => {
  it('shows the server-computed academic impact in the review dialog', () => {
    const dialog = read('components/hr/leave-review-dialog.tsx');
    const panel = read('components/hr/leave-impact-panel.tsx');
    const client = read('lib/api/attendance.ts');

    assert.match(
      dialog,
      /<LeaveImpactPanel leaveRequestId=\{leaveRequest\.id\}/,
    );
    assert.match(
      client,
      /\/hr\/leave-requests\/\$\{encodeURIComponent\(id\)\}\/impact/,
    );
    assert.match(panel, /getLeaveRequestImpact/);
    assert.match(panel, /impact\.totals\.unresolved/);
    assert.match(panel, /freeTeacherCount/);
    // No client-side derivation of coverage or availability.
    assert.doesNotMatch(panel, /\.reduce\(/);
    assert.match(panel, /still checks\s+eligibility/);
  });

  it('renders overlap anomalies with the fields the server returns', () => {
    const dialog = read('components/hr/leave-review-dialog.tsx');
    assert.match(dialog, /anom\.date/);
    assert.doesNotMatch(dialog, /anom\.attendanceDate|anom\.proposedStatus/);
  });

  it('offers half-day leave and surfaces the server reason on failure', () => {
    const create = read('components/hr/leave-request-create-dialog.tsx');
    assert.match(create, /value="FIRST_HALF"/);
    assert.match(create, /value="SECOND_HALF"/);
    assert.match(create, /dayPart/);
    assert.match(create, /error instanceof Error && error\.message/);
  });

  it('lists leave coverage today-first for leave approvers and lets staff withdraw pending leave', () => {
    const page = read('app/dashboard/hr/leave/page.tsx');
    const coverage = read('components/hr/leave-coverage-panel.tsx');
    const mine = read('components/staff/my-leave-requests.tsx');
    const client = read('lib/api/attendance.ts');

    assert.match(page, /hasPermissions\(\['hr:leave:approve'\]\)/);
    assert.match(page, /<LeaveCoveragePanel \/>/);
    assert.match(coverage, /getLeaveCoverage/);
    assert.match(client, /\/hr\/leave-coverage/);
    assert.match(mine, /request\.status === 'PENDING'/);
    assert.match(mine, /withdrawLeaveRequest/);
    assert.match(client, /\/withdraw`/);
  });
});
