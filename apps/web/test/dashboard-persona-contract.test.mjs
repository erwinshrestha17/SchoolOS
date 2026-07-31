import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('admin and principal dashboard separation', () => {
  it('routes admin and principal personas to distinct dashboard compositions', () => {
    const page = read('app/dashboard/page.tsx');
    const admin = read('components/dashboard/admin-dashboard.tsx');
    const principal = read('components/dashboard/principal-dashboard.tsx');

    assert.match(page, /resolveDashboardCompositionPersona/);
    assert.match(page, /projectDashboardForPersona/);
    assert.match(page, /compositionPersona === "admin"/);
    assert.match(page, /<AdminDashboard dashboard=\{projectedDashboard\} \/>/);
    assert.match(page, /compositionPersona === "principal"/);
    assert.match(page, /<PrincipalDashboard dashboard=\{projectedDashboard\} \/>/);
    assert.match(admin, /persona="admin"/);
    assert.match(principal, /persona="principal"/);
    assert.doesNotMatch(page, /<DashboardCommandCenter dashboard=/);
  });

  it('projects persona-specific module and attention payloads before render', () => {
    const persona = read('lib/dashboard-persona.ts');
    const page = read('app/dashboard/page.tsx');

    assert.match(persona, /export function projectDashboardForPersona/);
    assert.match(persona, /filterAttentionItemsForPersona/);
    assert.match(persona, /filterModulesForPersona/);
    assert.match(persona, /filterNextActionsForPersona/);
    assert.match(persona, /operationsModulesForPersona/);
    assert.match(page, /const projectedDashboard = useMemo/);
  });

  it('uses distinct executive and operations headings for principal and admin', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /title: "Executive Dashboard"/);
    assert.match(page, /title: "Operations Dashboard"/);
    assert.match(page, /eyebrow: "Executive oversight"/);
    assert.match(page, /eyebrow: "School operations"/);
  });

  it('scopes operations and readiness panels by persona', () => {
    const operations = read('components/dashboard/dashboard-operations-panel.tsx');
    const readiness = read('components/dashboard/dashboard-readiness-section.tsx');
    const summary = read('components/dashboard/dashboard-summary-strip.tsx');

    assert.match(operations, /operationsModulesForPersona\(persona\)/);
    assert.match(operations, /Operations oversight/);
    assert.match(readiness, /shouldShowReadinessPanel/);
    assert.match(summary, /includeFees = persona !== "principal"/);
    assert.match(summary, /includeStaff = persona === "admin" \|\| persona === "general"/);
  });
});
