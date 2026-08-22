import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

const dashboard = read('app/dashboard/page.tsx');
const summaryStrip = read('components/dashboard/dashboard-summary-strip.tsx');
const readiness = read('components/dashboard/dashboard-readiness-section.tsx');
const principalSummary = read('components/principal/principal-summary-workspace.tsx');
const approvals = read('app/dashboard/approvals/page.tsx');
const attention = read('app/dashboard/attention/page.tsx');
const operations = read('app/dashboard/operations/overview/page.tsx');

describe('Principal leadership workspaces', () => {
  it('keeps Principal Home leadership-first and routes attention to a durable workspace', () => {
    assert.match(dashboard, /title: "Principal Home"/);
    assert.match(dashboard, /"\/dashboard\/attention"/);
    assert.doesNotMatch(dashboard, /title: "Executive Dashboard"/);
    assert.match(attention, /title="Attention Centre"/);
  });

  it('uses four leadership-safe headline cards without granting Principal fee operations', () => {
    assert.match(summaryStrip, /label: "Attendance"/);
    assert.match(summaryStrip, /label: "Finance health"/);
    assert.match(summaryStrip, /label: "Staff availability"/);
    assert.match(summaryStrip, /label: "Needs attention"/);
    assert.match(summaryStrip, /moduleMap, "m11_accounting"/);
    assert.match(summaryStrip, /persona === "admin" \|\| persona === "accountant"/);
    assert.doesNotMatch(summaryStrip, /persona === "principal"[^\n]*includeFees/);
  });

  it('keeps Principal readiness inside the server projection and permission-gates timetable navigation', () => {
    for (const module of [
      'm4_academics',
      'm11_accounting',
      'm7_hr_payroll',
      'm10_communications',
    ]) {
      assert.match(readiness, new RegExp(`"${module}"`));
    }
    assert.match(readiness, /persona !== "principal" \|\| PRINCIPAL_READINESS_MODULES\.has/);
    assert.match(readiness, /useHasPermission\("timetable:read_published"\)/);
  });

  it('keeps Principal overview surfaces read-only and backend-backed', () => {
    assert.match(principalSummary, /api\.getModuleSummary/);
    assert.match(principalSummary, /summary\.status === "locked"/);
    assert.match(principalSummary, /summary\.status === "permissionDenied"/);
    assert.match(principalSummary, /summary\.status === "partial"/);
    assert.doesNotMatch(principalSummary, /POST|PUT|PATCH|DELETE/);
  });

  it('uses the audited advanced approval workflow with confirmation and idempotency', () => {
    assert.match(approvals, /api\.listApprovalRequests/);
    assert.match(approvals, /api\.decideApprovalRequest/);
    assert.match(approvals, /crypto\.randomUUID\(\)/);
    assert.match(approvals, /Confirm approval/);
    assert.match(approvals, /Confirm rejection/);
    assert.match(approvals, /Rejection reason is required/);
  });

  it('keeps M8 M9 M10 leadership access on the purpose-limited Principal summary endpoint', () => {
    assert.match(operations, /dashboard\/principal\/operations-summary/);
    assert.match(operations, /School Operations Overview/);
    assert.doesNotMatch(operations, /api\.collect|api\.create|api\.update|api\.delete/);
  });

  it('creates every planned leadership route', () => {
    for (const path of [
      'app/dashboard/attendance/overview/page.tsx',
      'app/dashboard/academics/readiness/page.tsx',
      'app/dashboard/finance-overview/page.tsx',
      'app/dashboard/hr/overview/page.tsx',
      'app/dashboard/students/overview/page.tsx',
      'app/dashboard/admissions/overview/page.tsx',
      'app/dashboard/activity/oversight/page.tsx',
      'app/dashboard/communications/oversight/page.tsx',
      'app/dashboard/audit/page.tsx',
    ]) {
      assert.ok(read(path).length > 0, `${path} must exist`);
    }
  });
});
