import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

describe('Stage 3 M4 learning-improvement workspace contract', () => {
  it('keeps the learning-improvement route fail-closed outside the pilot boundary', () => {
    const route = read(
      'app/dashboard/academics/learning-improvement/page.tsx',
    );
    const workspace = read(
      'components/academics/learning-improvement/learning-improvement-workspace.tsx',
    );

    assert.match(route, /notFound\(\)/);
    assert.doesNotMatch(
      `${route}\n${workspace}`,
      /lib\/api\/learning['"]|learningApi\.|\/dashboard\/learning/,
    );
  });

  it('connects every Stage 3 workflow to the module-owned backend contract', () => {
    const api = read('lib/api/learning-improvement.ts');

    for (const endpoint of [
      '/learning-improvement/early-warning',
      '/learning-improvement/outcomes',
      '/learning-improvement/formative-assessments',
      '/learning-improvement/interventions',
      '/learning-improvement/remedial-groups',
      '/learning-improvement/curriculum-progress',
      '/learning-improvement/parent-guidance',
    ]) {
      assert.match(api, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    for (const operation of [
      'getLearningEarlyWarnings',
      'listLearningOutcomes',
      'createLearningOutcome',
      'createFormativeAssessment',
      'listStudentInterventions',
      'createStudentIntervention',
      'addStudentInterventionEntry',
      'updateStudentIntervention',
      'createRemedialGroup',
      'addRemedialGroupMembers',
      'createCurriculumProgress',
      'updateCurriculumProgress',
      'createParentLearningGuidance',
      'updateParentLearningGuidanceStatus',
    ]) {
      assert.match(api, new RegExp(`${operation}:`), `Missing ${operation}`);
    }
  });

  it('keeps signals explainable and exposes honest workspace states', () => {
    const workspace = read(
      'components/academics/learning-improvement/learning-improvement-workspace.tsx',
    );

    assert.match(workspace, /does not predict/i);
    assert.match(workspace, /sourceStates/);
    assert.match(workspace, /ModuleLockedState/);
    assert.match(workspace, /PermissionDenied/);
    assert.match(workspace, /LoadingState/);
    assert.match(workspace, /EmptyState/);
    assert.match(workspace, /ErrorState/);
    assert.match(workspace, /TablePagination/);
    assert.doesNotMatch(workspace, /predictive score|AI risk|leaderboard/i);
  });

  it('requires reasoned, versioned intervention transitions and BS dates', () => {
    const caseSheet = read(
      'components/academics/learning-improvement/intervention-case-sheet.tsx',
    );
    const createDialog = read(
      'components/academics/learning-improvement/learning-improvement-create-dialog.tsx',
    );
    const actionDialog = read(
      'components/academics/learning-improvement/learning-improvement-action-dialog.tsx',
    );

    assert.match(caseSheet, /expectedVersion/);
    assert.match(caseSheet, /reason/);
    assert.match(caseSheet, /parentVisible/);
    assert.match(caseSheet, /formatBsDate/);
    assert.match(createDialog, /clientSubmissionId|clientRequestId/);
    assert.match(createDialog, /crypto\.randomUUID\(\)/);
    assert.match(actionDialog, /reason/);
    assert.doesNotMatch(
      `${caseSheet}\n${createDialog}\n${actionDialog}`,
      /toLocaleDateString|toLocaleString/,
    );
  });
});
