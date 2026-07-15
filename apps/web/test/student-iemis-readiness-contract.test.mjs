import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Student iEMIS readiness contract', () => {
  it('uses backend-owned counts and one compact Overview summary', () => {
    const overview = read('components/students/profile/tabs/overview-tab.tsx');
    const api = read('lib/api/students.ts');

    assert.match(api, /request<StudentIemisReadiness>/);
    assert.match(overview, /passedRequiredChecks/);
    assert.match(overview, /totalRequiredChecks/);
    assert.match(overview, /blockingIssueCount/);
    assert.match(overview, /warningCount/);
    assert.match(overview, /exportEligible/);
    assert.match(overview, /evaluatedAt/);
    assert.match(overview, /Review missing details/);
    assert.match(
      overview,
      /\/dashboard\/students\/\$\{encodeURIComponent\(studentId\)\}\/iemis/,
    );
    assert.doesNotMatch(overview, /Review iEMIS fields/);
    assert.doesNotMatch(overview, /\{query\.data\.score\}%/);
    assert.doesNotMatch(overview, /key: 'iemis'/);
  });

  it('renders every readiness and issue severity state with visible text', () => {
    const workspace = read(
      'components/students/student-iemis-readiness-page.tsx',
    );

    for (const value of [
      'READY',
      'READY_WITH_WARNINGS',
      'BLOCKED',
      'NOT_EVALUATED',
      'OUTDATED_VALIDATION',
      'BLOCKING',
      'WARNING',
      'INFORMATION',
      'NOT_REQUIRED',
    ]) {
      assert.match(workspace, new RegExp(`['"]${value}['"]`));
    }

    assert.match(workspace, /Ready with warnings/);
    assert.match(workspace, /Needs attention/);
    assert.match(workspace, /Not checked yet/);
    assert.match(workspace, /Check outdated/);
    assert.match(workspace, /Required · Blocks export/);
    assert.match(workspace, /Not required/);
    assert.match(workspace, /Checking readiness…/);
    assert.doesNotMatch(workspace, /0%/);
  });

  it('keeps correction actions permission-aware and refetches official truth', () => {
    const workspace = read(
      'components/students/student-iemis-readiness-page.tsx',
    );
    const detail = read('components/students/student-detail-page.tsx');
    const header = read('components/students/profile/profile-header.tsx');

    assert.match(workspace, /hasPermissions/);
    assert.match(workspace, /issue\.requiredPermission/);
    assert.match(workspace, /Contact authorized student records staff/);
    assert.match(workspace, /Contact an authorized admissions administrator/);
    assert.match(workspace, /Add Nepali name/);
    assert.match(workspace, /Assign section/);
    assert.doesNotMatch(workspace, /disabled edit/i);
    assert.match(
      detail,
      /queryKey: \[['"]student-iemis-readiness['"], studentId\]/,
    );
    assert.match(detail, /student-iemis-readiness-list/);
    assert.doesNotMatch(detail, /setQueryData\(\['student-iemis-readiness'/);
    assert.match(detail, /hasPermissions\(\[["']students:update["']\]\)/);
    assert.match(header, /canEdit \? \(/);
    assert.match(
      header,
      /Profile changes require authorized student records staff/,
    );
  });

  it('uses active-enrollment placement and school-friendly copy', () => {
    const overview = read('components/students/profile/tabs/overview-tab.tsx');
    const profile = read('components/students/profile/tabs/profile-tab.tsx');
    const workspace = read(
      'components/students/student-iemis-readiness-page.tsx',
    );
    const editor = read('components/students/profile/student-edit-card.tsx');
    const touchedCopy = `${overview}\n${profile}\n${workspace}\n${editor}`;

    assert.match(
      profile,
      /Official identity and enrollment details for this student/,
    );
    assert.match(
      profile,
      /The student’s current academic year, class, and section placement/,
    );
    assert.match(overview, /No active enrollment/);
    assert.doesNotMatch(
      profile,
      /profile\.enrollments\[0\]|scoped profile response|scoped student profile API|active enrollment data/,
    );
    assert.match(editor, /SchoolOS does not infer[\s\S]*gender/);
    assert.doesNotMatch(editor, /student\.nationality \?\? ['"]Nepali['"]/);
    assert.match(editor, /nationality, disability/);
    assert.doesNotMatch(
      touchedCopy,
      /returned by the scoped student profile API|Current class placement from the active enrollment data|response payload|scoped record|backend data|Prisma/,
    );
  });

  it('provides a dedicated responsive route and safe failure states', () => {
    const route = read('app/dashboard/students/[studentId]/iemis/page.tsx');
    const workspace = read(
      'components/students/student-iemis-readiness-page.tsx',
    );

    assert.match(route, /StudentIemisReadinessPage/);
    assert.match(workspace, /Government reporting readiness/);
    assert.match(workspace, /sm:grid-cols-2/);
    assert.match(workspace, /xl:grid-cols/);
    assert.match(workspace, /Readiness details are incomplete/);
    assert.match(workspace, /ModuleLockedState/);
    assert.match(workspace, /statusCode === 403/);
    assert.match(workspace, /statusCode === 404/);
    assert.match(workspace, /No active enrollment/);
    assert.match(workspace, /focus-visible:ring-2/);
  });
});
