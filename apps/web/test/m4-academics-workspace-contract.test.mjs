import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

describe('M4 academics workspace contract', () => {
  it('uses the shared module workspace with one primary marks action', () => {
    const page = read('app/dashboard/academics/page.tsx');

    assert.match(page, /<ModuleHeader/);
    assert.match(page, /<KpiGrid/);
    assert.match(page, /<ModuleTabs/);
    assert.match(page, />\s*Create Exam Term\s*</);
    assert.match(page, />\s*Enter Marks\s*</);
    assert.match(page, /moreActionItems/);
    assert.match(page, /Assessment Components/);
    assert.match(page, /Report Card Jobs & History/);
    assert.match(page, /Publish Results/);
    assert.match(page, /label: 'Locks'/);
    assert.match(page, /label: 'Promotion'/);
    assert.match(page, /label: 'Publishing'/);
  });

  it('does not present browser-derived M4 totals or readiness as official', () => {
    const page = read('app/dashboard/academics/page.tsx');

    assert.doesNotMatch(page, /useQuery/);
    assert.doesNotMatch(page, /getStepProgress/);
    assert.doesNotMatch(page, /reportsQuery\.data\?\.length/);
    assert.match(page, /Needs a real M4 summary API/);
    assert.match(page, /Official readiness remains backend-owned/);
    assert.match(page, /Draft Marks/);
    assert.match(page, /Active Subjects/);
  });

  it('links only to existing M4 workspaces and preserves protected workflow language', () => {
    const page = read('app/dashboard/academics/page.tsx');

    for (const route of [
      '/dashboard/academics/exam-terms',
      '/dashboard/academics/marks',
      '/dashboard/academics/cas',
      '/dashboard/academics/locks',
      '/dashboard/academics/report-cards',
      '/dashboard/academics/promotion',
      '/dashboard/academics/publishing',
      '/dashboard/academics/results',
    ]) {
      assert.match(page, new RegExp(route.replaceAll('/', '\\/')));
    }

    assert.match(page, /protected PDF access/);
    assert.match(page, /tenant-scoped and permissioned M4 workspaces/);
  });
});
