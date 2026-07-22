import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(webRoot, path), "utf8");

test("M1 transport failures use status-aware school-facing copy", () => {
  const errorBoundary = read("lib/school-facing-error.ts");
  const guardedSurfaces = [
    "app/dashboard/students/page.tsx",
    "components/m1/admission-application-form.tsx",
    "components/m1/admission-case-detail.tsx",
    "components/m1/admission-case-wizard.tsx",
    "components/m1/admission-review-case-form.tsx",
    "components/m1/application-review-workspace.tsx",
    "components/m1/assessment-interview-workspace.tsx",
    "components/m1/duplicate-candidates-workspace.tsx",
    "components/m1/qr-id-workspace.tsx",
    "components/m1/student-documents-workspace.tsx",
    "components/students/profile/lifecycle-panel.tsx",
    "components/students/profile/student-edit-card.tsx",
    "components/students/profile/student-qr-card.tsx",
    "components/students/profile/tabs/guardians-tab.tsx",
  ].map(read);

  assert.match(errorBoundary, /error instanceof OfflineMutationError/);
  assert.match(errorBoundary, /!\(error instanceof ApiRequestError\)/);
  assert.match(errorBoundary, /case 400:/);
  assert.match(errorBoundary, /case 401:/);
  assert.match(errorBoundary, /case 403:/);
  assert.match(errorBoundary, /case 404:/);
  assert.match(errorBoundary, /case 409:/);
  assert.match(errorBoundary, /case 413:/);
  assert.match(errorBoundary, /case 422:/);
  assert.match(errorBoundary, /case 429:/);
  assert.doesNotMatch(errorBoundary, /return error\.message/);

  for (const source of guardedSurfaces) {
    assert.match(source, /schoolFacingErrorMessage/);
    assert.doesNotMatch(source, /instanceof Error\s*\?\s*[\w.]+\.message/);
    assert.doesNotMatch(source, /mutation\.error\.message/);
    assert.doesNotMatch(source, /\{error\.message\}/);
    assert.doesNotMatch(source, /\.error\?\.message/);
  }
});

test("M1 workspaces expose real route-backed operations", () => {
  const api = read("lib/api/students.ts");
  const caseApi = read("lib/api/admission-cases.ts");
  const documentRequestCenter = read(
    "components/m1/document-request-center.tsx",
  );
  const educationProgram = read("lib/education-program.ts");
  const assessmentWorkspace = read(
    "components/m1/assessment-interview-workspace.tsx",
  );
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
    "app/dashboard/admissions/assessments/page.tsx",
    "app/dashboard/admissions/duplicates/page.tsx",
    "app/dashboard/admissions/iemis/page.tsx",
    "app/dashboard/admissions/qr/page.tsx",
    "app/dashboard/admissions/review/page.tsx",
  ]
    .map(read)
    .join("\n");

  assert.match(routes, /StudentDocumentsWorkspace/);
  assert.match(routes, /DocumentRequestCenter/);
  assert.match(routes, /AssessmentInterviewWorkspace/);
  assert.match(routes, /DuplicateCandidatesWorkspace/);
  assert.match(routes, /IemisReadinessWorkspace/);
  assert.match(routes, /QrIdWorkspace/);
  assert.match(routes, /redirect\('\/dashboard\/admissions'\)/);
  assert.match(caseApi, /\/admissions\/document-requests/);
  assert.match(caseApi, /AdmissionDocumentRequestPage/);
  assert.match(caseApi, /requestDocumentReminders/);
  assert.match(caseApi, /\/admissions\/document-requests\/reminders/);
  assert.match(caseApi, /AdmissionDocumentReminderBatchResult/);
  assert.match(caseApi, /\/admissions\/assessment-sessions/);
  assert.match(caseApi, /\/admissions\/assessment-candidates/);
  assert.match(
    caseApi,
    /\/admissions\/cases\/\$\{admissionCaseId\}\/assessment-session/,
  );
  assert.match(caseApi, /AdmissionAssessmentSessionPage/);
  assert.match(
    documentRequestCenter,
    /admissionCasesApi\.listDocumentRequests/,
  );
  assert.match(documentRequestCenter, /policyId/);
  assert.match(documentRequestCenter, /classId/);
  assert.match(documentRequestCenter, /minDaysPending/);
  assert.match(documentRequestCenter, /requestDocumentReminders/);
  assert.match(documentRequestCenter, /Queue reminders/);
  assert.match(documentRequestCenter, /ConfirmDialog/);
  assert.match(documentRequestCenter, /students:manage_lifecycle/);
  assert.match(documentRequestCenter, /guardians:read/);
  assert.match(documentRequestCenter, /already queued/);
  assert.match(documentRequestCenter, /Queued does\s+not mean delivered/);
  assert.match(documentRequestCenter, /educationProgramLabel/);
  assert.match(educationProgram, /School · Grade 1–10/);
  assert.match(educationProgram, /Higher Secondary · Grade 11–12 \/ \+2/);
  assert.match(educationProgram, /Program unavailable/);
  assert.doesNotMatch(
    documentRequestCenter,
    /Notification delivery is not enabled for this admissions workspace yet/,
  );
  assert.match(assessmentWorkspace, /formatBsDateForInput/);
  assert.match(assessmentWorkspace, /formatBsDateTime/);
  assert.match(assessmentWorkspace, /listAssessmentSessions/);
  assert.match(assessmentWorkspace, /listAssessmentCandidates/);
  assert.match(assessmentWorkspace, /scheduleAssessmentSession/);
  assert.match(assessmentWorkspace, /recordAssessmentResult/);
  assert.match(assessmentWorkspace, /AWAITING_RESULTS/);
  assert.match(assessmentWorkspace, /filters\.admissionCaseId/);
  assert.match(assessmentWorkspace, /Scheduling candidates could not load/);
  assert.match(caseApi, /searchParams\.set\("admissionCaseId"/);
  assert.doesNotMatch(assessmentWorkspace, /datetime-local/);
  assert.match(api, /\/students\/duplicates\/merge/);
  assert.match(api, /listDuplicateStudentCandidates/);
  assert.match(api, /page\?: number/);
  assert.match(api, /search\?: string/);
  assert.match(api, /confidence\?: StudentDuplicateConfidenceFilter/);
  assert.match(api, /status\?: StudentDuplicateQueueStatus/);
  assert.match(api, /markDuplicateStudentPairNotDuplicate/);
  assert.match(api, /\/students\/duplicates\/reviews/);
  assert.match(api, /reopenDuplicateStudentReview/);
  assert.match(api, /encodeURIComponent\(reviewId\).*\/reopen/);
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
    applicationReviewPage,
    /complete any required assessment or interview/,
  );
  assert.doesNotMatch(
    applicationReviewPage,
    /unsupported scoring or interview/,
  );
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
  assert.match(applicationReview, /admissionCase\.assessmentSession/);
  assert.match(applicationReview, /policyRequirements\.requireInterview/);
  assert.match(applicationReview, /Schedule assessment/);
  assert.match(applicationReview, /resultScore/);
  assert.match(applicationReview, /admissionCaseId=\$\{encodeURIComponent/);
  assert.doesNotMatch(applicationReview, /Still unavailable/);
  assert.doesNotMatch(
    applicationReview,
    /no backend-owned rubric, score contract, or persisted interview record/,
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
  const dashboardShell = read("components/layout/dashboard-shell.tsx");
  const policyList = read("components/settings/admission-policy-list.tsx");
  const policyWizard = read("components/settings/admission-policy-wizard.tsx");
  const policyDetail = read("components/settings/admission-policy-detail.tsx");
  const caseDetail = read("components/m1/admission-case-detail.tsx");
  const policyApi = read("lib/api/admission-policies.ts");
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
  assert.match(entry, /admissionPoliciesApi\.list/);
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
  assert.match(directWizard, /Admit another student/);
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
  assert.match(queues, /Completed/);
  assert.match(queues, /More queues/);
  assert.match(queues, /query\.data\.total > query\.data\.limit/);
  assert.match(queues, /waitlistCapacity/);
  assert.match(queues, /canPromoteFromWaitlist/);
  assert.match(queues, /PROMOTE_FROM_WAITLIST/);
  assert.match(queues, /Return to review/);
  assert.match(queues, /ConfirmDialog/);
  assert.match(caseApi, /AdmissionCaseQueuePage/);
  assert.match(caseApi, /\/admissions\/cases/);
  assert.match(caseApi, /\/direct-admit/);
  assert.match(caseApi, /\/finalize/);
  assert.match(admissionsPage, /AdmissionCaseQueues/);
  assert.match(admissionsPage, /New admission/);
  assert.match(admissionsPage, /\/dashboard\/admissions\/applications/);
  assert.doesNotMatch(dashboardShell, /'\/dashboard\/admissions': 'students'/);
  assert.match(policyList, /Create Admission Policy/);
  assert.match(policyWizard, /Who Can Apply/);
  assert.match(policyWizard, /GRADE_11_12/);
  assert.match(policyApi, /listTemplates/);
  assert.match(policyApi, /\/admissions\/policies\/templates/);
  assert.match(policyWizard, /admissionPoliciesApi\.listTemplates/);
  assert.match(policyWizard, /templateId: selectedTemplateId/);
  assert.match(policyWizard, /queryClient\.setQueryData/);
  assert.match(policyWizard, /startDraftMutation\.isPending/);
  assert.match(policyWizard, /policyQuery\.data\?\.draftVersion\?\.id/);
  assert.doesNotMatch(
    policyWizard,
    /draftVersion\?\.id \?\? policyQuery\.data\?\.currentVersion/,
  );
  assert.doesNotMatch(policyWizard, /const POLICY_TEMPLATES/);
  assert.doesNotMatch(policyWizard, /pendingTemplateDocuments/);
  assert.doesNotMatch(policyWizard, /toDocumentKind\(label\)/);
  assert.match(caseDetail, /Date of birth \(BS\)/);
  assert.match(caseDetail, /Admission date \(BS\)/);
  assert.match(caseDetail, /toGregorianDateFromBs/);
  assert.doesNotMatch(caseDetail, /type="date"/);
  assert.doesNotMatch(caseDetail, /needs backend-supported correction/);
  assert.doesNotMatch(policyDetail, /Coming soon/);
  assert.doesNotMatch(policyDetail, /value="communication"/);
  assert.match(policyDetail, /admissionPoliciesApi\.archive/);
  assert.match(policyDetail, /reason: archiveReason\.trim\(\)/);
  assert.match(policyDetail, /Archive admission policy\?/);
  assert.match(policyDetail, /ConfirmDialog/);
  assert.match(policyDetail, /policy\.status !== 'ARCHIVED'/);
  assert.match(policyDetail, /This policy is archived and read-only/);
  assert.match(policyApi, /ArchiveAdmissionPolicyPayload/);
  assert.match(policyApi, /json: payload/);
  assert.match(mobileRouter, /snapshotKey: 'admissions'/);
  assert.doesNotMatch(
    directWizard + reviewForm + caseApi,
    /publicUrl|objectKey/,
  );
});

test("M1 high-risk workflows remain server controlled and protected", () => {
  const duplicates = read("components/m1/duplicate-candidates-workspace.tsx");
  const confirmDialog = read("components/ui/confirm-dialog.tsx");
  const documents = read("components/m1/student-documents-workspace.tsx");
  const qr = read("components/m1/qr-id-workspace.tsx");
  const qrCard = read("components/students/profile/student-qr-card.tsx");
  const studentsApi = read("lib/api/students.ts");
  const iemis = read("components/m1/iemis-readiness-workspace.tsx");
  const admissionCase = read("components/m1/admission-case-detail.tsx");

  assert.match(duplicates, /previewDuplicateStudentMerge/);
  assert.match(duplicates, /mergeDuplicateStudent/);
  assert.match(duplicates, /markDuplicateStudentPairNotDuplicate/);
  assert.match(duplicates, /reopenDuplicateStudentReview/);
  assert.match(duplicates, /Mark as separate students/);
  assert.match(duplicates, /Required · 5–500 characters/);
  assert.match(duplicates, /currentQueueData\?\.totalPages/);
  assert.match(duplicates, /pageNeedsCorrection/);
  assert.match(duplicates, /history: 'replace'/);
  assert.match(duplicates, /candidatesQuery\.isPlaceholderData/);
  assert.match(duplicates, /queueInteractionDisabled/);
  assert.match(duplicates, /selected\.blockedReason/);
  assert.match(duplicates, /Merge unavailable/);
  assert.match(duplicates, /name="duplicate-primary-record"/);
  assert.match(duplicates, /Merge record/);
  assert.match(duplicates, /Keep as primary/);
  assert.match(duplicates, /scrollIntoView/);
  assert.match(duplicates, /focus\(\{ preventScroll: true \}\)/);
  assert.match(duplicates, /preventCloseWhileConfirming/);
  assert.match(confirmDialog, /preventCloseWhileConfirming/);
  assert.match(confirmDialog, /showCloseButton=\{!closeLocked\}/);
  assert.match(confirmDialog, /disabled=\{closeLocked\}/);
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
  assert.match(qr, /getStudentQrWorkspaceSummary/);
  assert.match(qr, /student-qr-workspace-summary/);
  assert.match(qr, /summary\?\.activeCredentials/);
  assert.match(qr, /summary\?\.replacementFilesNeeded/);
  assert.match(qr, /summary\?\.inactiveCredentials/);
  assert.match(qr, /summary\?\.successfulScansToday/);
  assert.match(qr, /summary\.period\.bsDate/);
  assert.doesNotMatch(qr, /Print queue API is not available/);
  assert.doesNotMatch(qr, /no aggregate endpoint/);
  assert.match(studentsApi, /'\/students\/qr\/summary'/);
  assert.match(qrCard, /student-qr-workspace-summary/);
  assert.match(
    qrCard,
    /\[['"]students['"],\s*['"]qr-workspace['"]\]/,
  );
  assert.match(qrCard, /ConfirmDialog/);
  assert.match(qrCard, /Rotate student QR credential\?/);
  assert.match(qrCard, /Revoke student QR credential\?/);
  assert.match(qrCard, /preventCloseWhileConfirming/);
  assert.match(qrCard, /STUDENT_QR_REASON_MIN_LENGTH/);
  assert.match(qrCard, /STUDENT_QR_REASON_MAX_LENGTH/);
  assert.match(qrCard, /qrStatusQuery\.data !== undefined/);
  assert.match(qrCard, /\?\s+qrStatusQuery\.data\.activeCredential/);
  assert.match(iemis, /CSV Import History/);
  assert.match(iemis, /Import Review Queue/);
  assert.match(iemis, /Validate admission CSV/);
  assert.match(iemis, /dryRun: true/);
  assert.match(iemis, /validationBatchId: pending\.preview\.batchId/);
  assert.match(iemis, /ConfirmDialog/);
  assert.match(iemis, /canImportAdmissions/);
  assert.match(iemis, /No student records were created/);
  assert.match(iemis, /transferFailureMessage/);
  assert.match(iemis, /ApiRequestError/);
  assert.match(iemis, /The selected CSV was not accepted/);
  assert.doesNotMatch(iemis, /error instanceof Error\s*\?\s*error\.message/);
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
  assert.match(
    admissionCase,
    /import { ConfirmDialog } from "..\/ui\/confirm-dialog"/,
  );
  assert.match(admissionCase, /variant="destructive"/);
  assert.match(admissionCase, /rejectDialogOpen/);
  assert.match(admissionCase, /<ConfirmDialog/);
  assert.match(admissionCase, /Do not admit this applicant\?/);
  assert.match(
    admissionCase,
    /confirmDisabled=\{rejectReason\.trim\(\)\.length < 5\}/,
  );
  assert.match(admissionCase, /reviewMutation\.mutate\(\{\s*action: "REJECT"/);
});

test("M1 student roster uses a focused backend summary, safe filters, and paginated roster contract", () => {
  const page = read("app/dashboard/students/page.tsx");
  const directory = read("components/forms/student-directory.tsx");

  assert.match(page, /api\.getStudentModuleSummary\(summaryFilters\)/);
  assert.match(page, /limit: STUDENT_ROSTER_PAGE_SIZE/);
  assert.match(directory, /summary\?\.missingDocuments/);
  assert.match(directory, /summary\?\.duplicateCandidates/);
  assert.match(directory, /summary\?\.iemisIssues/);
  assert.equal((directory.match(/<SummaryCard/g) ?? []).length, 4);
  assert.match(directory, /summaryUnavailable \? 'Unavailable'/);
  assert.doesNotMatch(directory, /title="Pending Applications"/);
  assert.doesNotMatch(directory, /title="QR Active"/);
  assert.match(directory, /value: 'ACTIVE', label: 'Active'/);
  assert.match(directory, /value: 'EXITED', label: 'Withdrawn'/);
  // Server pagination footer is the shared TablePagination component (not a
  // second hand-rolled Previous/Next implementation).
  assert.match(directory, /from '\.\.\/ui\/table-pagination'/);
  assert.match(directory, /<TablePagination/);
  assert.match(directory, /onPageChange=\{\(page\) =>/);
  assert.match(directory, /value="ARCHIVED"/);
  assert.match(directory, /value="MERGED"/);
  assert.doesNotMatch(
    directory,
    /value="INACTIVE"|value="WITHDRAWN"|value="DEACTIVATED"|value="GRADUATED"/,
  );
});

test("M1 application queue keeps page-derived and decorative metrics out of the workspace", () => {
  const pipeline = read("components/admissions/admissions-pipeline.tsx");

  assert.doesNotMatch(pipeline, /<KpiGrid|<KpiCard/);
  assert.doesNotMatch(pipeline, /No update in 7 days|Admission workflow/);
  assert.match(pipeline, /matching applications/);
});

test("M1 Admissions overview shows a real, actionable, honest KPI grid", () => {
  const page = read("app/dashboard/admissions/page.tsx");

  // Counts come from each backend-filtered queue total, not from loaded rows.
  assert.match(page, /admissionCasesApi\.listQueues/);
  assert.match(page, /ADMISSION_SUMMARY_QUEUES/);
  assert.match(page, /\/dashboard\/admissions\/assessments/);
  assert.match(page, /Needs Information/);
  assert.match(page, /Waiting for Review/);
  assert.match(page, /Ready to Admit/);
  assert.match(page, /Duplicate Warnings/);

  // Honest states: real backend zero remains 0 while a missing/failed response
  // stays unavailable and loading uses the shared shadcn Skeleton.
  assert.match(page, /\?\.data\?\.total \?\? "Unavailable"/);
  assert.match(page, /loading=\{summaryQuery/);
  assert.doesNotMatch(page, /\.items\.length/);

  // Every card opens its real server-filtered queue.
  for (const queue of [
    "NEEDS_INFORMATION",
    "WAITING_FOR_REVIEW",
    "READY_TO_ADMIT",
    "DUPLICATE_WARNINGS",
  ]) {
    assert.match(
      page,
      new RegExp(`href="/dashboard/admissions\\?queue=${queue}"`),
    );
  }
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
  const reviewWorkspace = read(
    "components/m1/application-review-workspace.tsx",
  );

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
  assert.match(reviewWorkspace, /action === "REJECT"\s*\n\s*\? "destructive"/);

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
