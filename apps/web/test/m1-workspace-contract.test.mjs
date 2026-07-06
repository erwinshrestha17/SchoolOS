import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(webRoot, path), "utf8");

test("M1 workspaces expose real route-backed operations", () => {
  const api = read("lib/api/students.ts");
  const documentsWorkspace = read(
    "components/m1/student-documents-workspace.tsx",
  );
  const applicationReview = read(
    "components/m1/application-review-workspace.tsx",
  );
  const applicationReviewPage = read(
    "app/dashboard/admissions/applications/[applicationId]/page.tsx",
  );
  const documentsErrorBoundary = read(
    "app/dashboard/admissions/documents/error.tsx",
  );
  const routes = [
    "app/dashboard/admissions/documents/page.tsx",
    "app/dashboard/admissions/duplicates/page.tsx",
    "app/dashboard/admissions/iemis/page.tsx",
    "app/dashboard/admissions/qr/page.tsx",
    "app/dashboard/admissions/review/page.tsx",
  ]
    .map(read)
    .join("\n");

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
  assert.match(
    documentsWorkspace,
    /confirmFileAccessReview: guardianRemovalAccessReviewed/,
  );
  assert.match(documentsWorkspace, /requestedStudentId/);
  assert.match(documentsWorkspace, /requestedDocumentId/);
  assert.match(documentsWorkspace, /requestedKind/);
  assert.match(
    documentsWorkspace,
    /api\.getStudentProfile\(requestedStudentId!\)/,
  );
  assert.match(
    documentsWorkspace,
    /The linked student record can still load from the protected profile route/,
  );
  assert.match(documentsWorkspace, /DocumentWorkspaceFailure/);
  assert.match(documentsWorkspace, /ApiRequestError/);
  assert.match(documentsWorkspace, /ModuleLockedState/);
  assert.match(
    documentsWorkspace,
    /We could not load admission documents right now/,
  );
  assert.match(
    documentsWorkspace,
    /Your admission records have not been changed/,
  );
  assert.doesNotMatch(
    documentsWorkspace,
    /title="Missing" value="Unavailable"/,
  );
  assert.doesNotMatch(
    documentsWorkspace,
    /src=\{student\.photoUrl\}|src=\{profileQuery\.data\.student\.photoUrl\}/,
  );
  assert.doesNotMatch(applicationReview, /src=\{student\.photoUrl\}/);
  assert.match(applicationReviewPage, /ApplicationReviewWorkspace/);
  assert.match(applicationReviewPage, /admissionCaseId=\{applicationId\}/);
  assert.match(
    applicationReview,
    /admissionCasesApi\.getCase\(admissionCaseId\)/,
  );
  assert.match(
    applicationReview,
    /admissionCasesApi\.reviewCase\(admissionCaseId, payload\)/,
  );
  assert.match(applicationReview, /admissionCase\.review\.availableActions/);
  assert.match(applicationReview, /students:manage_lifecycle/);
  assert.match(applicationReview, /reviewerUserId: session\.user\.id/);
  assert.match(
    applicationReview,
    /Reviewer scoring and interview scheduling are not shown/,
  );
  assert.doesNotMatch(
    applicationReview,
    /api\.getStudentProfile|api\.listAdmissions/,
  );
  assert.match(documentsErrorBoundary, /M1PageHeader/);
  assert.match(documentsErrorBoundary, /onAction=\{reset\}/);
  assert.match(documentsErrorBoundary, /Return to admissions/);
  assert.match(
    documentsErrorBoundary,
    /Your admission records have not been changed/,
  );
});

test("M1 entry creates one unified admission case for direct and review workflows", () => {
  const legacyPipeline = read("components/admissions/admissions-pipeline.tsx");
  const applicationPipelinePage = read(
    "app/dashboard/admissions/applications/page.tsx",
  );
  const legacyApplicationForm = read(
    "components/m1/admission-application-form.tsx",
  );
  const entryPage = read("app/dashboard/admissions/new/page.tsx");
  const entry = read("components/m1/admission-entry.tsx");
  const directWizard = read("components/m1/admission-case-wizard.tsx");
  const reviewForm = read("components/m1/admission-review-case-form.tsx");
  const queues = read("components/m1/admission-case-queues.tsx");
  const caseApi = read("lib/api/admission-cases.ts");
  const admissionsPage = read("app/dashboard/admissions/page.tsx");
  const moduleNav = read("components/m1/m1-module-nav.tsx");
  const dashboardShell = read("components/layout/dashboard-shell.tsx");
  const policySettings = read(
    "components/settings/admission-policy-settings.tsx",
  );
  const mobileRouter = read("../schoolos_mobile/lib/app/router.dart");

  assert.match(legacyPipeline, /listAdmissionApplications/);
  assert.match(legacyPipeline, /isAdmissionCaseDisplayStatus/);
  assert.match(legacyPipeline, /isLegacyApplicationStatus/);
  assert.match(legacyPipeline, /Open review workspace/);
  assert.match(
    legacyPipeline,
    /\/dashboard\/admissions\/applications\/\$\{application\.id\}/,
  );
  assert.match(legacyPipeline, /application\.status === "ADMITTED"/);
  assert.match(legacyPipeline, /NEXT_STATUSES\[application\.status\]/);
  assert.match(applicationPipelinePage, /AdmissionsPipeline/);
  assert.match(applicationPipelinePage, /Application pipeline/);
  assert.doesNotMatch(applicationPipelinePage, /legacy admission applications/);
  assert.match(applicationPipelinePage, /\/dashboard\/admissions\/new/);
  assert.match(legacyApplicationForm, /createAdmissionApplication/);
  assert.match(entryPage, /AdmissionEntry/);
  assert.match(entryPage, /caseId/);
  assert.match(entry, /AdmissionCaseWizard/);
  assert.match(entry, /initialCaseId/);
  assert.match(entry, /AdmissionReviewCaseForm/);
  assert.doesNotMatch(entry, /AdmissionApplicationForm/);
  assert.match(entry, /admissionCasesApi\.getPolicy/);
  assert.match(entry, /School-office admission/);
  assert.match(entry, /Continue an existing application/);
  assert.match(entry, /Transfer or special review/);
  assert.match(entry, /Import admissions/);
  assert.match(
    directWizard,
    /SchoolOS checks placement, policy requirements, and possible duplicates/,
  );
  assert.match(directWizard, /Saving admission draft/);
  assert.match(directWizard, /Step \{step \+ 1\} of \{STEPS\.length\}/);
  assert.match(directWizard, /Draft saved just now/);
  assert.match(directWizard, /Recovery link/);
  assert.match(directWizard, /EarlyMatchNotice/);
  assert.match(directWizard, /Possible existing record found/);
  assert.match(directWizard, /relatedStudentCandidates/);
  assert.match(directWizard, /Guardian and sibling resolution/);
  assert.match(directWizard, /directAdmit/);
  assert.match(directWizard, /Admit student/);
  assert.match(directWizard, /admissionCasesApi\.updateCase/);
  assert.match(directWizard, /api\.uploadFile\(file, 'admissions', caseId\)/);
  assert.match(directWizard, /Add another student/);
  assert.match(directWizard, /Open follow-up checklist/);
  assert.match(directWizard, /Select gender/);
  assert.match(directWizard, /Select relationship/);
  assert.match(directWizard, /Date of birth \(BS\)/);
  assert.match(directWizard, /toGregorianDateFromBs/);
  assert.match(reviewForm, /Select gender/);
  assert.match(reviewForm, /Select relationship/);
  assert.match(reviewForm, /Admission date \(BS\)/);
  assert.match(reviewForm, /toGregorianDateFromBs/);
  assert.doesNotMatch(
    directWizard + reviewForm,
    /gender: 'FEMALE'|guardianRelation: 'mother'/,
  );
  assert.match(reviewForm, /admissionCasesApi\.createCase/);
  assert.match(reviewForm, /admissionCaseIdRef/);
  assert.match(reviewForm, /MARK_READY_FOR_REVIEW/);
  assert.match(queues, /listQueues/);
  assert.match(queues, /Ready to Admit/);
  assert.match(queues, /More filters/);
  assert.match(queues, /query\.data\.total > query\.data\.limit/);
  assert.match(caseApi, /\/admissions\/cases/);
  assert.match(caseApi, /\/direct-admit/);
  assert.match(caseApi, /\/finalize/);
  assert.match(admissionsPage, /AdmissionCaseQueues/);
  assert.match(admissionsPage, /New admission/);
  assert.match(admissionsPage, /\/dashboard\/admissions\/applications/);
  assert.match(moduleNav, /\/dashboard\/admissions\/applications/);
  assert.doesNotMatch(dashboardShell, /'\/dashboard\/admissions': 'students'/);
  assert.match(policySettings, /Rules for selected admissions/);
  assert.match(policySettings, /GRADE_11_12/);
  assert.match(mobileRouter, /snapshotKey: 'admissions'/);
  assert.doesNotMatch(
    directWizard + reviewForm + caseApi,
    /publicUrl|objectKey/,
  );
});

test("M1 high-risk workflows remain server controlled and protected", () => {
  const duplicates = read("components/m1/duplicate-candidates-workspace.tsx");
  const documents = read("components/m1/student-documents-workspace.tsx");
  const qr = read("components/m1/qr-id-workspace.tsx");
  const iemis = read("components/m1/iemis-readiness-workspace.tsx");
  const admissionCase = read("components/m1/admission-case-detail.tsx");

  assert.match(duplicates, /previewDuplicateStudentMerge/);
  assert.match(duplicates, /mergeDuplicateStudent/);
  assert.match(duplicates, /Mark Not Duplicate — unavailable/);
  assert.match(documents, /StudentDocumentAccessButton/);
  assert.match(
    documents,
    /api\.previewStudentDocument\(studentId, document\.id\)/,
  );
  assert.match(
    documents,
    /api\.downloadStudentDocument\(studentId, document\.id\)/,
  );
  assert.match(documents, /openProtectedFile\(access\.fileAssetId/);
  assert.match(documents, /downloadProtectedFile\(access\.fileAssetId/);
  assert.match(
    documents,
    /api\.archiveStudentDocument\(documentId, \{ reason \}\)/,
  );
  assert.match(documents, /Archive reason/);
  assert.match(documents, /archiveReason\.trim\(\)\.length < 5/);
  assert.match(documents, /BsDateField/);
  assert.match(
    documents,
    /toGregorianDateFromBs\(parseBsDateInput\(uploadExpiryDateBs\)\)/,
  );
  assert.match(documents, /expiryDate: metadata\.expiryDate/);
  assert.match(documents, /notes: metadata\.notes/);
  assert.match(documents, /reason: metadata\.reason/);
  assert.match(documents, /Uploading now will create a replacement record/);
  assert.match(documents, /uploadReason\.trim\(\)\.length < 5/);
  assert.match(documents, /removeStudentGuardianAccess/);
  assert.match(documents, /guardianRemovalAccessReviewed/);
  assert.match(
    documents,
    /confirmFileAccessReview: guardianRemovalAccessReviewed/,
  );
  assert.match(documents, /guardianRemovalReplacementId/);
  assert.match(
    documents,
    /newPrimaryGuardianId: guardianToRemove\.isPrimary \? guardianRemovalReplacementId : null/,
  );
  assert.match(
    documents,
    /I reviewed guardian portal and protected-file access/,
  );
  assert.match(documents, /A student must have at least one guardian/);
  assert.match(documents, /Expiry reminders/);
  assert.doesNotMatch(
    documents,
    /fileAssetId=\{selectedDocument\.fileId\}|fileAssetId=\{document\.fileId\}/,
  );
  assert.doesNotMatch(documents, /api\.deleteStudentDocument/);
  assert.match(qr, /StudentQrCard/);
  assert.match(iemis, /CSV Import History/);
  assert.match(iemis, /Import Review Queue/);
  assert.match(admissionCase, /Finalize admission/);
  assert.match(admissionCase, /Duplicate override/);
  assert.match(admissionCase, /canOverrideDuplicate/);
  assert.match(admissionCase, /admissionCase\.review\.availableActions/);
  assert.doesNotMatch(admissionCase, /Admission review approved\./);
  assert.doesNotMatch(
    duplicates + documents + qr + iemis + admissionCase,
    /publicUrl|objectKey/,
  );

  // "Not admit" is a hard-to-reverse decision on a real applicant: it must
  // use the shared destructive-confirmation dialog, not the same inline
  // reason panel as the reversible Approve/Request-information actions.
  assert.match(admissionCase, /import { ConfirmDialog } from "..\/ui\/confirm-dialog"/);
  assert.match(admissionCase, /variant="destructive"/);
  assert.match(admissionCase, /rejectDialogOpen/);
  assert.match(admissionCase, /<ConfirmDialog/);
  assert.match(admissionCase, /Do not admit this applicant\?/);
  assert.match(admissionCase, /confirmDisabled=\{rejectReason\.trim\(\)\.length < 5\}/);
  assert.match(
    admissionCase,
    /reviewMutation\.mutate\(\{\s*action: "REJECT"/,
  );
});

test("M1 student roster uses backend summary, safe filters, and paginated roster contract", () => {
  const page = read("app/dashboard/students/page.tsx");
  const directory = read("components/forms/student-directory.tsx");

  assert.match(page, /api\.getStudentModuleSummary\(filters\)/);
  assert.match(page, /limit: STUDENT_ROSTER_PAGE_SIZE/);
  assert.match(directory, /summary\?\.pendingApplications/);
  assert.match(directory, /summary\?\.missingDocuments/);
  assert.match(directory, /summary\?\.qrActive/);
  assert.match(directory, /Page \{currentPage\} of \{totalPages\}/);
  assert.match(directory, /value="ARCHIVED"/);
  assert.match(directory, /value="MERGED"/);
  assert.doesNotMatch(
    directory,
    /value="INACTIVE"|value="WITHDRAWN"|value="DEACTIVATED"|value="GRADUATED"/,
  );
});

test("M1 Admissions overview shows a real, actionable, honest KPI grid", () => {
  const page = read("app/dashboard/admissions/page.tsx");
  const header = read("components/m1/m1-page-header.tsx");

  // Uses the same bounded, permission-filtered operational-summary contract
  // already computed backend-side, not a browser total or a fake placeholder.
  assert.match(page, /api\.getModuleSummary\('students'\)/);
  assert.match(page, /applicationsNeedingReview/);
  assert.match(page, /unverifiedDocuments/);
  assert.match(page, /duplicateCandidates/);
  assert.match(page, /iemisReadinessBlockers/);

  // Honest states: real backend zero is fine, but loading/locked/unavailable
  // must never render as a fabricated 0.
  assert.match(page, /summaryQuery\.isLoading\) return 'Loading'/);
  assert.match(page, /return 'Unavailable'/);

  // Every card opens a real, existing filtered queue.
  assert.match(page, /href="\/dashboard\/admissions"/);
  assert.match(page, /href="\/dashboard\/admissions\/documents"/);
  assert.match(page, /href="\/dashboard\/admissions\/duplicates"/);
  assert.match(page, /href="\/dashboard\/admissions\/iemis"/);

  // The header component threads the KPI grid through without disturbing
  // task pages (documents/duplicates/iemis/etc.) that reuse the same header
  // but never pass a kpiGrid prop.
  assert.match(header, /kpiGrid\?: ReactNode/);
});

test("student directory row actions use the shared keyboard-accessible ActionMenu, not a hover-only menu", () => {
  const directory = read("components/forms/student-directory.tsx");

  // The old pattern was a CSS group-hover dropdown with no click/focus
  // toggle — unusable by keyboard. Every row action must go through the
  // shared ActionMenu component instead of a module-specific reimplementation.
  assert.doesNotMatch(directory, /group\/actions/);
  assert.doesNotMatch(directory, /group-hover\/actions:block/);
  assert.match(directory, /label=\{`Open actions for \$\{studentName\}`\}/);
  assert.match(directory, /label: 'Edit Student'/);
  assert.match(directory, /label: 'Edit Guardian'/);
  assert.match(directory, /label: 'ID Card'/);
  assert.match(directory, /label: 'Documents'/);
  assert.match(directory, /label: 'Attendance'/);
});

test("admission case review actions have consistent visual risk hierarchy across both review surfaces", () => {
  const caseDetail = read("components/m1/admission-case-detail.tsx");
  const reviewWorkspace = read("components/m1/application-review-workspace.tsx");

  // Approve is the common, positive path — it must read as the primary
  // action (no explicit variant = default/filled), not the same visual
  // weight as a neutral action like "Request information".
  assert.doesNotMatch(
    caseDetail,
    /variant="outline"\s*\n\s*onClick=\{\(\) => setReviewAction\("APPROVE"\)\}/,
  );

  // Reject ("Do not admit") must be visually destructive in both places
  // real applicants can be rejected from, not just one.
  assert.match(caseDetail, /variant="destructive"/);
  assert.match(
    reviewWorkspace,
    /action === "REJECT"\s*\n\s*\? "destructive"/,
  );

  // Wording must match within a single flow: the button that opens the
  // confirm dialog and the dialog's own confirm label must agree.
  assert.match(caseDetail, />\s*Do not admit\s*</);
  assert.match(caseDetail, /confirmLabel="Do not admit"/);
});

test("clear-selection and low-risk row icon buttons carry an accessible name", () => {
  const selector = read("components/students/student-selector.tsx");

  assert.match(selector, /aria-label="Clear selected student"/);
  assert.match(selector, /title="Clear selected student"/);
});
