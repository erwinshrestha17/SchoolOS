import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const webRoot = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

test('M1 workspaces expose real route-backed operations', () => {
  const api = read('lib/api/students.ts');
  const documentsWorkspace = read('components/m1/student-documents-workspace.tsx');
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
  assert.match(routes, /redirect\('\/dashboard\/admissions'\)/);
  assert.match(api, /\/students\/duplicates\/merge/);
  assert.match(api, /\/admissions\/applications/);
  assert.match(api, /updateAdmissionApplicationStatus/);
  assert.match(api, /enrollAdmissionApplication/);
  assert.match(api, /\/students\/summary/);
  assert.match(api, /\/admissions\/bulk-import\/batches/);
  assert.match(api, /\/admissions\/m1\/import-review\/queue/);
  assert.match(api, /\/students\/document-expiry\/templates/);
  assert.match(documentsWorkspace, /confirmFileAccessReview: true/);
});

test('M1 entry creates one unified admission case for direct and review workflows', () => {
  const legacyPipeline = read('components/admissions/admissions-pipeline.tsx');
  const legacyApplicationForm = read('components/m1/admission-application-form.tsx');
  const entryPage = read('app/dashboard/admissions/new/page.tsx');
  const entry = read('components/m1/admission-entry.tsx');
  const directWizard = read('components/m1/admission-case-wizard.tsx');
  const reviewForm = read('components/m1/admission-review-case-form.tsx');
  const queues = read('components/m1/admission-case-queues.tsx');
  const caseApi = read('lib/api/admission-cases.ts');
  const admissionsPage = read('app/dashboard/admissions/page.tsx');
  const policySettings = read('components/settings/admission-policy-settings.tsx');
  const mobileRouter = read('../schoolos_mobile/lib/app/router.dart');

  assert.match(legacyPipeline, /listAdmissionApplications/);
  assert.match(legacyApplicationForm, /createAdmissionApplication/);
  assert.match(entryPage, /AdmissionEntry/);
  assert.match(entry, /AdmissionCaseWizard/);
  assert.match(entry, /AdmissionReviewCaseForm/);
  assert.doesNotMatch(entry, /AdmissionApplicationForm/);
  assert.match(entry, /admissionCasesApi\.getPolicy/);
  assert.match(directWizard, /SchoolOS checks placement, policy requirements, and possible duplicates/);
  assert.match(directWizard, /directAdmit/);
  assert.match(directWizard, /Admit student/);
  assert.match(directWizard, /admissionCasesApi\.updateCase/);
  assert.match(directWizard, /api\.uploadFile\(file, 'admissions', caseId\)/);
  assert.match(directWizard, /Add another student/);
  assert.match(reviewForm, /admissionCasesApi\.createCase/);
  assert.match(reviewForm, /admissionCaseIdRef/);
  assert.match(reviewForm, /MARK_READY_FOR_REVIEW/);
  assert.match(queues, /listQueues/);
  assert.match(queues, /Ready to Admit/);
  assert.match(caseApi, /\/admissions\/cases/);
  assert.match(caseApi, /\/direct-admit/);
  assert.match(caseApi, /\/finalize/);
  assert.match(admissionsPage, /AdmissionCaseQueues/);
  assert.match(admissionsPage, /New admission/);
  assert.match(policySettings, /Rules for selected admissions/);
  assert.match(policySettings, /GRADE_11_12/);
  assert.match(mobileRouter, /snapshotKey: 'admissions'/);
  assert.doesNotMatch(directWizard + reviewForm + caseApi, /publicUrl|objectKey/);
});

test('M1 high-risk workflows remain server controlled and protected', () => {
  const duplicates = read('components/m1/duplicate-candidates-workspace.tsx');
  const documents = read('components/m1/student-documents-workspace.tsx');
  const qr = read('components/m1/qr-id-workspace.tsx');
  const iemis = read('components/m1/iemis-readiness-workspace.tsx');
  const admissionCase = read('components/m1/admission-case-detail.tsx');

  assert.match(duplicates, /previewDuplicateStudentMerge/);
  assert.match(duplicates, /mergeDuplicateStudent/);
  assert.match(duplicates, /Mark Not Duplicate — unavailable/);
  assert.match(documents, /ProtectedFileButton/);
  assert.match(documents, /removeStudentGuardianAccess/);
  assert.match(documents, /Expiry reminders/);
  assert.match(qr, /StudentQrCard/);
  assert.match(iemis, /CSV Import History/);
  assert.match(iemis, /Import Review Queue/);
  assert.match(admissionCase, /Finalize admission/);
  assert.match(admissionCase, /Duplicate override/);
  assert.match(admissionCase, /canOverrideDuplicate/);
  assert.doesNotMatch(duplicates + documents + qr + iemis + admissionCase, /publicUrl|objectKey/);
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
