import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const webRoot = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

test('M1 workspaces expose real route-backed operations', () => {
  const api = read('lib/api/students.ts');
  const routes = [
    'app/dashboard/admissions/documents/page.tsx',
    'app/dashboard/admissions/duplicates/page.tsx',
    'app/dashboard/admissions/iemis/page.tsx',
    'app/dashboard/admissions/qr/page.tsx',
    'app/dashboard/admissions/review/page.tsx',
  ].map(read).join('\n');

  assert.match(routes, /StudentDocumentsWorkspace/);
  assert.match(routes, /DuplicateCandidatesWorkspace/);
  assert.match(routes, /IemisReadinessWorkspace/);
  assert.match(routes, /QrIdWorkspace/);
  assert.match(routes, /ApplicationReviewWorkspace/);
  assert.match(api, /\/students\/duplicates\/merge/);
  assert.match(api, /\/admissions\/applications/);
  assert.match(api, /updateAdmissionApplicationStatus/);
  assert.match(api, /enrollAdmissionApplication/);
  assert.match(api, /\/students\/summary/);
  assert.match(api, /\/admissions\/bulk-import\/batches/);
  assert.match(api, /\/admissions\/m1\/import-review\/queue/);
  assert.match(api, /\/students\/document-expiry\/templates/);
  assert.match(api, /confirmFileAccessReview: true/);
});

test('M1 admissions keeps legacy review workflow and adds unified direct admission', () => {
  const pipeline = read('components/admissions/admissions-pipeline.tsx');
  const applicationForm = read('components/m1/admission-application-form.tsx');
  const page = read('app/dashboard/admissions/new/page.tsx');
  const entry = read('components/m1/admission-entry.tsx');
  const wizard = read('components/m1/admission-case-wizard.tsx');
  const caseApi = read('lib/api/admission-cases.ts');
  const admissionsPage = read('app/dashboard/admissions/page.tsx');
  const nav = read('components/m1/m1-module-nav.tsx');

  assert.match(pipeline, /listAdmissionApplications/);
  assert.match(pipeline, /updateAdmissionApplicationStatus/);
  assert.match(pipeline, /enrollAdmissionApplication/);
  assert.match(pipeline, /PAGE_SIZE = 25/);
  assert.match(applicationForm, /createAdmissionApplication/);
  assert.match(applicationForm, /Creates an inquiry; it does not enroll a student/);
  assert.match(page, /AdmissionEntry/);
  assert.match(entry, /Direct admission/);
  assert.match(entry, /Admission review/);
  assert.match(entry, /admissionCasesApi\.getPolicy/);
  assert.match(wizard, /SchoolOS checks placement, policy requirements, and possible duplicates/);
  assert.match(wizard, /directAdmit/);
  assert.match(wizard, /Admit student/);
  assert.match(caseApi, /\/admissions\/cases/);
  assert.match(caseApi, /\/direct-admit/);
  assert.match(caseApi, /\/finalize/);
  assert.match(admissionsPage, /moreActionItems/);
  assert.match(admissionsPage, /\/dashboard\/admissions\/review/);
  assert.match(nav, /\/dashboard\/admissions\/review/);
  assert.doesNotMatch(pipeline + applicationForm + wizard + caseApi, /publicUrl|objectKey/);
});

test('M1 high-risk workflows remain server controlled and protected', () => {
  const duplicates = read('components/m1/duplicate-candidates-workspace.tsx');
  const documents = read('components/m1/student-documents-workspace.tsx');
  const qr = read('components/m1/qr-id-workspace.tsx');
  const iemis = read('components/m1/iemis-readiness-workspace.tsx');

  assert.match(duplicates, /previewDuplicateStudentMerge/);
  assert.match(duplicates, /mergeDuplicateStudent/);
  assert.match(duplicates, /Mark Not Duplicate — unavailable/);
  assert.match(documents, /ProtectedFileButton/);
  assert.match(documents, /removeStudentGuardianAccess/);
  assert.match(documents, /Expiry reminders/);
  assert.match(qr, /StudentQrCard/);
  assert.match(iemis, /CSV Import History/);
  assert.match(iemis, /Import Review Queue/);
  assert.doesNotMatch(duplicates + documents + qr + iemis, /publicUrl|objectKey/);
});

test('M1 student roster uses backend summary, safe filters, and paginated roster contract', () => {
  const page = read('app/dashboard/students/page.tsx');
  const directory = read('components/forms/student-directory.tsx');

  assert.match(page, /api\.getStudentModuleSummary\(filters\)/);
  assert.match(page, /limit: STUDENT_ROSTER_PAGE_SIZE/);
  assert.match(directory, /summary\?\.pendingApplications/);
  assert.match(directory, /summary\?\.missingDocuments/);
  assert.match(directory, /summary\?\.qrActive/);
  assert.match(directory, /Page \{currentPage\} of \{totalPages\}/);
  assert.match(directory, /value="ARCHIVED"/);
  assert.match(directory, /value="MERGED"/);
  assert.doesNotMatch(directory, /value="INACTIVE"|value="WITHDRAWN"|value="DEACTIVATED"|value="GRADUATED"/);
});
