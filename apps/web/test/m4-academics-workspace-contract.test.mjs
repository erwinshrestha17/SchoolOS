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
      '/dashboard/academics/retakes',
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

  it('wires the full retest and make-up lifecycle to real API commands', () => {
    const workspace = read(
      'components/academics/tabs/assessment-retakes-tab.tsx',
    );
    const requestDialog = read(
      'components/academics/assessment-retake-request-dialog.tsx',
    );
    const api = read('lib/api/academics.ts');
    const marks = read('components/academics/tabs/marks-entry-tab.tsx');

    assert.match(workspace, /listAssessmentRetakes/);
    assert.match(workspace, /getAssessmentRetake/);
    assert.match(workspace, /RetakeDetailDialog/);
    assert.match(workspace, /approveAssessmentRetake/);
    assert.match(workspace, /rejectAssessmentRetake/);
    assert.match(workspace, /scheduleAssessmentRetake/);
    assert.match(workspace, /completeAssessmentRetake/);
    assert.match(workspace, /applyAssessmentRetakeResult/);
    assert.match(workspace, /cancelAssessmentRetake/);
    assert.match(workspace, /formatBsDateTime/);
    assert.match(workspace, /zonedNepalDateTimeToUtc/);
    assert.match(requestDialog, /createAssessmentRetake/);
    assert.match(api, /assessment-retakes/);
    assert.match(marks, /AssessmentRetakeRequestDialog/);
    assert.doesNotMatch(marks, /isRetest:/);
  });

  it('omits blank optional UUID filters from CAS list requests', () => {
    const api = read('lib/api/academics.ts');

    assert.match(api, /Object\.entries\(filters \?\? \{\}\)\.filter/);
    assert.match(api, /value !== ''/);
    assert.match(
      api,
      /withQuery\('\/academics\/cas-records', activeFilters\)/,
    );
  });

  it('guards unsaved marks against silent loss and respects per-student locks', () => {
    const workspace = read(
      'components/academics/tabs/marks-entry-tab.tsx',
    );

    // Switching exam/class/subject/component context must not silently
    // discard marks that have not been saved yet.
    assert.match(workspace, /hasUnsavedChanges/);
    assert.match(workspace, /requestFilterChange/);
    assert.match(workspace, /Discard unsaved marks\?/);

    // Reads the real per-mark lock state the backend computes (a mark can
    // stay individually locked even after the exam term itself reopens),
    // not just the coarser exam-term-level lock.
    assert.match(workspace, /lockedStudentIds/);
    assert.match(workspace, /mark\.isLocked/);
    assert.match(workspace, /isStudentLocked/);
  });
});
