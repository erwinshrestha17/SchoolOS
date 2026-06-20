import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function readMany(relativePaths) {
  return relativePaths.map((relativePath) => read(relativePath)).join("\n");
}

function sourceFiles(relativeDir) {
  const root = join(webRoot, relativeDir);
  const entries = readdirSync(root);
  const files = [];

  for (const entry of entries) {
    const absolute = join(root, entry);
    const relative = join(relativeDir, entry);

    if (entry === ".next" || entry === "node_modules") {
      continue;
    }

    if (statSync(absolute).isDirectory()) {
      files.push(...sourceFiles(relative));
      continue;
    }

    if (/\.(tsx?|mjs)$/.test(entry)) {
      files.push(relative);
    }
  }

  return files;
}

describe("SchoolOS web production contracts", () => {
  it("uses a real test command instead of the placeholder script", () => {
    const packageJson = JSON.parse(read("package.json"));

    assert.equal(packageJson.scripts.test, "node --test test/*.test.mjs");
  });

  it("defaults frontend API traffic to the Nest API on port 4000", () => {
    const apiClient = read("lib/api/client.ts");

    assert.match(apiClient, /http:\/\/localhost:4000\/api\/v1/);
    assert.doesNotMatch(apiClient, /http:\/\/localhost:3000\/api\/v1/);
  });

  it("implements the shared UI primitives named by the UI/UX plan", () => {
    const requiredComponents = [
      "action-menu",
      "audit-info",
      "confirm-dialog",
      "data-table",
      "empty-state",
      "error-state",
      "export-button",
      "filter-bar",
      "loading-state",
      "locked-record-banner",
      "money-display",
      "module-locked-state",
      "notification-badge",
      "page-header",
      "permission-state",
      "protected-file",
      "report-toolbar",
      "search-input",
      "section-card",
      "stat-card",
      "status-badge",
      "table-pagination",
      "tabs",
      "toast",
    ];

    for (const component of requiredComponents) {
      assert.equal(
        existsSync(join(webRoot, `components/ui/${component}.tsx`)),
        true,
        `Missing shared UI primitive: ${component}`,
      );
    }

    const statusBadge = read("components/ui/status-badge.tsx");
    for (const status of [
      "ACTIVE",
      "PENDING",
      "DRAFT",
      "PUBLISHED",
      "LOCKED",
      "PAID",
      "PARTIAL",
      "UNPAID",
      "OVERDUE",
      "ESCALATED",
    ]) {
      assert.match(statusBadge, new RegExp(status));
    }

    const moneyDisplay = read("components/ui/money-display.tsx");
    assert.match(moneyDisplay, /currency:\s*'NPR'/);

    const dataTable = read("components/ui/data-table.tsx");
    assert.match(dataTable, /isLoading/);
    assert.match(dataTable, /error/);
    assert.match(dataTable, /EmptyState/);
    assert.match(dataTable, /getRowKey/);

    const sharedPrimitives = readMany([
      "components/ui/action-menu.tsx",
      "components/ui/approval-timeline.tsx",
      "components/ui/avatar.tsx",
      "components/ui/badge.tsx",
      "components/ui/button.tsx",
      "components/ui/checkbox.tsx",
      "components/ui/confirm-dialog.tsx",
      "components/ui/dialog.tsx",
      "components/ui/file-uploader.tsx",
      "components/ui/filter-bar.tsx",
      "components/ui/error-state.tsx",
      "components/ui/input.tsx",
      "components/ui/loading-state.tsx",
      "components/ui/module-locked-state.tsx",
      "components/ui/page-state.tsx",
      "components/ui/protected-file.tsx",
      "components/ui/qr-resolver.tsx",
      "components/ui/search-input.tsx",
      "components/ui/select.tsx",
      "components/ui/stat-card.tsx",
      "components/ui/status-badge.tsx",
      "components/ui/textarea.tsx",
    ]);

    assert.match(sharedPrimitives, /Loader2/);
    assert.match(sharedPrimitives, /ProtectedFileButton/);
    assert.match(sharedPrimitives, /ProtectedFileLink/);
    assert.match(sharedPrimitives, /openProtectedFile/);
    assert.match(sharedPrimitives, /downloadProtectedFile/);
    assert.match(read("lib/api/client.ts"), /\/files\/\$\{encodeURIComponent\(fileAssetId\)\}\/preview/);
    assert.match(read("lib/api/client.ts"), /\/files\/\$\{encodeURIComponent\(fileAssetId\)\}\/download/);
    assert.match(sharedPrimitives, /bg-\[var\(--primary\)\]/);
    assert.match(sharedPrimitives, /bg-\[var\(--primary-soft\)\]/);
    assert.match(sharedPrimitives, /text-\[var\(--primary-dark\)\]/);
    assert.match(
      sharedPrimitives,
      /bg-\[linear-gradient\(135deg,var\(--primary\),var\(--primary-dark\)\)\]/,
    );
    assert.match(sharedPrimitives, /focus:border-\[var\(--primary\)\]/);
    assert.match(sharedPrimitives, /focus:ring-\[var\(--primary-soft\)\]/);
    assert.match(sharedPrimitives, /border-t-\[var\(--primary\)\]/);
    assert.match(
      sharedPrimitives,
      /peer-focus-visible:ring-\[var\(--primary-soft\)\]/,
    );
    assert.doesNotMatch(
      sharedPrimitives,
      /<svg|rounded-\[(?:2rem|28px)\]|rounded-3xl|shadow-xl|shadow-2xl|bg-slate-900|bg-slate-950|focus:border-primary|focus:ring-primary|border-primary|bg-primary|text-primary|from-primary|to-primary|hidden"/,
    );
  });

  it("keeps operator feedback inside the app UI instead of browser-native prompts", () => {
    const files = [...sourceFiles("app"), ...sourceFiles("components")];

    for (const file of files) {
      assert.doesNotMatch(
        read(file),
        /\b(?:window\.)?(alert|confirm)\s*\(/,
        `${file} should use Toast, ConfirmDialog, or inline status UI instead of alert/confirm`,
      );
    }
  });

  it("keeps the shared student selector tokenized for reused dashboard workflows", () => {
    const selector = read("components/students/student-selector.tsx");

    assert.match(selector, /focus:border-\[var\(--primary\)\]/);
    assert.match(selector, /focus:ring-\[var\(--primary-soft\)\]/);
    assert.match(selector, /bg-\[var\(--primary-soft\)\]/);
    assert.match(selector, /text-\[var\(--primary-dark\)\]/);
    assert.doesNotMatch(
      selector,
      /primary-(50|100|200|300|400|500|600|700|800|900)|shadow-xl|shadow-2xl|bg-slate-900|bg-slate-950|rounded-3xl|rounded-\[/,
    );
  });

  it("keeps homework creation controls on the shared design tokens", () => {
    const form = read("components/homework/homework-create-form.tsx");

    assert.match(form, /text-\[var\(--primary\)\]/);
    assert.match(form, /focus:ring-\[var\(--primary-soft\)\]/);
    assert.match(form, /api\.createHomework/);
    assert.match(form, /api\.assignHomework/);
    assert.match(form, /api\.listAcademicYears/);
    assert.match(form, /api\.listClasses/);
    assert.match(form, /api\.listSections/);
    assert.match(form, /api\.listSubjects/);
    assert.match(form, /dueDate,/);
    assert.match(form, /dueAt: dueDate/);
    assert.match(form, /submissionRequired: formData\.submissionRequired/);
    assert.match(form, /saveAsTemplate: formData\.saveAsTemplate/);
    assert.match(form, /templateName: formData\.saveAsTemplate/);
    assert.match(form, /recurrence: formData\.recurrenceEnabled/);
    assert.match(form, /recurrenceFrequency/);
    assert.match(form, /Promise\.all\(created\.items\.map/);
    assert.match(form, /createMutation\.mutate\(\{ publish \}\)/);
    assert.doesNotMatch(form, /isSubmissionRequired/);
    assert.doesNotMatch(form, /status: publish/);
    assert.doesNotMatch(
      form,
      /text-primary-(50|100|200|300|400|500|600|700|800|900)|focus:ring-primary-(50|100|200|300|400|500|600|700|800|900)|shadow-xl|shadow-2xl|bg-slate-900|bg-slate-950|rounded-3xl|rounded-\[/,
    );
  });

  it("keeps the W4A homework workspace route-backed and real API backed", () => {
    const page = read("app/dashboard/homework/page.tsx");
    const academicsApi = read("lib/api/academics.ts");
    const workloadRoute = read("app/dashboard/timetable/workload/page.tsx");

    assert.match(page, /ModuleHeader/);
    assert.match(page, /KpiGrid/);
    assert.match(page, /ModuleTabs/);
    assert.match(page, /api\.listHomeworkTemplates/);
    assert.match(page, /api\.listHomeworkReminderBatches/);
    assert.match(page, /api\.getHomeworkCompletionReport/);
    assert.match(page, /api\.getHomeworkMissingLateReport/);
    assert.match(page, /\/dashboard\/timetable\/workload/);
    assert.match(page, /\/dashboard\/timetable\/conflicts/);
    assert.match(page, /\/dashboard\/timetable\/versions/);
    assert.match(workloadRoute, /initialSection="Teacher Workload"/);
    assert.match(academicsApi, /\/homework\/\$\{encodeURIComponent\(id\)\}\/publish/);
    assert.match(academicsApi, /openProtectedFile\(access\.fileAssetId/);
    assert.doesNotMatch(academicsApi, /\/homework\/\$\{encodeURIComponent\(id\)\}\/assign/);
    assert.doesNotMatch(page, /window\.open|signedUrl|objectKey|bucket/);
  });

  it("keeps the staff self-service profile shell tokenized and API-backed", () => {
    const staffDashboard = read("components/staff/staff-dashboard.tsx");

    assert.match(staffDashboard, /api\.getMyProfile/);
    assert.match(staffDashboard, /useSession/);
    assert.match(staffDashboard, /maskStaffBankAccount/);
    assert.match(staffDashboard, /Account \(masked\)/);
    assert.doesNotMatch(staffDashboard, /Account:<\/span> \{profile\.bankAccount/);
    assert.match(staffDashboard, /bg-\[var\(--primary-soft\)\]/);
    assert.match(staffDashboard, /text-\[var\(--primary-dark\)\]/);
    assert.match(staffDashboard, /text-\[var\(--primary\)\]/);
    assert.doesNotMatch(
      staffDashboard,
      /primary-(50|100|200|300|400|500|600|700|800|900)|bg-primary\/10|text-primary\b|shadow-xl|shadow-2xl|bg-slate-900|bg-slate-950|rounded-3xl|rounded-\[/,
    );
  });

  it("keeps the student profile panel tokenized and connected to real student context", () => {
    const panel = read("components/forms/student-profile-panel.tsx");

    assert.match(panel, /StudentProfilePanelProps/);
    assert.match(panel, /student:\s*StudentProfile/);
    assert.match(panel, /onOpenPdf\(student\.id, kind\)/);
    assert.match(panel, /href="\/dashboard\/finance"/);
    assert.match(panel, /bg-\[var\(--primary-soft\)\]/);
    assert.match(panel, /text-\[var\(--primary-dark\)\]/);
    assert.doesNotMatch(
      panel,
      /primary-(50|100|200|300|400|500|600|700|800|900)|bg-primary\/10|text-primary\b|shadow-xl|shadow-2xl|bg-slate-900|bg-slate-950|rounded-3xl|rounded-\[/,
    );
  });

  it("keeps dashboard module tabs lightweight and route-aware", () => {
    const moduleTabs = read("components/dashboard/module-tabs.tsx");

    assert.match(moduleTabs, /usePathname/);
    assert.match(moduleTabs, /pathname === item\.href/);
    assert.match(moduleTabs, /pathname\?\.startsWith\(item\.href\)/);
    assert.match(moduleTabs, /item\.count !== undefined && item\.count > 0/);
    assert.match(
      moduleTabs,
      /bg-slate-700 text-white shadow-md border-slate-700/,
    );
    assert.doesNotMatch(
      moduleTabs,
      /bg-slate-800|bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|rounded-3xl|rounded-\[/,
    );
  });

  it("keeps Phase 1 and Phase 2 admin dashboard routes present", () => {
    const requiredRoutes = [
      "admissions",
      "attendance",
      "fees",
      "finance",
      "activity",
      "notices",
      "academics",
      "timetable",
      "homework",
      "hr",
      "payroll",
      "accounting",
      "messaging",
      "messages",
      "settings",
    ];

    for (const route of requiredRoutes) {
      assert.equal(
        existsSync(join(webRoot, `app/dashboard/${route}/page.tsx`)),
        true,
        `Missing dashboard route: ${route}`,
      );
    }
  });

  it("keeps W4 operational routes behind matching module entitlement gates", () => {
    const dashboardLayout = read("app/dashboard/layout.tsx");
    const sidebar = read("components/layout/sidebar.tsx");

    for (const source of [dashboardLayout, sidebar]) {
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/timetable'\)\) return 'timetable'/,
      );
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/hr'\)\) return 'hr'/,
      );
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/payroll'\)\) return 'hr'/,
      );
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/library'\)\) return 'library'/,
      );
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/transport'\)\) return 'transport'/,
      );
      assert.match(
        source,
        /href\.startsWith\('\/dashboard\/canteen'\)\) return 'canteen'/,
      );
    }
  });

  it("exposes client helpers for canonical Phase 1 and Phase 2 workflows", () => {
    const apiClient = readMany([
      "lib/api/client.ts",
      "lib/api/auth.ts",
      "lib/api/academics.ts",
      "lib/api/students.ts",
      "lib/api/attendance.ts",
      "lib/api/finance.ts",
      "lib/api/accounting.ts",
      "lib/api/payroll.ts",
      "lib/api/communications.ts",
      "lib/api/messaging.ts",
      "lib/api/activity.ts",
      "lib/api/platform.ts",
    ]);
    const requiredHelpers = [
      "checkAdmissionDuplicates",
      "bulkImportAdmissions",
      "openStudentDocumentPdf",
      "getStudentProfile",
      "getInvoiceDetail",
      "getStudentFeeLedger",
      "refundPayment",
      "previewCashierClose",
      "listCashierCloses",
      "finalizeCashierClose",
      "getAttendanceRoster",
      "syncAttendance",
      "reviewAttendanceConflict",
      "sendDefaulterReminders",
      "openReceiptPdf",
      "listLedgerEntries",
      "createActivityReaction",
      "createDevelopmentalMilestone",
      "getGuardianConsentStatus",
      "createSubject",
      "createExamTerm",
      "enterMark",
      "generateReportCard",
      "createTimetableSlot",
      "listTimetablePeriods",
      "createTimetablePeriod",
      "listRooms",
      "createRoom",
      "listTimetableVersions",
      "createTimetableVersion",
      "validateTimetableVersion",
      "publishTimetableVersion",
      "lockTimetableVersion",
      "archiveTimetableVersion",
      "listTeacherAvailability",
      "createTeacherAvailability",
      "listSubstitutions",
      "createSubstitution",
      "assignSubstitution",
      "createHomework",
      "publishHomework",
      "assignHomework",
      "listHomeworkTemplates",
      "closeHomework",
      "previewHomeworkReminders",
      "sendHomeworkReminders",
      "listHomeworkReminderBatches",
      "retryHomeworkReminderBatch",
      "getHomeworkCompletionReport",
      "getHomeworkMissingLateReport",
      "getHomeworkAttachmentPreviewUrl",
      "getHomeworkAttachmentDownloadUrl",
      "openHomeworkAttachmentPreview",
      "openHomeworkAttachmentDownload",
      "listHomeworkAssignmentSubmissions",
      "reviewHomeworkSubmissionById",
      "requestHomeworkCorrection",
      "reviewHomeworkSubmission",
      "createStaffContract",
      "createPayrollRun",
      "postPayrollRun",
      "getPayrollPreview",
      "listAccountingReports",
      "createConversation",
      "createMessage",
      "markMessageRead",
      "listStaffHistory",
      "listStaffAttendanceSummary",
      "listLeaveRequests",
      "approveLeaveRequest",
      "rejectLeaveRequest",
      "listStaffLeaveBalances",
      "listPlatformTenants",
      "getPlatformTenantDetail",
      "updatePlatformTenantStatus",
      "getTenantSettings",
      "getPublicTenantSettings",
      "updateTenantSetting",
      "uploadSchoolLogo",
      "getSchoolLogoPreview",
      "getSchoolLogoDownload",
      "removeSchoolLogo",
    ];

    for (const helper of requiredHelpers) {
      assert.match(
        apiClient,
        new RegExp(`${helper}:`),
        `Missing API helper: ${helper}`,
      );
    }
  });

  it("exposes Phase 2B homework and timetable workflow controls without fake production data", () => {
    const timetableBuilder = read(
      "components/timetable/tabs/timetable-builder-tab.tsx",
    );
    const homeworkTab = read("components/timetable/tabs/homework-tab.tsx");
    const homeworkPage = read("app/dashboard/homework/page.tsx");
    const homeworkDetailPage = read(
      "components/homework/homework-detail-page.tsx",
    );
    const homeworkReviewModal = read(
      "components/homework/homework-review-modal.tsx",
    );
    const studentHomeworkTab = read(
      "components/timetable/tabs/student-homework-tab.tsx",
    );
    const teacherWorkloadTab = read(
      "components/timetable/tabs/teacher-workload-tab.tsx",
    );
    const weeklyRequirementsList = read(
      "components/timetable/weekly-requirements-list.tsx",
    );
    const activityForm = read("components/forms/activity-feed-form.tsx");

    for (const label of [
      "Periods",
      "Rooms",
      "Validate",
      "Publish",
      "Lock",
      "Archive",
      "Substitution Management",
    ]) {
      assert.match(timetableBuilder, new RegExp(label));
    }

    for (const label of ["Send Reminder", "Assign", "Close", "All Statuses"]) {
      assert.match(homeworkTab, new RegExp(label));
    }
    assert.match(
      homeworkTab,
      /onSave=\{\(data\) => createHomeworkMutation\.mutate\(data\)\}/,
    );
    assert.match(homeworkTab, /onSave\(\{/);
    assert.match(homeworkTab, /bg-black\/40/);
    assert.doesNotMatch(
      homeworkTab,
      /bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|rounded-3xl|rounded-\[/,
    );
    assert.doesNotMatch(homeworkPage, /\/edit/);
    assert.doesNotMatch(homeworkDetailPage, /Edit Assignment/);
    assert.match(
      homeworkReviewModal,
      /Teacher feedback is required before requesting a correction/,
    );

    assert.match(studentHomeworkTab, /openHomeworkAttachmentDownload/);
    assert.match(studentHomeworkTab, /student-homework-attachment-download/);
    assert.match(homeworkDetailPage, /openHomeworkAttachmentPreview/);
    assert.match(homeworkReviewModal, /openHomeworkAttachmentPreview/);
    assert.doesNotMatch(homeworkDetailPage, /getFileView\(attachment\.fileAssetId\)/);
    assert.doesNotMatch(homeworkReviewModal, /getFileView\(attachment\.fileAssetId\)/);
    assert.doesNotMatch(studentHomeworkTab, /fileAsset\?\.publicUrl/);
    assert.doesNotMatch(activityForm, /Private object key/);
    assert.doesNotMatch(activityForm, /Photo Reference/);
    assert.match(teacherWorkloadTab, /teacher-workload-distribution/);
    assert.match(teacherWorkloadTab, /workloadDistribution/);
    assert.match(teacherWorkloadTab, /Bars use live timetable workload totals/);
    assert.doesNotMatch(teacherWorkloadTab, /Coming soon/);
    assert.match(weeklyRequirementsList, /createSubjectWeeklyRequirement/);
    assert.match(weeklyRequirementsList, /updateSubjectWeeklyRequirement/);
    assert.match(weeklyRequirementsList, /deleteSubjectWeeklyRequirement/);
    assert.match(weeklyRequirementsList, /Required periods must be at least 1/);
    assert.doesNotMatch(weeklyRequirementsList, /window\.confirm|alert\(/);

    assert.doesNotMatch(
      `${timetableBuilder}\n${homeworkTab}\n${homeworkPage}\n${homeworkDetailPage}\n${homeworkReviewModal}\n${studentHomeworkTab}\n${teacherWorkloadTab}\n${weeklyRequirementsList}\n${activityForm}`,
      /demo-|fake-|placeholderId/i,
    );
  });

  it("keeps timetable dashboard summary cards backend-backed", () => {
    const timetablePage = read("app/dashboard/timetable/page.tsx");

    assert.match(timetablePage, /validateTimetableVersion/);
    assert.match(timetablePage, /listSubstitutions/);
    assert.match(timetablePage, /timetable-validation-summary/);
    assert.match(timetablePage, /timetable-substitutions-summary/);
    assert.match(timetablePage, /validationQuery\.data\.errors\.length/);
    assert.match(timetablePage, /substitutionStatsQuery\.data\?\.length/);
    assert.doesNotMatch(
      timetablePage,
      /title:\s*'Conflicts'[\s\S]*?value:\s*0/,
    );
    assert.doesNotMatch(
      timetablePage,
      /title:\s*'Substitutions'[\s\S]*?value:\s*0/,
    );
  });

  it("uses in-app feedback for timetable, report export, and accounting safety actions", () => {
    const polishedSurfaces = readMany([
      "components/timetable/versions-list.tsx",
      "components/timetable/substitutions-list.tsx",
      "app/dashboard/reports/page.tsx",
      "components/accounting/accounting-dashboard-view.tsx",
      "components/accounting/chart-of-accounts-view.tsx",
      "components/accounting/journal-entries-view.tsx",
      "components/accounting/journal-detail-dialog.tsx",
    ]);
    const accountingTokenSurfaces = readMany([
      "components/accounting/accounting-dashboard-view.tsx",
      "components/accounting/accounting-reports-view.tsx",
      "components/accounting/bank-reconciliation-workspace.tsx",
      "components/accounting/chart-of-accounts-view.tsx",
      "components/accounting/fiscal-management-view.tsx",
      "components/accounting/fiscal-year-close-dialog.tsx",
      "components/accounting/journal-detail-dialog.tsx",
      "components/accounting/journal-entry-dialog.tsx",
      "components/accounting/journal-entries-view.tsx",
      "components/accounting/opening-balance-dialog.tsx",
      "components/accounting/report-table.tsx",
      "components/accounting/voucher-dialog.tsx",
    ]);
    const accountingAuditSurface = read(
      "components/accounting/accounting-audit-workspace.tsx",
    );

    for (const marker of [
      "Toast",
      "Version published",
      "Export ready",
      "Record Absence",
      "timetable-substitution-slots",
      "api.listTimetable",
      "mode={selectedSub ? 'assign' : 'create'}",
      "Select a class before recording an absence",
      "Seed default chart accounts?",
      "Cancel substitution?",
      "Open fiscal year required",
      "Active fiscal period required",
      "Posting failed",
      "Reversal failed",
      "Correction failed",
      "accounting-source-drilldown",
      "buildSourceDrilldown",
      "Open source record",
      "Source route unavailable",
      "/dashboard/finance?invoiceId=",
      "/dashboard/canteen/pos?saleId=",
      "/dashboard/library?fineId=",
      "/dashboard/hr/payroll?runId=",
    ]) {
      assert.ok(polishedSurfaces.includes(marker), `Missing marker: ${marker}`);
    }

    assert.doesNotMatch(polishedSurfaces, /alert\(/);
    assert.doesNotMatch(polishedSurfaces, /window\.confirm|confirm\(/);
    assert.match(accountingTokenSurfaces, /color-mod-accounting-accent/);
    assert.doesNotMatch(
      accountingTokenSurfaces,
      /bg-slate-900|bg-slate-950|bg-indigo-500|primary-(50|100|200|500|600|700|800|900)|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl/,
    );
    assert.doesNotMatch(accountingTokenSurfaces, /Generated \{new Date\(\)/);
    assert.doesNotMatch(accountingAuditSurface, /N\/A|SYSTEM/);
    assert.match(accountingAuditSurface, /Resource ID not recorded/);
    assert.match(accountingAuditSurface, /Tenant scope not recorded/);
  });

  it("keeps report export retry wired through the backend snapshot route", () => {
    const reportsPage = read("app/dashboard/reports/page.tsx");
    const financeApi = read("lib/api/finance.ts");

    assert.match(financeApi, /retryReportSnapshot/);
    assert.match(
      financeApi,
      /\/reports\/export-history\/\$\{encodeURIComponent\(id\)\}\/retry/,
    );
    assert.match(financeApi, /method:\s*'POST'/);

    for (const marker of [
      "handleRetrySnapshot",
      "api.retryReportSnapshot(snapshot.id)",
      "retryingSnapshotId",
      "Export retry queued",
      "Retry failed",
      "canRetrySnapshot",
      "Retry",
    ]) {
      assert.ok(reportsPage.includes(marker), `Missing marker: ${marker}`);
    }

    assert.match(reportsPage, /snapshot\.status === 'FAILED'/);
    assert.match(reportsPage, /snapshot\.status === 'CANCELLED'/);
    assert.match(
      reportsPage,
      /invalidateQueries\(\{\s*queryKey:\s*\['report-snapshots'\]/,
    );
  });

  it("keeps platform administration routes present and secure", () => {
    const platformRoutes = ["dashboard", "schools", "demo-requests"];

    for (const route of platformRoutes) {
      assert.equal(
        existsSync(join(webRoot, `app/platform/${route}/page.tsx`)),
        true,
        `Missing platform route: ${route}`,
      );
    }

    const layout = read("app/platform/layout.tsx");
    assert.match(
      layout,
      /platform_super_admin|platform_support|platform_billing_admin/,
    );
    assert.match(layout, /router\.push\('\/dashboard'\)/);
  });

  it("does not keep raw demo replacement IDs in production-facing forms", () => {
    const formFiles = [
      "components/forms/admission-form.tsx",
      "components/forms/attendance-form.tsx",
      "components/forms/finance-form.tsx",
      "components/forms/activity-feed-form.tsx",
      "components/forms/communications-form.tsx",
      "components/forms/academics-form.tsx",
      "components/forms/timetable-homework-form.tsx",
      "components/forms/payroll-form.tsx",
      "components/forms/accounting-form.tsx",
      "components/forms/messaging-form.tsx",
    ];

    for (const formFile of formFiles) {
      assert.doesNotMatch(
        read(formFile),
        /replace-me/i,
        `${formFile} has a raw replacement ID`,
      );
    }
  });

  it("centralizes browser session storage access in lib/session", () => {
    const files = sourceFiles(".");

    for (const file of files) {
      if (file === "lib/session.ts" || file.startsWith("test/")) {
        continue;
      }

      assert.doesNotMatch(
        read(file),
        /localStorage|sessionStorage/,
        `${file} touches browser storage directly`,
      );
    }
  });

  it("stores only metadata in browser session state", () => {
    const sessionModule = read("lib/session.ts");

    assert.match(sessionModule, /Omit<AuthSession, 'accessToken'>/);
    assert.match(sessionModule, /toBrowserSession/);
    assert.doesNotMatch(
      sessionModule,
      /JSON\.stringify\(session\)/,
      "raw AuthSession must not be persisted",
    );
  });

  it("parses API JSON error messages before surfacing them to forms", () => {
    const apiClient = read("lib/api/client.ts");

    assert.match(apiClient, /parseApiErrorMessage/);
    assert.match(apiClient, /JSON\.parse\(text\)/);
    assert.match(apiClient, /payload\.message/);
    assert.doesNotMatch(
      apiClient,
      /throw new Error\(text \|\| `Request failed/,
    );
  });

  it("submits public demo requests through the backend API instead of a local placeholder flow", () => {
    const requestDemoForm = read("components/forms/request-demo-form.tsx");
    const marketingApi = read("lib/api/marketing.ts");
    const apiIndex = read("lib/api.ts");

    assert.match(requestDemoForm, /api\.submitDemoRequest/);
    assert.match(requestDemoForm, /Demo request submitted\./);
    assert.match(requestDemoForm, /submittedRequestId/);
    assert.match(requestDemoForm, /ChevronDown/);
    assert.doesNotMatch(requestDemoForm, /<svg/);
    assert.doesNotMatch(requestDemoForm, /console\.log/);
    assert.doesNotMatch(requestDemoForm, /setTimeout/);
    assert.doesNotMatch(requestDemoForm, /TODO/);

    assert.match(marketingApi, /\/demo-requests/);
    assert.match(marketingApi, /method:\s*'POST'/);
    assert.match(marketingApi, /auth:\s*false/);
    assert.match(apiIndex, /marketingApi/);
  });

  it("exposes platform demo request review APIs and operator workspace", () => {
    const platformApi = read("lib/api/platform.ts");
    const demoRequestsPage = read("app/platform/demo-requests/page.tsx");
    const platformShell = read("components/layout/platform-shell.tsx");

    assert.match(platformApi, /listPlatformDemoRequests/);
    assert.match(platformApi, /getPlatformDemoRequest/);
    assert.match(platformApi, /updatePlatformDemoRequestStatus/);
    assert.match(platformApi, /\/platform\/demo-requests/);
    assert.match(demoRequestsPage, /api\.listPlatformDemoRequests/);
    assert.match(demoRequestsPage, /api\.getPlatformDemoRequest/);
    assert.match(demoRequestsPage, /api\.updatePlatformDemoRequestStatus/);
    assert.match(demoRequestsPage, /internalNotes/);
    assert.match(platformShell, /\/platform\/demo-requests/);
    assert.match(platformShell, /platform:demo-requests:read/);
  });

  it("keeps the login entry page tokenized and security focused", () => {
    const loginPage = read("app/login/page.tsx");
    const loginForm = read("components/forms/login-form.tsx");

    for (const expected of [
      "LoginForm",
      "Staff & Admin Portal",
      "secure cookies",
      "school-level data isolation",
      "LockKeyhole",
      "ShieldCheck",
      "ClipboardCheck",
      "bg-[var(--primary)]",
      "text-[var(--primary)]",
    ]) {
      assert.match(
        loginPage,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }

    assert.doesNotMatch(
      loginPage,
      /<svg|bg-slate-950|primary-(50|100|200|500|600|700|800|900)|blur-3xl|fake|mock|Coming soon/,
    );
    assert.match(loginForm, /method="post"/);
  });

  it("uses cookie credentials instead of bearer tokens for browser API calls", () => {
    const apiClient = read("lib/api/client.ts");

    assert.match(apiClient, /credentials:\s*'include'/);
    assert.doesNotMatch(apiClient, /Authorization:\s*`Bearer/);
    assert.doesNotMatch(apiClient, /getAccessToken/);
  });

  it("uses secure browser randomness for API request IDs", () => {
    const apiClient = read("lib/api/client.ts");

    assert.match(apiClient, /crypto\?\.randomUUID/);
    assert.match(apiClient, /crypto\?\.getRandomValues/);
    assert.doesNotMatch(apiClient, /Math\.random/);
  });

  it("keeps Phase 1 pilot navigation permission-gated and prominent", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const requiredPhaseOneLabels = [
      "Students",
      "Admissions",
      "Attendance",
      "Fees",
      "Activity Feed",
      "Notices",
      "Settings",
    ];

    assert.match(sidebar, /export const dashboardNavGroups/);
    assert.match(sidebar, /visibleGroups = dashboardNavGroups/);
    assert.match(sidebar, /visiblePlatformItems = platformNavItems\.filter/);
    assert.match(sidebar, /canSeeNavItem\(item, session\)/);
    assert.match(sidebar, /Platform Control/);

    for (const label of requiredPhaseOneLabels) {
      assert.match(sidebar, new RegExp(label.replace("/", "\\/")));
    }

    assert.match(sidebar, /href: '\/dashboard\/activity'/);
    assert.match(sidebar, /href: '\/dashboard\/messages'/);
    assert.match(sidebar, /href: '\/dashboard\/transport'/);
    assert.match(sidebar, /href: '\/dashboard\/canteen'/);
    assert.match(sidebar, /label: 'HR \/ Staff'/);
    assert.match(sidebar, /label: 'Payroll'/);
    assert.match(
      sidebar,
      /href: '\/dashboard\/transport'[\s\S]*label: 'Transport'/,
    );
    assert.match(
      sidebar,
      /href: '\/dashboard\/library'[\s\S]*label: 'Library'/,
    );
  });

  it("guards direct dashboard module URLs with role permissions", () => {
    const layout = read("app/dashboard/layout.tsx");
    const requiredRoutes = [
      "/dashboard/students",
      "/dashboard/admissions",
      "/dashboard/attendance",
      "/dashboard/finance",
      "/dashboard/activity",
      "/dashboard/notices",
      "/dashboard/academics",
      "/dashboard/homework",
      "/dashboard/timetable",
      "/dashboard/hr",
      "/dashboard/payroll",
      "/dashboard/accounting",
      "/dashboard/library",
      "/dashboard/transport",
      "/dashboard/canteen",
      "/dashboard/settings",
    ];

    assert.match(layout, /const dashboardRouteGates/);
    assert.match(layout, /getRouteGateForHref/);
    assert.match(layout, /hasAnyPermission\(session\.user\.permissions/);
    assert.match(layout, /<PermissionDenied/);

    for (const route of requiredRoutes) {
      assert.match(
        layout,
        new RegExp(`prefix: '${route.replaceAll("/", "\\/")}'`),
      );
    }
  });

  it("offers slow session recovery in the dashboard layout", () => {
    const layout = read("app/dashboard/layout.tsx");

    assert.match(layout, /showSlowSessionHelp/);
    assert.match(layout, /setTimeout\(\(\) =>/);
    assert.match(layout, /Retry session/);
    assert.match(layout, /void refreshSession\(\)/);
    assert.match(layout, /Sign in again/);
  });

  it("uses authenticated session metadata and real shell APIs in the header", () => {
    const header = read("components/layout/header.tsx");

    assert.match(
      header,
      /const \{.*hasPermissions.*session.*logout.*\} = useSession\(\)/,
    );
    assert.match(header, /session\?\.tenant\.name/);
    assert.match(header, /api\.listAcademicYears/);
    assert.match(header, /api\.listNotificationDeliveries/);
    assert.match(header, /void logout\(\)/);
    assert.doesNotMatch(header, /const unreadCount = 3/);
    assert.doesNotMatch(header, /2081-82|2080-81|2079-80/);
  });

  it("builds the admin dashboard from real Phase 1 APIs without fake KPI numbers", () => {
    const dashboard = read("app/dashboard/page.tsx");
    const requiredApis = [
      "api.listAcademicYears",
      "api.listClasses",
      "api.listFeePlans",
      "api.listStudents",
      "api.listAdmissions",
      "api.listAttendanceAnalytics",
      "api.listInvoices",
      "api.listDefaulters",
      "api.listReceipts",
      "api.listActivityPosts",
      "api.listNotices",
      "api.listNotificationDeliveries",
    ];

    for (const apiCall of requiredApis) {
      assert.match(dashboard, new RegExp(apiCall.replace(".", "\\.")));
    }

    assert.doesNotMatch(dashboard, /\b847\b/);
    assert.doesNotMatch(dashboard, /94\.2%/);
    assert.doesNotMatch(dashboard, /8,45,000|845000/);
    assert.doesNotMatch(dashboard, /Phase 2 Academic Cycle/);
  });

  it("keeps the dashboard shell polished and routes fee alerts to the canonical fees page", () => {
    const dashboard = read("app/dashboard/page.tsx");
    const shell = read("components/layout/dashboard-shell.tsx");
    const globals = read("app/globals.css");
    const layoutBasics = readMany([
      "components/layout/breadcrumbs.tsx",
      "components/layout/dashboard-shell.tsx",
      "components/layout/global-student-search.tsx",
      "components/layout/header.tsx",
      "components/layout/notification-bell.tsx",
      "components/layout/platform-shell.tsx",
      "components/layout/sidebar.tsx",
      "components/layout/upgrade-prompt.tsx",
    ]);
    const dashboardPrimitives = readMany([
      "components/dashboard/empty-state.tsx",
      "components/dashboard/error-state.tsx",
      "components/dashboard/filter-bar.tsx",
      "components/dashboard/loading-state.tsx",
      "components/dashboard/section-card.tsx",
      "components/dashboard/stat-card.tsx",
    ]);

    assert.match(shell, /Skip to workspace/);
    assert.match(shell, /SupportOverrideBanner/);
    assert.match(layoutBasics, /bg-\[var\(--primary\)\]/);
    assert.match(layoutBasics, /bg-\[var\(--primary-soft\)\]/);
    assert.match(layoutBasics, /text-\[var\(--primary-dark\)\]/);
    assert.match(layoutBasics, /focus:ring-\[var\(--primary-soft\)\]/);
    assert.match(layoutBasics, /bg-\[var\(--color-mod-platform-text\)\]/);
    assert.match(layoutBasics, /hover:text-\[var\(--primary\)\]/);
    assert.doesNotMatch(
      layoutBasics,
      /bg-slate-950|bg-slate-900|primary-(50|100|200|300|400|500|600|700|800|900)|shadow-xl|shadow-2xl|rounded-3xl/,
    );
    assert.match(dashboard, /DashboardHeroMetric/);
    assert.match(dashboard, /alertToneStyles/);
    assert.match(dashboard, /color-mod-dashboard-accent/);
    assert.match(dashboard, /color-mod-dashboard-border/);
    assert.match(dashboard, /color-mod-dashboard-bg/);
    assert.match(dashboard, /href: '\/dashboard\/fees'/);
    assert.doesNotMatch(dashboard, /href: '\/dashboard\/finance'/);
    assert.doesNotMatch(
      dashboard,
      /blur-3xl|bg-indigo-500|rounded-\[|shadow-xl|shadow-2xl|primary-(50|100|200|500|600|700|800|900)/,
    );
    assert.doesNotMatch(
      dashboardPrimitives,
      /rounded-\[2rem\]|bg-slate-950|shadow-xl|shadow-2xl/,
    );
    assert.match(globals, /\.tracking-tight\s*\{\s*letter-spacing: 0;/);
    assert.match(globals, /\.shell-card\s*\{[\s\S]*border-radius: 1rem;/);
  });

  it("keeps admin dashboard quick actions on existing Phase 1 routes", () => {
    const dashboard = read("app/dashboard/page.tsx");
    const requiredRoutes = [
      "/dashboard/admissions",
      "/dashboard/attendance",
      "/dashboard/fees",
      "/dashboard/activity",
      "/dashboard/notices",
      "/dashboard/settings",
    ];

    for (const route of requiredRoutes) {
      assert.match(dashboard, new RegExp(`href: '${route}'`));
    }
  });

  it("handles dashboard setup and empty-data states explicitly", () => {
    const dashboard = read("app/dashboard/page.tsx");

    assert.match(dashboard, /Setup needs attention/);
    assert.match(dashboard, /No alerts available yet/);
    assert.match(dashboard, /No recent operations yet/);
    assert.match(dashboard, /\?\? \[\]/);
  });

  it("keeps admissions enrollment as a multi-step pilot flow", () => {
    const admissionForm = read("components/forms/admission-form.tsx");
    const requiredSteps = [
      "Personal Info",
      "Academic Placement",
      "Guardian Contacts",
      "Documents & Review",
      "Success / Next Actions",
    ];

    assert.match(admissionForm, /const enrollmentSteps = \[/);

    for (const step of requiredSteps) {
      assert.match(admissionForm, new RegExp(step.replace("/", "\\/")));
    }
  });

  it("preserves admissions setup, duplicate warning, and create-anyway behavior", () => {
    const admissionForm = read("components/forms/admission-form.tsx");

    assert.match(admissionForm, /Setup required before enrollment/);
    assert.match(admissionForm, /api\.checkAdmissionDuplicates/);
    assert.match(
      admissionForm,
      /Possible duplicate found|Potential Duplicate Detected/,
    );
    assert.match(admissionForm, /Create anyway|Confirm & Enroll Anyway/);
    assert.match(admissionForm, /setupIsMissing/);
  });

  it("keeps guardian phone validation hints and document review in admissions", () => {
    const admissionForm = read("components/forms/admission-form.tsx");
    const coreValidation = read("../../packages/core/src/validation.ts");

    assert.match(
      coreValidation,
      /guardians: z\.array\(guardianSchema\)\.min\(1\)/,
    );
    assert.match(coreValidation, /primaryPhone: z\.string\(\)\.regex\(/);
    assert.match(admissionForm, /Document/);
    assert.match(admissionForm, /Review & Documents/);
    assert.match(admissionForm, /fileToBase64Payload/);
  });

  it("requires iEMIS disability confirmation in the admissions flow", () => {
    const admissionForm = read("components/forms/admission-form.tsx");
    const coreValidation = read("../../packages/core/src/validation.ts");

    assert.match(admissionForm, /iEMIS Disability Confirmation/);
    assert.match(admissionForm, /No known disability/);
    assert.match(admissionForm, /Special Support Needed/);
    assert.match(admissionForm, /confirmNoDisability/);
    assert.match(admissionForm, /disabilityFlag/);
    assert.match(admissionForm, /Confirmed for standard iEMIS reporting/);
    assert.match(coreValidation, /confirmNoDisability/);
    assert.match(
      coreValidation,
      /Confirm no known disability or enter disability\/support details/,
    );
  });

  it("keeps admissions bulk import and success next actions available", () => {
    const admissionForm = read("components/forms/admission-form.tsx");

    assert.match(admissionForm, /Bulk Import/);
    assert.match(admissionForm, /api\.bulkImportAdmissions/);
    assert.match(admissionForm, /csvContent: await file\.text\(\)/);
    assert.match(admissionForm, /dryRun/);
    assert.match(admissionForm, /confirmDuplicates/);
    assert.match(admissionForm, /Row review/);
    assert.match(admissionForm, /Possible duplicate records/);
    assert.match(admissionForm, /Import with duplicate confirmation/);
    assert.match(admissionForm, /confirmNoDisability/);
    assert.match(admissionForm, /Error report CSV/);
    assert.match(admissionForm, /Collect First Fee/);
    assert.match(admissionForm, /Download ID Card/);
    assert.match(admissionForm, /Add Another Student/);
  });

  it("adds a student directory workspace without removing admissions flows", () => {
    const admissionForm = read("components/forms/admission-form.tsx");
    const directory = read("components/forms/student-directory.tsx");

    assert.match(admissionForm, /Student Directory/);
    assert.match(admissionForm, /New Enrollment/);
    assert.match(admissionForm, /Bulk Import/);
    assert.match(admissionForm, /Recent Admissions/);
    assert.match(admissionForm, /href="\/dashboard\/students"/);
    assert.match(admissionForm, /activeWorkspaceTab.*enrollment/s);
    assert.match(directory, /Academic Year/);
    assert.match(directory, /Class/);
    assert.match(directory, /Section/);
    assert.match(directory, /Quick Search/);
    assert.match(directory, /Name or SCH-ID/);
  });

  it("keeps admissions workspace aligned to M1 UI tokens without fake labels", () => {
    const admissionsWorkspace = readMany([
      "components/forms/admission-form.tsx",
      "components/admissions/admissions-pipeline.tsx",
      "app/dashboard/admissions/page.tsx",
    ]);

    assert.match(admissionsWorkspace, /color-mod-admissions-accent/);
    assert.match(admissionsWorkspace, /Academic year not assigned/);
    assert.match(admissionsWorkspace, /Date of birth not entered/);
    assert.match(admissionsWorkspace, /Class not selected/);
    assert.match(admissionsWorkspace, /Guardian phone not entered/);
    assert.doesNotMatch(
      admissionsWorkspace,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700/,
    );
  });

  it("keeps the student directory on M1 tokens with real linked actions", () => {
    const studentDirectory = readMany([
      "lib/api/students.ts",
      "components/forms/student-directory.tsx",
      "app/dashboard/students/page.tsx",
    ]);

    assert.match(studentDirectory, /color-mod-admissions-accent/);
    assert.match(studentDirectory, /listIemisReadiness/);
    assert.match(studentDirectory, /\/students\/iemis\/validation/);
    assert.match(studentDirectory, /Class iEMIS Readiness/);
    assert.match(studentDirectory, /student-iemis-readiness-list/);
    assert.match(studentDirectory, /Fix Profile/);
    assert.match(studentDirectory, /onOpenPdf\(student\.id, 'id-card'\)/);
    assert.match(studentDirectory, /\/dashboard\/finance\?studentId=/);
    assert.match(
      studentDirectory,
      /\/dashboard\/students\/\$\{encodeURIComponent\(student\.id\)\}/,
    );
    assert.doesNotMatch(
      studentDirectory,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|primary-500|primary-50|primary-600|primary-700/,
    );
  });

  it("keeps student profile header and overview aligned to M1 tokens", () => {
    const studentProfileEntry = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/profile-header.tsx",
      "components/students/profile/tabs/overview-tab.tsx",
    ]);

    assert.match(studentProfileEntry, /color-mod-admissions-accent/);
    assert.match(studentProfileEntry, /Support note on file/);
    assert.match(studentProfileEntry, /api\.getStudentFeeClearance\(studentId\)/);
    assert.match(studentProfileEntry, /api\.getStudentAttendanceHistory\(studentId\)/);
    assert.match(studentProfileEntry, /api\.getIemisReadiness\(studentId\)/);
    assert.match(studentProfileEntry, /No profile issues need attention right now/);
    assert.match(studentProfileEntry, /Class not assigned/);
    assert.match(studentProfileEntry, /Section not assigned/);
    assert.match(
      studentProfileEntry,
      /api\.openStudentDocumentPdf\(studentId, kind, token\)/,
    );
    assert.doesNotMatch(studentProfileEntry, /No known disability/);
    assert.doesNotMatch(
      studentProfileEntry,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700/,
    );
  });

  it("keeps student QR identity controls tokenized and API-backed", () => {
    const studentQrCard = read(
      "components/students/profile/student-qr-card.tsx",
    );

    assert.match(studentQrCard, /api\.generateStudentQr\(studentId\)/);
    assert.match(
      studentQrCard,
      /api\.rotateStudentQr\(studentId, \{ reason: rotateReason \}\)/,
    );
    assert.match(
      studentQrCard,
      /api\.revokeStudentQr\(studentId, \{ reason: revokeReason \}\)/,
    );
    assert.match(studentQrCard, /color-mod-admissions-accent/);
    assert.match(studentQrCard, /Raw tokens are never stored/);
    assert.doesNotMatch(
      studentQrCard,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student lifecycle actions tokenized and clearance-backed", () => {
    const lifecycleSurface = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/lifecycle-panel.tsx",
    ]);

    assert.match(lifecycleSurface, /api\.getStudentFeeClearance\(studentId\)/);
    assert.match(lifecycleSurface, /api\.transferStudent\(studentId, body\)/);
    assert.match(lifecycleSurface, /api\.archiveStudent\(studentId, body\)/);
    assert.match(
      lifecycleSurface,
      /api\.archiveStudentAsAlumni\(studentId, body\)/,
    );
    assert.match(lifecycleSurface, /api\.softDeleteStudent\(studentId, body\)/);
    assert.match(lifecycleSurface, /color-mod-admissions-text/);
    assert.match(lifecycleSurface, /Outstanding fees must be resolved/);
    assert.match(lifecycleSurface, /Remove accidental record/);
    assert.doesNotMatch(lifecycleSurface, /waiveFeeClearance/);
    assert.doesNotMatch(
      lifecycleSurface,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student academics and attendance tabs tokenized and data-backed", () => {
    const readOnlyProfileTabs = readMany([
      "components/students/profile/tabs/academics-tab.tsx",
      "components/students/profile/tabs/attendance-tab.tsx",
    ]);

    assert.match(
      readOnlyProfileTabs,
      /api\.getStudentAttendanceHistory\(studentId\)/,
    );
    assert.match(
      readOnlyProfileTabs,
      /onClick=\{\(\) => onOpenPdf\(doc\.kind\)\}/,
    );
    assert.match(readOnlyProfileTabs, /color-mod-admissions-accent/);
    assert.doesNotMatch(
      readOnlyProfileTabs,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student fees and activity tabs tokenized and explicit", () => {
    const financeAndActivityTabs = readMany([
      "components/students/profile/tabs/fees-tab.tsx",
      "components/students/profile/tabs/activity-tab.tsx",
    ]);

    assert.match(
      financeAndActivityTabs,
      /href=\{`\/dashboard\/finance\?studentId=/,
    );
    assert.match(financeAndActivityTabs, /Invoice date not recorded/);
    assert.match(financeAndActivityTabs, /Publish date not recorded/);
    assert.match(financeAndActivityTabs, /color-mod-admissions-accent/);
    assert.doesNotMatch(
      financeAndActivityTabs,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student health and history tabs tokenized and explicit", () => {
    const healthAndHistoryTabs = readMany([
      "components/students/profile/tabs/health-tab.tsx",
      "components/students/profile/tabs/history-tab.tsx",
    ]);

    assert.match(healthAndHistoryTabs, /color-mod-admissions-accent/);
    assert.match(healthAndHistoryTabs, /History date not recorded/);
    assert.match(healthAndHistoryTabs, /No history events recorded/);
    assert.doesNotMatch(healthAndHistoryTabs, /Future:|basic example/);
    assert.doesNotMatch(
      healthAndHistoryTabs,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student guardians and documents tabs tokenized and protected", () => {
    const guardianAndDocumentTabs = readMany([
      "components/students/profile/tabs/guardians-tab.tsx",
      "components/students/profile/tabs/documents-tab.tsx",
    ]);

    assert.match(
      guardianAndDocumentTabs,
      /onSaveGuardian\(guardian\.id, body\)/,
    );
    assert.match(
      guardianAndDocumentTabs,
      /api\.downloadStudentDocument\(studentId, documentId\)/,
    );
    assert.match(
      guardianAndDocumentTabs,
      /api\.listStudentDocumentHistory\(studentId\)/,
    );
    assert.match(guardianAndDocumentTabs, /onOpenPdf\(kind\)/);
    assert.match(guardianAndDocumentTabs, /Ward not recorded/);
    assert.match(guardianAndDocumentTabs, /Audit date not recorded/);
    assert.match(guardianAndDocumentTabs, /color-mod-admissions-accent/);
    assert.doesNotMatch(
      guardianAndDocumentTabs,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps student profile and directory actions wired to real helpers", () => {
    const directory = read("components/forms/student-directory.tsx");
    const detailPage = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/tabs/documents-tab.tsx",
      "components/students/profile/tabs/fees-tab.tsx",
    ]);
    const studentsPage = read("app/dashboard/students/page.tsx");

    assert.match(directory, /Profile/);
    assert.match(
      directory,
      /href=\{`\/dashboard\/students\/\$\{encodeURIComponent\(student\.id\)\}`\}/,
    );
    assert.match(directory, /Fees/);
    assert.match(directory, /ID Card/);
    assert.match(studentsPage, /api\.openStudentDocumentPdf/);
    assert.match(detailPage, /api\.getStudentProfile/);
    assert.match(detailPage, /api\.openStudentDocumentPdf/);
    assert.match(detailPage, /Guardians/);
    assert.match(detailPage, /Documents/);
    assert.match(detailPage, /Fees/);
    assert.match(detailPage, /Attendance/);
    assert.match(detailPage, /Activity/);
    assert.match(detailPage, /History/);
  });

  it("adds the Phase 1B student detail route with tabbed profile sections", () => {
    const route = read("app/dashboard/students/[studentId]/page.tsx");
    const detailPage = read("components/students/student-detail-page.tsx");

    assert.equal(
      existsSync(join(webRoot, "app/dashboard/students/[studentId]/page.tsx")),
      true,
    );
    assert.match(route, /useParams/);
    assert.match(route, /<StudentDetailPage studentId=/);
    assert.match(detailPage, /const detailTabs = \[/);

    for (const tab of [
      "Overview",
      "Guardians",
      "Health",
      "Documents",
      "Fees",
      "Attendance",
      "Activity",
      "History",
    ]) {
      assert.match(detailPage, new RegExp(tab));
    }

    assert.doesNotMatch(detailPage, /replace-me|demo-student|student-123/i);
  });

  it("adds student and guardian edit workflows to the student detail page", () => {
    const detailPage = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/student-edit-card.tsx",
      "components/students/profile/tabs/guardians-tab.tsx",
    ]);
    const apiClient = read("lib/api/students.ts");

    assert.match(apiClient, /updateStudent:/);
    assert.match(apiClient, /method: 'PATCH'/);
    assert.match(apiClient, /updateStudentGuardian:/);
    assert.match(detailPage, /Edit profile|Edit Profile/);
    assert.match(detailPage, /Save Changes/);
    assert.match(detailPage, /System ID|studentSystemId/);
    assert.match(detailPage, /confirmNoDisability/);
    assert.match(detailPage, /Disability status/);
    assert.match(detailPage, /onEditGuardian/);
    assert.match(detailPage, /onSaveGuardian/);
    assert.match(detailPage, /Primary Guardian|isPrimary/);
    assert.match(detailPage, /error/);
    assert.doesNotMatch(detailPage, /demo-guardian|student-123|guardian-123/i);
  });

  it("adds lifecycle and transfer actions to the student detail page", () => {
    const detailPage = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/lifecycle-panel.tsx",
      "components/students/profile/tabs/documents-tab.tsx",
    ]);
    const apiClient = read("lib/api/students.ts");

    for (const helper of [
      "getStudentFeeClearance",
      "transferStudent",
      "archiveStudent",
      "archiveStudentAsAlumni",
      "softDeleteStudent",
      "revokeGeneratedStudentDocument",
    ]) {
      assert.match(apiClient, new RegExp(`${helper}:`));
    }

    assert.match(detailPage, /Manage student lifecycle|Lifecycle review/);
    assert.match(detailPage, /Check fee clearance/);
    assert.match(detailPage, /Transfer/);
    assert.match(detailPage, /Archive/);
    assert.match(detailPage, /Mark as alumni/);
    assert.match(detailPage, /Remove accidental record/);
    assert.match(detailPage, /Transfer Certificate/);
    assert.match(detailPage, /Leaving Certificate/);
    assert.match(detailPage, /Outstanding fees must be resolved/);
    assert.match(detailPage, /softDeleteStudent|delete/);
    assert.doesNotMatch(detailPage, /hard delete|waiveFeeClearance|demo-lifecycle|student-123/i);
  });

  it("adds a dedicated student document manager without exposing storage internals", () => {
    const detailPage = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/tabs/documents-tab.tsx",
      "components/admissions/admissions-pipeline.tsx",
      "components/m1/student-documents-workspace.tsx",
    ]);
    const apiClient = readMany(["lib/api/students.ts", "lib/api/client.ts"]);

    assert.match(detailPage, /System Generated Docs/);
    assert.match(detailPage, /Uploaded Documents/);
    assert.match(detailPage, /Required Checklist/);
    assert.match(detailPage, /buildDocumentChecklist\(documents\)/);
    assert.match(detailPage, /getExpiryState\(document\.expiryDate\)/);
    assert.match(detailPage, /Missing required document/);
    assert.match(detailPage, /Rejected document needs replacement/);
    assert.match(detailPage, /Expires in/);
    assert.match(detailPage, /generatedDocuments/);
    assert.match(
      detailPage,
      /Scanned copies and attachments provided during enrollment/,
    );
    assert.match(detailPage, /Student ID Card/);
    assert.match(detailPage, /Transfer Certificate/);
    assert.match(detailPage, /Leaving Certificate/);
    assert.match(detailPage, /Character Certificate/);
    assert.match(apiClient, /uploadStudentDocument:/);
    assert.match(
      apiClient,
      /downloadStudentDocument:\s*\(studentId:\s*string,\s*documentId:\s*string\)/,
    );
    assert.match(
      apiClient,
      /\/students\/\$\{encodeURIComponent\(studentId\)\}\/documents\/\$\{encodeURIComponent\(documentId\)\}\/download-url/,
    );
    assert.match(
      detailPage,
      /api\.downloadStudentDocument\(studentId, documentId\)/,
    );
    assert.match(detailPage, /openProtectedFile\(access\.fileAssetId/);
    assert.match(detailPage, /openUploadedDocument\(doc\.id\)/);
    assert.doesNotMatch(detailPage, /window\.open\(access\.url/);
    assert.match(detailPage, /formatDocumentStatus\(doc\.status\)/);
    assert.match(detailPage, /ProtectedFileButton/);
    assert.match(detailPage, /fileAssetId=\{selectedDocument\.fileId\}/);
    assert.doesNotMatch(detailPage, /href="#"/);
    assert.match(apiClient, /revokeGeneratedStudentDocument:/);
    assert.match(apiClient, /openStudentDocumentPdf[\s\S]*openPdfBlob/);
    assert.doesNotMatch(
      detailPage,
      /document\.objectKey|document\.publicUrl|doc\.objectKey|doc\.publicUrl/,
    );
    assert.doesNotMatch(detailPage, /demo-document|document-123/i);
  });

  it("keeps student photo upload private, bounded, and app-controlled", () => {
    const studentEditCard = read(
      "components/students/profile/student-edit-card.tsx",
    );
    const apiClient = read("lib/api/students.ts");

    assert.match(apiClient, /uploadStudentPhoto:/);
    assert.match(apiClient, /removeStudentPhoto:/);
    assert.match(
      studentEditCard,
      /STUDENT_PHOTO_MAX_BYTES = 2 \* 1024 \* 1024/,
    );
    assert.match(studentEditCard, /STUDENT_PHOTO_MIME_TYPES/);
    assert.match(studentEditCard, /image\/jpeg/);
    assert.match(studentEditCard, /image\/png/);
    assert.match(studentEditCard, /image\/webp/);
    assert.match(studentEditCard, /data-testid="student-photo-upload-input"/);
    assert.match(studentEditCard, /data-testid="student-photo-remove-button"/);
    assert.match(studentEditCard, /ConfirmDialog/);
    assert.match(studentEditCard, /color-mod-admissions-accent/);
    assert.doesNotMatch(studentEditCard, /window\.confirm|alert\(/);
    assert.doesNotMatch(
      studentEditCard,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("validates PDF responses before opening blob tabs", () => {
    const apiClient = readMany([
      "lib/api/client.ts",
      "lib/api/students.ts",
      "lib/api/finance.ts",
      "lib/api/academics.ts",
    ]);
    const reportCardSurfaces = readMany([
      "components/academics/report-cards/report-cards-workspace.tsx",
      "components/academics/tabs/report-cards-tab.tsx",
    ]);

    assert.match(apiClient, /async function openPdfBlob/);
    assert.match(apiClient, /response\.ok/);
    assert.match(apiClient, /content-type/);
    assert.match(apiClient, /application\/pdf/);
    assert.match(apiClient, /blob\.size === 0/);
    assert.match(apiClient, /header !== '%PDF-'/);
    assert.match(apiClient, /parseApiErrorMessage/);
    assert.match(apiClient, /openStudentDocumentPdf[\s\S]*openPdfBlob/);
    assert.match(apiClient, /openReceiptPdf[\s\S]*openPdfBlob/);
    assert.match(apiClient, /openReportCardPdf[\s\S]*openPdfBlob/);
    assert.match(reportCardSurfaces, /api\.openReportCardPdf/);
    assert.doesNotMatch(
      reportCardSurfaces,
      /NEXT_PUBLIC_API_BASE_URL[\s\S]*report-cards[\s\S]*\.pdf/,
    );
  });

  it("keeps attendance screen wired to real roster, submit, sync, analytics, and conflict APIs", () => {
    const attendanceForm = readMany([
      "components/forms/attendance-form.tsx",
      "app/dashboard/attendance/page.tsx",
      "app/dashboard/attendance/register/page.tsx",
      "components/attendance/attendance-analytics.tsx",
      "components/attendance/attendance-m2-workspaces.tsx",
      "components/attendance/attendance-conflict-review.tsx",
      "components/attendance/attendance-correction-review.tsx",
    ]);
    const requiredApis = [
      "api.listAcademicYears",
      "api.listClasses",
      "api.listSections",
      "api.getAttendanceRoster",
      "api.submitAttendance",
      "api.syncAttendance",
      "api.listAttendanceAnalytics",
      "api.listAttendanceConflicts",
      "api.reviewAttendanceConflict",
      "api.listAttendanceCorrections",
      "api.approveAttendanceCorrection",
      "api.rejectAttendanceCorrection",
      "api.getAttendanceRegister",
      "api.exportAttendanceRegister",
      "api.listM2HardenedAnomalies",
      "api.listM2FollowUps",
      "api.runM2FollowUps",
      "api.listAttendanceDrafts",
      "api.listM2OfflineConflicts",
    ];

    for (const apiCall of requiredApis) {
      assert.match(attendanceForm, new RegExp(apiCall.replace(".", "\\.")));
    }

    assert.match(attendanceForm, /AttendanceCorrectionReview/);
    assert.match(attendanceForm, /Correction Review Queue/);
    assert.match(attendanceForm, /Required audit reason/);
    assert.match(attendanceForm, /export prepared by the attendance backend/);
    assert.match(attendanceForm, /\/dashboard\/attendance\/anomalies/);
    assert.match(attendanceForm, /\/dashboard\/attendance\/follow-ups/);
    assert.match(attendanceForm, /\/dashboard\/attendance\/offline-drafts/);
    assert.doesNotMatch(attendanceForm, /window\.open\(url\.toString\(\)/);
    assert.match(attendanceForm, /color-mod-attendance-accent/);
    assert.doesNotMatch(
      attendanceForm,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("supports the full Phase 1 attendance exception status cycle", () => {
    const attendanceForm = readMany([
      "components/forms/attendance-form.tsx",
      "components/attendance/attendance-roster-item.tsx",
    ]);
    const statuses = [
      "PRESENT",
      "ABSENT",
      "LATE",
      "SICK_LEAVE",
      "EXCUSED_LEAVE",
      "UNEXCUSED_LEAVE",
    ];

    assert.match(
      attendanceForm,
      /const statusCycle: AttendanceStatus\[\] = \[|STATUS_OPTIONS/,
    );

    for (const status of statuses) {
      assert.match(attendanceForm, new RegExp(status));
    }
  });

  it("blocks future attendance dates and keeps teacher summary labels visible", () => {
    const attendanceForm = readMany([
      "components/forms/attendance-form.tsx",
      "components/attendance/attendance-header.tsx",
      "components/attendance/attendance-roster-item.tsx",
    ]);

    assert.match(attendanceForm, /max=\{today\}/);
    assert.match(
      attendanceForm,
      /Future dates cannot be submitted|Date Not Allowed/,
    );
    assert.match(attendanceForm, /Present/);
    assert.match(attendanceForm, /Absent/);
    assert.match(attendanceForm, /Late/);
    assert.match(attendanceForm, /Leave|leave/);
    assert.match(
      attendanceForm,
      /exceptions only|Everyone is present by default/,
    );
  });

  it("keeps offline sync secondary and preserves analytics plus conflict review sections", () => {
    const attendanceForm = readMany([
      "components/forms/attendance-form.tsx",
      "app/dashboard/attendance/page.tsx",
      "components/attendance/attendance-analytics.tsx",
      "components/attendance/attendance-conflict-review.tsx",
    ]);

    assert.match(
      attendanceForm,
      /Offline sync|syncAttendance|Sync offline draft/,
    );
    assert.match(
      attendanceForm,
      /Recent Attendance Analytics|Attendance Risk Alerts/,
    );
    assert.match(attendanceForm, /Conflict Review|Conflict Review Queue/);
    assert.match(attendanceForm, /Attendance Risk Alerts/);
    assert.match(attendanceForm, /Mark Resolved|Mark reviewed/);
  });

  it("keeps finance screen wired to real Phase 1 finance APIs", () => {
    const financeForm = read("components/forms/finance-form.tsx");
    const requiredApis = [
      "api.listAcademicYears",
      "api.listClasses",
      "api.listFeeHeads",
      "api.listFeePlans",
      "api.listInvoices",
      "api.getInvoiceDetail",
      "api.listReceipts",
      "api.listLedgerEntries",
      "api.listDefaulters",
      "api.listDiscounts",
      "api.listWaivers",
      "api.createFeeHead",
      "api.createFeePlan",
      "api.generateBillingRun",
      "api.collectPayment",
      "api.previewCashierClose",
      "api.listCashierCloses",
      "api.finalizeCashierClose",
      "api.createDiscount",
      "api.createWaiver",
      "api.sendDefaulterReminders",
      "api.openReceiptPdf",
    ];

    for (const apiCall of requiredApis) {
      assert.match(financeForm, new RegExp(apiCall.replace(".", "\\.")));
    }
  });

  it("builds finance around the collection counter without fake IDs", () => {
    const financeForm = read("components/forms/finance-form.tsx");
    const collectionCounter = read("components/finance/collection-counter.tsx");
    const financeLedgerSurfaces = readMany([
      "components/finance/billing-runs-tab.tsx",
      "components/finance/cashier-close-section.tsx",
      "components/finance/collection-counter.tsx",
      "components/finance/defaulter-aging-summary.tsx",
      "components/finance/defaulter-queue-tab.tsx",
      "components/finance/discounts-waivers-tab.tsx",
      "components/finance/dues-analysis-section.tsx",
      "components/finance/fee-ledger.tsx",
      "components/finance/fee-setup-tab.tsx",
      "components/finance/reprint-dialog.tsx",
      "components/finance/reversal-dialog.tsx",
    ]);

    assert.match(financeForm, /Collection Counter/);
    assert.match(financeForm, /Invoice Detail/);
    assert.match(financeForm, /View invoice details/);
    assert.match(financeForm, /Payments & Receipts/);
    assert.match(financeForm, /Refund \/ Reverse/);
    assert.match(
      financeForm,
      /This creates a reversal\/refund record\. It does not edit the original payment/,
    );
    assert.match(financeForm, /api\.refundPayment/);
    assert.match(financeForm, /REFUND/);
    assert.match(
      financeForm,
      /Search by name, SCH-YYYY-NNNN, or invoice number/,
    );
    assert.match(financeForm, /Confirm Payment & Generate Receipt/);
    assert.match(financeForm, /No fake production IDs are used/);
    assert.match(collectionCounter, /Invoice breakdown/);
    assert.match(collectionCounter, /Student name not set/);
    assert.match(collectionCounter, /Class not set/);
    assert.match(collectionCounter, /Guardian phone not recorded/);
    assert.match(financeLedgerSurfaces, /color-mod-fees-accent/);
    assert.doesNotMatch(collectionCounter, /View Full Invoice/);
    assert.doesNotMatch(
      financeLedgerSurfaces,
      /Unknown Student|N\/A|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|bg-slate-900|shadow-2xl|shadow-xl/,
    );
    assert.doesNotMatch(financeForm, /replace-me/i);
    for (const sampleValue of [
      /TUITION-P1/,
      /Class 1 Tuition/,
      /PLAN-P1/,
      /Primary monthly plan/,
      /Sibling discount/,
      /Approved sibling discount policy/,
      /Manual approved waiver/,
      /defaultAmount:\s*3500/,
      /amount:\s*3500/,
      /amount:\s*1000/,
      /Math\.min\(500/,
    ]) {
      assert.doesNotMatch(financeForm, sampleValue);
    }
    assert.match(financeForm, /!feePlan\.code\.trim\(\)/);
    assert.match(financeForm, /!feePlan\.name\.trim\(\)/);
    assert.match(
      financeForm,
      /discount\.percentOff <= 0 && discount\.amountOff <= 0/,
    );
    assert.match(financeForm, /!waiver\.reason\.trim\(\)/);
  });

  it("keeps cashier close day-end workflow wired to backend close endpoints", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /Cashier Close \/ Day-End/);
    assert.match(financeForm, /api\.previewCashierClose/);
    assert.match(financeForm, /api\.listCashierCloses/);
    assert.match(financeForm, /api\.finalizeCashierClose/);
    assert.match(
      financeForm,
      /Closing records the day-end cash position\. It does not edit payments/,
    );
    assert.match(financeForm, /Actual cash counted/);
    assert.match(financeForm, /Expected cash amount/);
    assert.match(financeForm, /Variance reason/);
    assert.match(financeForm, /methodBreakdown/);
    assert.match(financeForm, /actualCashAmount/);
    assert.match(financeForm, /Printable Day-End Summary/);
    assert.match(financeForm, /Finalize day-end close/);
    assert.match(financeForm, /CLOSE/);
  });

  it("surfaces backend student fee ledger on the student detail page", () => {
    const studentDetail = readMany([
      "components/students/student-detail-page.tsx",
      "components/students/profile/tabs/fees-tab.tsx",
    ]);

    assert.match(studentDetail, /Billing History/);
    assert.match(studentDetail, /Collect Payment/);
    assert.match(studentDetail, /Balance Due/);
    assert.match(studentDetail, /StudentProfileInvoice/);
    assert.match(
      studentDetail,
      /Financial records will appear after enrollment billing/,
    );
    assert.doesNotMatch(studentDetail, /student-123|invoice-123|fake/i);
  });

  it("blocks overpayment in the finance UI before submitting", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /payment\.amount > outstanding/);
    assert.match(
      financeForm,
      /Payment amount cannot exceed the outstanding balance/,
    );
    assert.match(financeForm, /Payment amount must be greater than zero/);
  });

  it("adds interactive fee-head and period controls to the collection counter dues table", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    for (const marker of [
      "finance-dues-interaction-toolbar",
      "Filter dues by fee head",
      "Filter dues by billing period",
      "Collect line",
      "onQuickCollect",
      "getLineNetDue",
      "Math.min(lineAmount, outstanding)",
    ]) {
      assert.ok(financeForm.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("keeps receipt success, discounts, waivers, and defaulter reminders available", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /Receipt Generated/);
    assert.match(financeForm, /Open receipt PDF/);
    assert.match(financeForm, /Approval reason/);
    assert.match(financeForm, /Approve waiver/);
    assert.match(financeForm, /Remind all filtered/);
    assert.match(financeForm, /Remind selected/);
  });

  it("keeps receipt QR verification wired to the backend receipt verifier", () => {
    const financeApi = read("lib/api/finance.ts");
    const ledgerSection = read("components/finance/ledger-section.tsx");
    const verificationPanel = read(
      "components/finance/receipt-verification-panel.tsx",
    );

    assert.match(financeApi, /verifyReceipt/);
    assert.match(
      financeApi,
      /\/receipts\/verify\/\$\{encodeURIComponent\(receiptNumber\)\}/,
    );
    assert.match(ledgerSection, /ReceiptVerificationPanel/);
    assert.match(verificationPanel, /api\.verifyReceipt/);
    assert.match(verificationPanel, /receipt-verification-result/);
    assert.doesNotMatch(verificationPanel, /localStorage|sessionStorage|mock/i);
  });

  it("adds a fee collection export action to the finance screen", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /Export Fee Collection CSV/);
    assert.match(financeForm, /api\.exportReport\('fee-collection-report'/);
    assert.match(financeForm, /History & Reports/);
  });

  it("adds a defaulter aging export action to the finance screen", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /Export Defaulter Aging CSV/);
    assert.match(financeForm, /api\.exportReport\('defaulter-aging-report'/);
    assert.match(financeForm, /asOfDate: new Date\(\)\.toISOString\(\)/);
  });

  it("keeps day-end cashier close PDFs protected and app-opened", () => {
    const financeForm = read("components/forms/finance-form.tsx");
    const cashierCloseSection = read(
      "components/finance/cashier-close-section.tsx",
    );
    const apiService = read("../api/src/finance/finance.service.ts");
    const pdfBuilder = read("../api/src/common/pdf/simple-pdf.ts");
    const coreTypes = read("../../packages/core/src/types.ts");

    assert.match(apiService, /closePdfFile/);
    assert.match(apiService, /registerGeneratedFile/);
    assert.match(apiService, /DayEndClose_/);
    assert.match(apiService, /getCashierClosePdfFilesByCloseId/);
    assert.match(pdfBuilder, /Payment Method Breakdown/);
    assert.match(pdfBuilder, /methodBreakdown/);
    assert.match(coreTypes, /closePdfFile\?:/);
    assert.match(financeForm, /finance-cashier-close-pdf-open/);
    assert.match(cashierCloseSection, /finance-day-end-close-pdf-open/);
    assert.match(`${financeForm}\n${cashierCloseSection}`, /api\.getFileView/);
    assert.doesNotMatch(
      `${financeForm}\n${cashierCloseSection}`,
      /PDF export is intentionally\s+not generated/,
    );
  });

  it("keeps active finance analysis exports app-controlled", () => {
    const duesAnalysis = read("components/finance/dues-analysis-section.tsx");
    const defaulterAging = read(
      "components/finance/defaulter-aging-summary.tsx",
    );

    for (const marker of [
      "api.downloadReport('dues-table-report'",
      "finance-dues-csv-export",
      "Clear filters",
      "exportMutation.error.message",
    ]) {
      assert.ok(
        duesAnalysis.includes(marker),
        `Missing dues marker: ${marker}`,
      );
    }

    for (const marker of [
      "api.downloadReport('defaulter-aging-report'",
      "finance-defaulter-aging-csv-export",
      "Export Aging CSV",
      "exportMutation.error.message",
    ]) {
      assert.ok(
        defaulterAging.includes(marker),
        `Missing aging marker: ${marker}`,
      );
    }
  });

  it("keeps report-card corrections behind a review dialog with audited reason entry", () => {
    const reportCardsWorkspace = read(
      "components/academics/report-cards/report-cards-workspace.tsx",
    );

    for (const marker of [
      "ReportCardCorrectionDialog",
      "Review Locked Report-Card Correction",
      "Regeneration creates a new report-card version",
      'data-testid="report-card-correction-panel"',
      'data-testid="report-card-correction-reason"',
      'data-testid="report-card-submit-correction"',
      "disabled={isSubmitting || !reason.trim()}",
      "reportCardStudentName",
      "Confirm locked report-card generation",
      "generationStudentIds",
      "Could not load report card PDF",
    ]) {
      assert.ok(
        reportCardsWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }

    assert.doesNotMatch(reportCardsWorkspace, /alert\(/);
    assert.doesNotMatch(reportCardsWorkspace, /confirm\(/);
  });

  it("keeps report-card generation explicit about the applied grading policy", () => {
    const reportCardsWorkspace = read(
      "components/academics/report-cards/report-cards-workspace.tsx",
    );
    const academicsClient = read("lib/api/academics.ts");

    for (const marker of ["getGradingPolicy", "/academics/grading-policy"]) {
      assert.ok(
        academicsClient.includes(marker),
        `Missing client marker: ${marker}`,
      );
    }

    for (const marker of [
      "queryKey: ['academic-grading-policy']",
      "api.getGradingPolicy",
      'data-testid="grading-policy-panel"',
      "Percentage Decimals",
      "Rounding Mode",
      "No failing band is configured",
    ]) {
      assert.ok(
        reportCardsWorkspace.includes(marker),
        `Missing workspace marker: ${marker}`,
      );
    }
  });

  it("keeps M4 academics workspaces tokenized and production-backed", () => {
    const academicsSurfaces = readMany([
      "components/academics/exams/exam-list.tsx",
      "components/academics/exams/exams-workspace.tsx",
      "components/academics/exams/assessment-components-dialog.tsx",
      "components/academics/tabs/marks-entry-tab.tsx",
      "components/academics/tabs/marks-lock-tab.tsx",
      "components/academics/tabs/cas-records-tab.tsx",
      "components/academics/tabs/promotion-tab.tsx",
      "components/academics/tabs/subjects-tab.tsx",
      "components/academics/marks-entry/marks-entry-workspace.tsx",
      "components/academics/report-cards/report-cards-workspace.tsx",
    ]);

    assert.match(academicsSurfaces, /color-mod-academics-accent/);
    assert.doesNotMatch(
      academicsSurfaces,
      /bg-slate-900|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|shadow-slate-900|shadow-2xl|shadow-xl|N\/A|Unknown|primary-500|primary-50|primary-600|primary-700|primary-100|primary-200/,
    );
  });

  it("keeps ledger preview preview-only without direct accounting calls", () => {
    const financeForm = read("components/forms/finance-form.tsx");

    assert.match(financeForm, /Ledger Entry Preview/);
    assert.match(
      financeForm,
      /Preview only - backend posts final ledger entry/,
    );
    assert.doesNotMatch(
      financeForm,
      /api\.createAccounting|api\.closeAccounting|api\.listAccountingReports/,
    );
  });

  it("labels the activity page as Activity Feed instead of Transport", () => {
    const activityPage = read("app/dashboard/activity/page.tsx");

    assert.match(activityPage, /Activity Feed/);
    assert.match(
      activityPage,
      /Photo posts, student tags, mood logs, milestones/,
    );
    assert.doesNotMatch(activityPage, />\s*Transport\s*</);
  });

  it("keeps activity screen wired to real M5 and M12 APIs", () => {
    const activityForm = read("components/forms/activity-feed-form.tsx");
    const requiredApis = [
      "api.listClasses",
      "api.listSections",
      "api.listStudents",
      "api.listActivityPosts",
      "api.listActivityGallery",
      "api.listMoodLogs",
      "api.listDevelopmentalMilestones",
      "api.listNotificationDeliveries",
      "api.createActivityPost",
      "api.createMoodLog",
      "api.createActivityReaction",
      "api.createDevelopmentalMilestone",
      "filesToBase64Payloads",
    ];

    for (const apiCall of requiredApis) {
      assert.match(activityForm, new RegExp(apiCall.replace(".", "\\.")));
    }
  });

  it("keeps canteen POS receipt preview and PDF reprint wired to real APIs", () => {
    const canteenClient = read("lib/api/canteen.ts");
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");

    assert.match(canteenClient, /getPosReceipt/);
    assert.match(canteenClient, /openPosReceiptPdf/);
    assert.match(canteenClient, /receipt\.pdf/);
    assert.match(canteenWorkspace, /ReceiptPreview/);
    assert.match(canteenWorkspace, /onReceiptPdf/);
    assert.doesNotMatch(canteenWorkspace, /window\.print/);
  });

  it("keeps canteen spending controls loaded from backend data", () => {
    const canteenClient = read("lib/api/canteen.ts");
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");

    assert.match(canteenClient, /getSpendingControl:/);
    assert.match(canteenClient, /\/canteen\/spending-controls\/student\//);
    assert.match(canteenWorkspace, /queryKey: \['canteen-control'/);
    assert.match(canteenWorkspace, /controlStudentQuery\.data/);
    assert.match(canteenWorkspace, /No saved control/);
    assert.match(canteenWorkspace, /Blocked menu item IDs/);
    assert.doesNotMatch(canteenWorkspace, /dailySpendingLimit: 200/);
    assert.doesNotMatch(canteenWorkspace, /Blocked by Limit/);
    assert.doesNotMatch(canteenWorkspace, /shows 0 until/);
    assert.doesNotMatch(canteenWorkspace, /Parent-facing control UI/);
  });

  it("keeps canteen reports and CSV exports wired to backend report routes", () => {
    const canteenClient = read("lib/api/canteen.ts");
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");

    for (const helper of [
      "getDailyMealCountReport",
      "downloadDailyMealCountCsv",
      "getItemWiseSalesReport",
      "downloadItemWiseSalesCsv",
      "getLowBalanceWallets",
      "getStudentSpendingSummary",
      "getStockLedger",
    ]) {
      assert.match(
        canteenClient,
        new RegExp(`${helper}:`),
        `Missing canteen report helper: ${helper}`,
      );
    }

    for (const endpoint of [
      "/canteen/reports/daily-meal-count",
      "/canteen/reports/daily-meal-count.csv",
      "/canteen/reports/item-wise-sales",
      "/canteen/reports/item-wise-sales.csv",
      "/canteen/reports/low-balance-wallets",
      "/canteen/reports/student-spending-summary",
      "/canteen/reports/stock-ledger",
    ]) {
      assert.match(canteenClient, new RegExp(endpoint.replaceAll("/", "\\/")));
    }

    for (const marker of [
      "canteen-daily-meal-csv-export",
      "canteen-item-sales-csv-export",
      "Report range from",
      "Report range to",
      "Low-balance wallets",
      "stockLedgerRows.slice(0, 10).map",
    ]) {
      assert.ok(canteenWorkspace.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("routes linked canteen meal-plan invoices into the finance counter", () => {
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");
    const financePage = read("app/dashboard/finance/page.tsx");
    const collectionSection = read("components/finance/collection-section.tsx");
    const collectionCounter = read("components/finance/collection-counter.tsx");

    assert.match(canteenWorkspace, /Open invoice/);
    assert.match(canteenWorkspace, /\/dashboard\/finance\?invoiceId=/);
    assert.match(financePage, /useSearchParams/);
    assert.match(financePage, /initialInvoiceId/);
    assert.match(collectionSection, /initialInvoiceId/);
    assert.match(collectionCounter, /linkedInvoice/);
    assert.match(collectionCounter, /selectedInvoiceId === initialInvoiceId/);
  });

  it("adds accounting audit summary context and richer log detail fields", () => {
    const auditWorkspace = read(
      "components/accounting/accounting-audit-workspace.tsx",
    );

    for (const marker of [
      "AuditSummaryCard",
      "Records on page",
      "activeFilterLabel",
      'data-testid="accounting-audit-page-summary"',
      "AuditDetailField",
      "Tenant scope",
      "Resource ID",
      "Actor ID",
    ]) {
      assert.ok(auditWorkspace.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("makes transport latest-location freshness explicit for operators", () => {
    const transportWorkspace = read(
      "components/transport/transport-workspace.tsx",
    );

    for (const marker of [
      "transport-location-freshness-panel",
      "getLocationFreshness",
      "LocationMetric",
      "Latest backend coordinate from",
      "Confirm with the driver before sharing transport updates",
      "Treat the trip position as approximate",
      "Persisted history",
      "Redis latest cache",
      "formatLocationSignal",
      "No backend coordinate",
    ]) {
      assert.ok(
        transportWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }
  });

  it("keeps transport safety boundary operational instead of placeholder-only", () => {
    const transportWorkspace = read(
      "components/transport/transport-workspace.tsx",
    );

    for (const marker of [
      "transport-safety-boundary-panel",
      "SafetyMetric",
      "activeTripsMissingDriver",
      "activeTripsMissingStudents",
      "Parent visibility stays scoped",
      "Check latest location",
      "Review assignments",
    ]) {
      assert.ok(
        transportWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }

    assert.doesNotMatch(
      transportWorkspace,
      /Foundation placeholder for future school-level visibility controls/,
    );
  });

  it("keeps transport route operations and trip report exports backend-backed", () => {
    const transportClient = read("lib/api/transport.ts");
    const transportWorkspace = read(
      "components/transport/transport-workspace.tsx",
    );

    for (const helper of [
      "getTripHistoryReport",
      "downloadTripHistoryCsv",
      "getBoardingReport",
      "getReports",
      "getGpsAcceptRejectReport",
      "getStaleGpsReport",
      "getOneDayRouteChangesReport",
      "getVehicleDocumentExpiryReport",
      "getMaintenanceReminderReport",
    ]) {
      assert.match(
        transportClient,
        new RegExp(`${helper}:`),
        `Missing transport report helper: ${helper}`,
      );
    }

    for (const endpoint of [
      "/transport/reports",
      "/transport/reports/trips",
      "/transport/reports/trips.csv",
      "/transport/reports/boarding",
      "/transport/reports/gps-pings",
      "/transport/reports/stale-gps",
      "/transport/reports/one-day-route-changes",
      "/transport/reports/vehicle-documents",
      "/transport/reports/maintenance",
    ]) {
      assert.match(
        transportClient,
        new RegExp(endpoint.replaceAll("/", "\\/")),
      );
    }

    for (const marker of [
      "transport-route-dashboard-panel",
      "RouteOperationsPanel",
      "Report filters",
      "transport-trip-history-csv-export",
      "Export full trip CSV",
      "Trip-history CSV export uses server-side generation",
      "setReportRouteId",
      "setReportVehicleId",
      "setReportDriverAssignmentId",
      "transport-gps-quality-report",
      "transport-stale-gps-report",
      "transport-one-day-route-changes-report",
      "transport-vehicle-documents-report",
      "transport-maintenance-report",
      "Remaining Issues",
    ]) {
      assert.ok(
        transportWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }
  });

  it("keeps M9 transport navigation on shared module primitives", () => {
    const transportLayout = read("app/dashboard/transport/layout.tsx");
    const transportPage = read("app/dashboard/transport/page.tsx");
    const transportWorkspace = read(
      "components/transport/transport-workspace.tsx",
    );

    for (const marker of [
      "ModuleHeader",
      'eyebrow="M9 Transport"',
      "primaryAction",
      "moreActionItems",
      "ModuleTabs",
      "Location Status",
      "/dashboard/transport/location",
      "Open Trips",
    ]) {
      assert.ok(transportLayout.includes(marker), `Missing marker: ${marker}`);
    }

    for (const marker of ["KpiGrid", "KpiCard", "value=\"Unavailable\""]) {
      assert.ok(transportWorkspace.includes(marker), `Missing marker: ${marker}`);
    }

    assert.doesNotMatch(transportPage, /PageHeader|headerActions/);
    assert.doesNotMatch(transportLayout, /Live Status/);
  });

  it("keeps M9 transport workspace aligned to transport UI tokens", () => {
    const transportWorkspace = read(
      "components/transport/transport-workspace.tsx",
    );

    assert.match(transportWorkspace, /color-mod-transport/);
    assert.doesNotMatch(
      transportWorkspace,
      /rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|rounded-\[30px\]|shadow-2xl|bg-slate-900|bg-slate-950|primary-(50|100|200|300|400|500|600|700|800|900)|\bN\/A\b|\bUnknown\b|alert\(|confirm\(|Coming soon|fake|mock/i,
    );
  });

  it("keeps canteen Serving and POS QR scan flows fast and backend-purpose compatible", () => {
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");
    const resolver = read("components/ui/qr-resolver.tsx");

    for (const marker of [
      "CanteenQrStudentCard",
      "resolvedServingStudent",
      "resolvedPosStudent",
      "servingAllergyAcknowledged",
      "servingHasAllergyWarnings",
      "canteen-serving-control-preview",
      "Scan a student QR; the serving form stays ready",
      "Scan student QR to select wallet payment",
      "I reviewed this student's allergy and medical warnings before",
      "servingHasAllergyWarnings && !servingAllergyAcknowledged",
      "!posForm.studentId",
      "!posForm.items[0]?.menuItemId",
      "Number(posForm.items[0]?.quantity ?? 0) <= 0",
    ]) {
      assert.ok(canteenWorkspace.includes(marker), `Missing marker: ${marker}`);
    }

    assert.match(
      resolver,
      /purpose === 'CANTEEN_POS' \|\| purpose === 'CANTEEN_SERVE'/,
    );
    assert.match(resolver, /return 'CANTEEN'/);
  });

  it("keeps canteen inventory and supplier surfaces wired to real APIs", () => {
    const canteenClient = read("lib/api/canteen.ts");
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");

    for (const helper of [
      "listSuppliers",
      "createSupplier",
      "listInventoryItems",
      "createInventoryItem",
      "createPurchaseBill",
      "recordWastage",
      "adjustStock",
      "getStockLedger",
      "listWalletTransactions",
    ]) {
      assert.match(
        canteenClient,
        new RegExp(`${helper}:`),
        `Missing canteen helper: ${helper}`,
      );
    }

    for (const endpoint of [
      "/canteen/suppliers",
      "/canteen/inventory-items",
      "/canteen/purchase-bills",
      "/canteen/wastage",
      "/canteen/stock-adjustment",
      "/canteen/reports/stock-ledger",
    ]) {
      assert.match(canteenClient, new RegExp(endpoint.replaceAll("/", "\\/")));
    }

    assert.match(canteenWorkspace, /supplierMutation/);
    assert.match(canteenWorkspace, /inventoryItemMutation/);
    assert.match(canteenWorkspace, /purchaseBillMutation/);
    assert.match(canteenWorkspace, /wastageMutation/);
    assert.match(canteenWorkspace, /stockAdjustmentMutation/);
    assert.match(canteenWorkspace, /walletTransactions = itemsFromResult/);
    assert.match(canteenWorkspace, /Stock ledger/);
    assert.equal(
      existsSync(join(webRoot, "app/dashboard/canteen/inventory/page.tsx")),
      true,
    );
    assert.doesNotMatch(
      canteenWorkspace,
      /Inventory Later|Rice \(Premium\)|Cooking Oil/,
    );
  });

  it("keeps M10 canteen workspace and selector aligned to canteen UI tokens", () => {
    const canteenWorkspace = read("components/canteen/canteen-workspace.tsx");
    const menuSelector = read("components/canteen/menu-item-selector.tsx");
    const forbidden =
      /rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[3rem\]|rounded-\[30px\]|shadow-2xl|shadow-xl|bg-slate-900|bg-slate-950|primary-(50|100|200|300|400|500|600|700|800|900)|\bN\/A\b|\bUnknown\b|alert\(|confirm\(|Coming soon|fake|mock/i;

    for (const source of [canteenWorkspace, menuSelector]) {
      assert.match(source, /color-mod-canteen/);
      assert.doesNotMatch(source, forbidden);
    }

    assert.match(canteenWorkspace, /Cashier not recorded/);
  });

  it("keeps activity categories and upload limits explicit", () => {
    const activityForm = read("components/forms/activity-feed-form.tsx");
    const categories = [
      "LEARNING",
      "OUTDOOR_PLAY",
      "ART_AND_CRAFT",
      "CELEBRATION",
      "SPORTS",
      "GENERAL",
    ];

    for (const category of categories) {
      assert.match(activityForm, new RegExp(category));
    }

    assert.match(activityForm, /Attach 1 to 5 images/);
    assert.match(activityForm, /selectedFiles\.length > 5/);
    assert.match(activityForm, /file\.type\.startsWith\('image\/'\)/);
    assert.match(activityForm, /10MB/);
  });

  it("preserves feed preview, media gallery, mood logs, milestones, and delivery records", () => {
    const activityForm = read("components/forms/activity-feed-form.tsx");
    const activityApi = read("lib/api/activity.ts");

    assert.match(activityForm, /Feed Preview/);
    assert.match(activityForm, /Recent classroom moments/);
    assert.match(
      activityForm,
      /No activity posts yet\. Create the first classroom moment/,
    );
    assert.match(activityForm, /Media Gallery/);
    assert.match(activityForm, /Teacher media gallery/);
    assert.match(
      activityForm,
      /No activity media matches the selected filters/,
    );
    assert.match(activityForm, /api\.previewActivityAttachment/);
    assert.match(activityForm, /api\.downloadActivityAttachment/);
    assert.match(activityApi, /previewActivityAttachment[\s\S]*openImageBlob/);
    assert.match(activityApi, /downloadActivityAttachment[\s\S]*downloadBlob/);
    assert.doesNotMatch(activityApi, /URL\.createObjectURL/);
    assert.match(activityForm, /Daily Mood Log/);
    assert.match(activityForm, /Mood History/);
    assert.match(activityForm, /Montessori \/ ECE Milestones/);
    assert.match(activityForm, /DevelopmentalMilestone/);
    assert.match(activityForm, /Activity Delivery Records/);
    assert.match(activityForm, /QUEUED/);
    assert.match(activityForm, /SENT/);
    assert.match(activityForm, /FAILED/);
    assert.match(activityForm, /SKIPPED/);
  });

  it("preserves M5 redirected workflow intent in the in-page activity tabs", () => {
    const activityPage = read("app/dashboard/activity/page.tsx");
    const activityForm = read("components/forms/activity-feed-form.tsx");
    const redirects = readMany([
      "app/dashboard/activity/gallery/page.tsx",
      "app/dashboard/activity/milestones/page.tsx",
      "app/dashboard/activity/moderation/page.tsx",
    ]);

    assert.match(activityPage, /searchParams\.get\('section'\)/);
    assert.match(activityPage, /<ActivityFeedForm initialSection=\{initialSection\}/);
    assert.match(activityForm, /initialSection\?: ActivitySection/);
    assert.match(activityForm, /useState<ActivitySection>\(initialSection\)/);
    assert.match(redirects, /section=Media\+Gallery/);
    assert.match(redirects, /section=Milestones/);
    assert.match(redirects, /section=Feed\+Preview/);
  });

  it("does not implement AI captions or permanent public media URLs in activity feed", () => {
    const activityForm = read("components/forms/activity-feed-form.tsx");

    assert.match(activityForm, /AI captions later/);
    assert.match(activityForm, /permanent public URLs are not shown/);
    assert.match(activityForm, /Private media/);
    assert.doesNotMatch(
      activityForm,
      /api\.createAi|generateAi|AI caption button/,
    );
    assert.doesNotMatch(activityForm, /publicUrl:\s*file|URL\.createObjectURL/);
    assert.doesNotMatch(activityForm, /replace-me/i);
  });

  it("keeps activity post mutations invalidating every feed surface", () => {
    const activityForm = read("components/forms/activity-feed-form.tsx");
    const activityDetail = read("app/dashboard/activity/[postId]/page.tsx");

    for (const source of [activityForm, activityDetail]) {
      for (const marker of [
        "queryKey: ['activity-posts']",
        "queryKey: ['parent-activity-posts']",
        "queryKey: ['dashboard-activity-posts']",
      ]) {
        assert.ok(source.includes(marker), `Missing cache marker: ${marker}`);
      }
    }

    assert.match(activityForm, /queryKey: \['activity-gallery'\]/);
    assert.match(activityDetail, /queryKey: \['activity-gallery'\]/);
  });

  it("keeps M5 activity feed surfaces tokenized and production-backed", () => {
    const surfaces = [
      "components/forms/activity-feed-form.tsx",
      "app/dashboard/activity/[postId]/page.tsx",
    ];
    const forbidden = [
      /bg-slate-900/,
      /bg-slate-950/,
      /shadow-slate-900/,
      /shadow-2xl/,
      /shadow-xl/,
      /rounded-\[2rem\]/,
      /rounded-\[2\.5rem\]/,
      /rounded-\[30px\]/,
      /primary-(50|100|200|300|400|500|600|700|800|900)/,
      /\bN\/A\b/,
      /\bUnknown\b/,
      /alert\(/,
      /confirm\(/,
      /Coming soon/i,
      /fake/i,
      /mock/i,
    ];

    for (const surface of surfaces) {
      const source = read(surface);

      assert.match(source, /color-mod-activity/);
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${surface} contains ${pattern}`);
      }
    }
  });

  it("keeps notices screen wired to real M12 APIs", () => {
    const communicationsForm = read("components/forms/communications-form.tsx");
    const noticeDetailPage = read("app/dashboard/notices/[noticeId]/page.tsx");
    const communicationsApi = read("lib/api/communications.ts");
    const requiredApis = [
      "api.listClasses",
      "api.listSections",
      "api.listNotificationDeliveries",
      "api.listNotices",
      "api.listEvents",
      "api.listAdmissions",
      "api.getGuardianConsentStatus",
      "api.createNotice",
      "api.previewNoticeRecipients",
      "api.createEvent",
      "api.captureGuardianConsent",
      "api.revokeGuardianConsent",
    ];

    for (const apiCall of requiredApis) {
      assert.match(communicationsForm, new RegExp(apiCall.replace(".", "\\.")));
    }

    assert.match(communicationsApi, /getNoticeDetail:/);
    assert.match(communicationsApi, /listNoticeUnreadRecipients:/);
    assert.match(communicationsApi, /previewNoticeRecipients:/);
    assert.match(communicationsApi, /getNotificationDeliveryAnalytics:/);
    assert.match(noticeDetailPage, /api\.getNoticeDetail\(noticeId\)/);
    assert.match(
      noticeDetailPage,
      /api\.listNoticeUnreadRecipients\(noticeId\)/,
    );
    assert.match(noticeDetailPage, /Open attachment/);
    assert.match(noticeDetailPage, /ProtectedFileButton/);
    assert.match(noticeDetailPage, /getProtectedFileId/);
    assert.doesNotMatch(noticeDetailPage, /href=\{notice\.attachmentUrl\}/);
    assert.doesNotMatch(noticeDetailPage, /fetchNoticeDetail|API_BASE_URL/);
  });

  it("keeps communications sections and notice audience controls available", () => {
    const communicationsForm = read("components/forms/communications-form.tsx");
    const requiredSections = [
      "Notices",
      "Events",
      "Delivery Records",
      "Consent Management",
    ];
    const priorities = ["NORMAL", "URGENT", "EMERGENCY"];
    const audiences = ["ALL", "CLASS", "SECTION"];

    for (const section of requiredSections) {
      assert.match(communicationsForm, new RegExp(section));
    }

    for (const priority of priorities) {
      assert.match(communicationsForm, new RegExp(priority));
    }

    for (const audience of audiences) {
      assert.match(communicationsForm, new RegExp(audience));
    }

    assert.match(
      communicationsForm,
      /Preview and confirm recipients before publishing/,
    );
    assert.match(communicationsForm, /I reviewed the recipient and channel counts/);
    assert.match(communicationsForm, /Publish notice/);
    assert.match(communicationsForm, /Schedule notice/);
  });

  it("preserves events, delivery records, and consent management behavior", () => {
    const communicationsForm = read("components/forms/communications-form.tsx");
    const deliveryStatuses = [
      "QUEUED",
      "SENT",
      "FAILED",
      "SKIPPED",
      "PENDING",
      "RETRYING",
      "RETRY_PENDING",
    ];

    assert.match(communicationsForm, /Event Publisher/);
    assert.match(communicationsForm, /Create event/);
    assert.match(communicationsForm, /Recent provider-neutral deliveries/);
    assert.match(communicationsForm, /Capture consent/);
    assert.match(communicationsForm, /Revoke consent/);
    assert.match(
      communicationsForm,
      /Photo usage consent affects Activity Feed visibility/,
    );

    for (const status of deliveryStatuses) {
      assert.match(communicationsForm, new RegExp(status));
    }
  });

  it("keeps parent-teacher messaging moderation and escalation decisions explicit", () => {
    const messaging = read(
      "components/messaging/parent-teacher-messaging-workspace.tsx",
    );

    for (const marker of [
      "chat-moderation-decision-panel",
      "Safety & Escalation Queue",
      "getModerationDecision",
      "Concern reason",
      "Moderation reason",
      "Escalation reason",
      "Thread closed with an audited moderation reason.",
      "Thread escalated for school leadership review.",
      "Escalated thread needs owner review",
    ]) {
      assert.ok(messaging.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("keeps notice unread recipient follow-up controls available", () => {
    const noticeDetail = read("app/dashboard/notices/[noticeId]/page.tsx");

    for (const marker of [
      "notice-unread-recipient-controls",
      "Search unread notice recipients",
      "Filter unread recipients by channel",
      "Filter unread recipients by class",
      "Follow-up queue:",
      "visible delivery records failed",
      "visible recipients need contact cleanup",
      "Contact:",
      "No unread recipients match these filters",
    ]) {
      assert.ok(noticeDetail.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("keeps M12 notices and chat workspaces tokenized and production-backed", () => {
    const surfaces = [
      "components/notices/notices-workspace.tsx",
      "components/forms/communications-form.tsx",
      "components/forms/delivery-retry-panel.tsx",
      "components/forms/notice-detail-links-panel.tsx",
      "components/messaging/parent-teacher-messaging-workspace.tsx",
      "app/dashboard/notices/[noticeId]/page.tsx",
    ];
    const forbidden = [
      /bg-slate-900/,
      /shadow-slate-900/,
      /shadow-2xl/,
      /shadow-xl/,
      /rounded-\[2rem\]/,
      /rounded-\[2\.5rem\]/,
      /rounded-\[30px\]/,
      /primary-(50|100|200|300|400|500|600|700|800|900)/,
      /\bN\/A\b/,
      /\bUnknown\b/,
      /alert\(/,
      /confirm\(/,
      /Coming soon/i,
      /fake/i,
      /mock/i,
    ];

    for (const surface of surfaces) {
      const source = read(surface);

      assert.match(source, /color-mod-notices/);
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${surface} contains ${pattern}`);
      }
    }

    const retryPanel = read("components/forms/delivery-retry-panel.tsx");
    for (const marker of [
      "Batch retry reason",
      "Retry reason is recorded in delivery audit metadata.",
      "RETRY_PENDING",
      "retryReasons",
      "api.retryNotificationDelivery(deliveryId, { reason })",
      "api.retryFailedNotificationDeliveries({ reason })",
    ]) {
      assert.ok(retryPanel.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it("uses the shared M12 workspace shell without browser-derived official totals", () => {
    const workspace = read("components/notices/notices-workspace.tsx");
    const communicationsForm = read("components/forms/communications-form.tsx");
    const messaging = read(
      "components/messaging/parent-teacher-messaging-workspace.tsx",
    );

    for (const marker of [
      "<ModuleHeader",
      "<KpiGrid",
      "<KpiCard",
      "<ModuleTabs",
      "New Notice",
      "moreActionItems",
      "Needs a real M12 summary API",
      "getNotificationDeliveryAnalytics",
    ]) {
      assert.ok(workspace.includes(marker), `Missing marker: ${marker}`);
    }

    assert.match(communicationsForm, /<FilterBar/);
    assert.doesNotMatch(communicationsForm, /delivery\.destination \?\?/);
    assert.doesNotMatch(communicationsForm, /delivery\.sourceId/);
    assert.match(messaging, /TablePagination/);
    assert.match(messaging, /escalated thread is locked/);
  });

  it("removes default emergency sample copy from communications", () => {
    const communicationsForm = read("components/forms/communications-form.tsx");

    assert.doesNotMatch(communicationsForm, /Emergency holiday notice/);
    assert.doesNotMatch(
      communicationsForm,
      /School will remain closed tomorrow/,
    );
    assert.doesNotMatch(communicationsForm, /Parent-teacher meeting/);
    assert.doesNotMatch(communicationsForm, /replace-me/i);
  });

  it("provides a dedicated HR & Payroll workspace with contract and leave management", () => {
    const sidebar = read("components/layout/sidebar.tsx");
    const hrWorkspace = read("components/hr/hr-workspace.tsx");
    const hrOverview = read("components/hr/hr-overview.tsx");
    const contractList = read("components/hr/contract-list.tsx");
    const leaveList = read("components/hr/leave-request-list.tsx");
    const attendanceSummary = read(
      "components/hr/staff-attendance-summary.tsx",
    );
    const staffDetail = read("components/hr/staff-detail-workspace.tsx");
    const hrPage = read("app/dashboard/hr/page.tsx");
    const payrollPage = read("app/dashboard/payroll/page.tsx");
    const payrollApi = read("lib/api/payroll.ts");
    const payslipList = read("components/hr/payslip-list.tsx");

    assert.match(sidebar, /label: 'HR \/ Staff'/);
    assert.match(sidebar, /label: 'Payroll'/);
    assert.match(sidebar, /href: '\/dashboard\/hr'/);
    assert.match(sidebar, /href: '\/dashboard\/payroll'/);
    assert.match(
      sidebar,
      /permissions: \['hr:read', 'payroll:read', 'payroll:manage'\]/,
    );
    assert.match(payrollPage, /PayrollDashboardPage/);
    assert.match(payrollPage, /api\.listPayrollRuns/);
    assert.match(hrOverview, /No run processed/);
    assert.doesNotMatch(hrOverview, /\bN\/A\b/);
    assert.match(
      hrWorkspace,
      /'Staff Directory'|'Contracts'|'Leave Requests'|'Attendance Summary'|'Leave Balances'/,
    );
    assert.match(hrPage, /<ModuleHeader/);
    assert.match(hrPage, /<KpiGrid/);
    assert.match(hrPage, /<ModuleTabs/);
    assert.match(hrPage, /api\.getLeaveQueueDepth/);
    assert.match(hrPage, /api\.listContractExpiryReminders/);
    assert.match(hrPage, /\/dashboard\/payroll\/runs/);
    assert.match(hrPage, /\/dashboard\/payroll\/payslips/);
    assert.match(hrPage, /value="Unavailable"/);
    assert.match(hrPage, /Remaining Issues/);
    assert.doesNotMatch(hrPage, /api\.listStaff\(/);
    assert.doesNotMatch(hrPage, /api\.listLeaveRequests/);
    assert.match(payrollPage, /<ModuleHeader/);
    assert.match(payrollPage, /<KpiGrid/);
    assert.match(payrollPage, /api\.getPayrollReportSummary/);
    assert.match(payrollPage, /salary disbursement remains outside this workspace/i);
    assert.doesNotMatch(payrollPage, /statuses: \['PAID'\]/);
    assert.doesNotMatch(payrollPage, /markPayrollRunPaid|Mark Paid|Disbursement Account Code/);
    assert.match(payrollApi, /listContractExpiryReminders/);
    assert.match(payrollApi, /\/hr\/staff\/contract-expiry\/reminders/);
    assert.match(payrollApi, /getLeaveQueueDepth/);
    assert.match(payrollApi, /\/hr\/leave-queue\/depth/);
    assert.match(payrollApi, /PayrollReportSummary/);

    assert.match(contractList, /api\.listStaffContracts/);
    assert.match(contractList, /api\.listStaff/);
    assert.match(contractList, /api\.createStaffContract/);
    assert.match(contractList, /hasPermissions\(\['payroll:read'\]\)/);
    assert.match(contractList, /hasPermissions\(\['payroll:manage'\]\)/);
    assert.match(contractList, /Restricted/);
    assert.match(contractList, /Base Salary/);
    assert.match(contractList, /Allowances/);
    assert.match(contractList, /bg-black\/40/);
    assert.doesNotMatch(
      contractList,
      /bg-slate-950|bg-slate-900|shadow-xl|shadow-2xl|rounded-3xl|rounded-\[/,
    );

    assert.match(leaveList, /api\.listLeaveRequests/);
    assert.match(leaveList, /api\.approveLeaveRequest/);
    assert.match(leaveList, /api\.rejectLeaveRequest/);
    assert.match(leaveList, /PENDING|APPROVED|REJECTED/);

    const leaveBalanceList = read("components/hr/leave-balance-list.tsx");
    assert.match(leaveBalanceList, /api\.list(Staff|All)LeaveBalances/);
    assert.match(leaveBalanceList, /Entitlement|Used|Pending|Remaining/);

    assert.match(attendanceSummary, /api\.listStaffAttendanceSummary/);
    assert.match(attendanceSummary, /Present|Late|Absent|Leave/);

    assert.match(staffDetail, /api\.listStaffHistory/);
    assert.match(staffDetail, /Lifecycle Audit/);
    assert.match(staffDetail, /staff-history/);

    const payrollPreview = read("components/hr/payroll-preview.tsx");
    assert.match(payrollPreview, /api\.getPayrollPreview/);
    assert.match(payrollPreview, /Preview Only/);
    assert.match(payrollPreview, /No accounting entries/);
    assert.match(payrollPreview, /payroll runs/);
    assert.match(payrollPreview, /created from this screen/);
    assert.match(payrollPreview, /Gross Pay|Net Pay|Deductions/);

    // Negative checks: Payroll preview should be read-only and isolated from direct accounting writes in Phase 2C
    assert.doesNotMatch(
      payrollPreview,
      /api\.approvePayroll|api\.createPayrollRun|api\.postPayrollRun/,
    );
    assert.doesNotMatch(
      payrollPreview,
      /api\.createJournalEntry|api\.getPayslipPdf/,
    );
    assert.doesNotMatch(
      payrollPreview,
      /\/accounting\/journal-entries|\/accounting\/ledger/i,
    );

    const payrollRuns = read("components/hr/payroll-runs.tsx");
    const payrollActionDialog = read("components/hr/payroll-action-dialog.tsx");
    assert.match(payrollRuns, /Post to M11 Accounting/);
    assert.match(
      payrollRuns,
      /Salary disbursement is handled outside this workspace/,
    );
    assert.doesNotMatch(payrollActionDialog, /MARK_PAID|markPayrollRunPaid/);
    assert.doesNotMatch(
      payrollActionDialog,
      /paymentAccountCode|Payment Disbursement Account Code|Mark Paid/,
    );
    assert.match(payslipList, /api\.openPayslipPdf/);
    assert.match(payslipList, /openingPayslip/);
    assert.match(payslipList, /Could not open this protected payslip/);
    assert.doesNotMatch(payslipList, /window\.open|signedUrl|objectKey|bucket/i);

    assert.doesNotMatch(hrWorkspace, /replace-me|demo-staff|fake-contract/i);
    // Note: Payroll processing, salary slips, and M9 accounting auto-posting are deferred to future Phase 2 HR/Accounting work.
    assert.doesNotMatch(
      contractList,
      /api\.createAccountingEntry|api\.postLedger/i,
    );
  });
});
