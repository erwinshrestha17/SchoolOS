import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Slice 3 server-side dashboard projection client contract', () => {
  it('consumes server compositionPersona without client persona query keys', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /assertServerDashboardProjection/);
    assert.match(page, /compositionPersona/);
    assert.match(page, /queryKey: \["operational-dashboard-summary", tenantId\]/);
    assert.doesNotMatch(page, /queryKey: \["operational-dashboard-summary", compositionPersona\]/);
    assert.doesNotMatch(page, /projectDashboardForPersona\(dashboardQuery\.data, expectedPersona\)/);
  });

  it('fails closed when server projection persona mismatches client expectation', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /projectionMismatch/);
    assert.match(page, /projectedDashboard === null/);
    assert.match(page, /<PermissionDenied/);
  });

  it('keeps dashboard query disabled until permission resolution completes', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /permissionResolution === "granted"/);
    assert.match(page, /permissionResolution === "loading"/);
  });
});

describe('Slice 3 dashboard persona core contract', () => {
  it('defines server-side module query boundaries for admin and principal', () => {
    const persona = read('../../packages/core/src/dashboard-persona.ts');

    assert.match(persona, /export function dashboardModulesForComposition/);
    assert.match(persona, /ADMIN_DASHBOARD_MODULES/);
    assert.match(persona, /PRINCIPAL_DASHBOARD_MODULES/);
    assert.match(persona, /HR_DASHBOARD_MODULES/);
    assert.match(persona, /ACCOUNTANT_DASHBOARD_MODULES/);
    assert.match(persona, /isSupportedDashboardPersona/);
    assert.match(persona, /export function assertServerDashboardProjection/);
  });
});
