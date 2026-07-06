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

  it('sources KPI cards from the real bounded module-summary API, not a browser total or a fake placeholder', () => {
    const page = read('app/dashboard/academics/page.tsx');

    // A real, module-owned, bounded backend summary contract already exists
    // (GET /dashboard/academics/summary via getModuleSummary) — the overview
    // must use it instead of the "Needs a real M4 summary API" stub.
    assert.match(page, /getModuleSummary\('academics'\)/);
    assert.doesNotMatch(page, /Needs a real M4 summary API/);
    assert.doesNotMatch(page, /getStepProgress/);
    assert.doesNotMatch(page, /reportsQuery\.data\?\.length/);
    assert.match(page, /Official readiness remains backend-owned/);

    // Honest states: never a bare fabricated value, always Loading/Unavailable
    // driven by the query's own status, and real drill-through hrefs.
    assert.match(page, /summaryQuery\.isLoading\) return 'Loading'/);
    assert.match(page, /'Unavailable'/);
    assert.match(page, /href="\/dashboard\/academics\/marks"/);
    assert.match(page, /href="\/dashboard\/academics\/report-cards"/);
    assert.match(page, /href="\/dashboard\/academics\/promotion"/);
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

  it('requires explicit confirmation before bypassing an exam-term security lock', () => {
    const lockTab = read('components/academics/tabs/marks-lock-tab.tsx');

    // Unlocking a locked exam term re-opens marks for correction — this is
    // an explicitly high-risk action that must never fire directly from a
    // single click, unlike every other icon-only/no-confirmation gap found
    // in this module.
    assert.match(lockTab, /import \{ ConfirmDialog \} from '@\/components\/ui\/confirm-dialog'/);
    assert.match(lockTab, /showUnlockConfirm/);
    assert.doesNotMatch(
      lockTab,
      /onClick=\{\(\) => unlockMutation\.mutate\(\{ id: unlockForm\.examTermId/,
    );
    assert.match(lockTab, /<ConfirmDialog[\s\S]{0,500}variant="destructive"/);
    assert.doesNotMatch(lockTab, /🔒|🔓/);
  });

  it('uses the shared Button component for mark-lock review decisions', () => {
    const lockTab = read('components/academics/tabs/marks-lock-tab.tsx');

    assert.match(lockTab, /import \{ Button \} from '@\/components\/ui\/button'/);
    assert.match(lockTab, /variant="destructive"[\s\S]{0,400}Reject/);
  });

  it('shows visible text for retest approve/reject/cancel decisions instead of icon-only controls', () => {
    const retakesTab = read('components/academics/tabs/assessment-retakes-tab.tsx');

    // Approve/Reject are on the explicit list of actions that must never be
    // icon-only, regardless of how low-risk the surrounding flow looks.
    assert.doesNotMatch(
      retakesTab,
      /<IconAction[\s\S]{0,40}title="Approve request"/,
    );
    assert.doesNotMatch(
      retakesTab,
      /<IconAction[\s\S]{0,40}title="Reject request"/,
    );
    assert.match(retakesTab, />\s*Approve\s*</);
    assert.match(retakesTab, /variant="destructive"[\s\S]{0,150}Reject/);
    assert.match(retakesTab, /import \{ Tooltip \} from '@\/components\/ui\/tooltip'/);
  });

  it('wires a real Unpublish control to the previously-unreachable unpublish mutation', () => {
    const publishingTab = read('components/academics/tabs/result-publishing-tab.tsx');

    // unpublishMut existed with a real mutationFn and onSuccess/onError
    // handling but had no button anywhere calling .mutate on it.
    assert.match(publishingTab, /handleBatchUnpublish/);
    assert.match(publishingTab, /confirmBatchUnpublish/);
    assert.match(publishingTab, /onClick=\{handleBatchUnpublish\}/);
    assert.match(publishingTab, /\n\s*Unpublish\s*\n/);
  });

  it('requires confirmation before deleting a CAS observation and labels the action visibly', () => {
    const casTab = read('components/academics/tabs/cas-records-tab.tsx');

    // Delete is on the explicit list of actions that must never be
    // icon-only, and this delete previously fired with zero confirmation.
    assert.doesNotMatch(casTab, /onClick=\{\(\) => deleteMutation\.mutate\(record\.id\)\}/);
    assert.match(casTab, /setDeleteTarget/);
    assert.match(casTab, /import \{ ConfirmDialog \} from '@\/components\/ui\/confirm-dialog'/);
    assert.match(casTab, /variant="destructive"[\s\S]{0,80}Delete/);
  });

  it('wires the promotion readiness "Details" button to a real dialog instead of a dead click', () => {
    const promotionTab = read('components/academics/tabs/promotion-tab.tsx');

    assert.doesNotMatch(promotionTab, /Scroll to marks\/results if review needed/);
    assert.match(promotionTab, /onClick=\{\(\) => setDetailStudent\(s\)\}/);
    assert.match(promotionTab, /detailStudent\?\.reasons/);
  });

  it('removes the duplicate local Loader2 SVG and remaining lock emoji from exam terms', () => {
    const examTermsTab = read('components/academics/tabs/exam-terms-tab.tsx');

    assert.doesNotMatch(examTermsTab, /function Loader2/);
    assert.match(examTermsTab, /Loader2\s*$/m);
    assert.doesNotMatch(examTermsTab, /🔒|🔓/);
  });
});
