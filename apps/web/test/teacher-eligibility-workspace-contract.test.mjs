import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Phase 7.10 teacher eligibility workspace contracts', () => {
  const workspace = read('components/hr/teacher-eligibility-workspace.tsx');
  const view = read('lib/teacher-eligibility-view.ts');
  const api = read('lib/api/professional-identity.ts');

  it('is gated on hr:read and renders a permission-denied state otherwise', () => {
    assert.match(workspace, /hasPermissions\(\['hr:read'\]\)/);
    assert.match(workspace, /PermissionDenied/);
    const layout = read('app/dashboard/hr/layout.tsx');
    assert.match(layout, /hasPermissions\(\['hr:read'\]\)/);
    assert.match(layout, /\/dashboard\/hr\/teacher-eligibility/);
  });

  it('serves the route inside Suspense because it reads search params', () => {
    const page = read('app/dashboard/hr/teacher-eligibility/page.tsx');
    assert.match(page, /Suspense/);
    assert.match(page, /TeacherEligibilityWorkspace/);
    assert.match(workspace, /useSearchParams/);
  });

  it('is read-only: no mutation hooks or write API calls', () => {
    assert.doesNotMatch(workspace, /useMutation/);
    assert.doesNotMatch(
      workspace,
      /api\.(create|review|revoke|end|deactivate|update|delete|override)\w*/,
    );
    assert.match(workspace, /never grants, revokes or overrides/);
    assert.match(workspace, /Teacher role is not evidence/);
  });

  it('reads only the two server-decided endpoints', () => {
    assert.match(api, /professional\/eligibility-workspace/);
    assert.match(api, /\/eligibility-summary/);
    assert.match(workspace, /api\.getEligibilityWorkspace/);
    assert.match(workspace, /api\.getEligibilitySummary/);
  });

  it('never computes eligibility on the client', () => {
    assert.doesNotMatch(view, /decideEligibility|validUntil\s*[<>]/);
    assert.match(view, /server decides eligibility/);
  });

  it('shows Bikram Sambat dates and the redaction note', () => {
    assert.match(workspace, /formatBsDate/);
    assert.match(view, /formatBsDate/);
    assert.match(workspace, /Document and source references are hidden/);
  });

  it('offers a 1–180 day horizon defaulting to 30', () => {
    assert.match(view, /DEFAULT_HORIZON_DAYS = 30/);
    assert.match(view, /Math\.min\(180, Math\.max\(1/);
  });

  it('links the exceptions card and the staff panel to the workspace', () => {
    const exceptions = read('components/hr/eligibility-exceptions-surface.tsx');
    const panel = read('components/hr/professional-identity-panel.tsx');
    assert.match(exceptions, /\/dashboard\/hr\/teacher-eligibility/);
    assert.match(panel, /\/dashboard\/hr\/teacher-eligibility\?staff=/);
    assert.match(panel, /Reference hidden/);
  });

  it('does not use monospace styling', () => {
    assert.doesNotMatch(workspace, /font-mono/);
  });
});
