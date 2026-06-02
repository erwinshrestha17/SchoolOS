import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

function readMany(relativePaths) {
  return relativePaths.map((relativePath) => read(relativePath)).join('\n');
}

function sourceFiles(relativeDir) {
  const root = join(webRoot, relativeDir);
  const entries = readdirSync(root);
  const files = [];

  for (const entry of entries) {
    const absolute = join(root, entry);
    const relative = join(relativeDir, entry);

    if (entry === '.next' || entry === 'node_modules') {
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

describe('SchoolOS web production contracts', () => {
  it('uses a real test command instead of the placeholder script', () => {
    const packageJson = JSON.parse(read('package.json'));

    assert.equal(packageJson.scripts.test, 'node --test test/*.test.mjs');
  });

  it('defaults frontend API traffic to the Nest API on port 4000', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /http:\/\/localhost:4000\/api\/v1/);
    assert.doesNotMatch(apiClient, /http:\/\/localhost:3000\/api\/v1/);
  });

  it('implements the shared UI primitives named by the UI/UX plan', () => {
    const requiredComponents = [
      'action-menu',
      'audit-info',
      'confirm-dialog',
      'data-table',
      'empty-state',
      'export-button',
      'filter-bar',
      'loading-state',
      'locked-record-banner',
      'money-display',
      'notification-badge',
      'page-header',
      'permission-state',
      'report-toolbar',
      'search-input',
      'section-card',
      'stat-card',
      'status-badge',
      'table-pagination',
      'tabs',
      'toast',
    ];

    for (const component of requiredComponents) {
      assert.equal(
        existsSync(join(webRoot, `components/ui/${component}.tsx`)),
        true,
        `Missing shared UI primitive: ${component}`,
      );
    }

    const statusBadge = read('components/ui/status-badge.tsx');
    for (const status of [
      'ACTIVE',
      'PENDING',
      'DRAFT',
      'PUBLISHED',
      'LOCKED',
      'PAID',
      'PARTIAL',
      'UNPAID',
      'OVERDUE',
      'ESCALATED',
    ]) {
      assert.match(statusBadge, new RegExp(status));
    }

    const moneyDisplay = read('components/ui/money-display.tsx');
    assert.match(moneyDisplay, /currency:\s*'NPR'/);

    const dataTable = read('components/ui/data-table.tsx');
    assert.match(dataTable, /isLoading/);
    assert.match(dataTable, /error/);
    assert.match(dataTable, /EmptyState/);
    assert.match(dataTable, /getRowKey/);
  });

  it('keeps operator feedback inside the app UI instead of browser-native prompts', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('components')];

    for (const file of files) {
      assert.doesNotMatch(
        read(file),
        /\b(?:window\.)?(alert|confirm)\s*\(/,
        `${file} should use Toast, ConfirmDialog, or inline status UI instead of alert/confirm`,
      );
    }
  });

  it('keeps Phase 1 and Phase 2 admin dashboard routes present', () => {
    const requiredRoutes = [
      'admissions',
      'attendance',
      'fees',
      'finance',
      'activity',
      'notices',
      'academics',
      'timetable',
      'homework',
      'hr',
      'payroll',
      'accounting',
      'messaging',
      'messages',
      'settings',
    ];

    for (const route of requiredRoutes) {
      assert.equal(
        existsSync(join(webRoot, `app/dashboard/${route}/page.tsx`)),
        true,
        `Missing dashboard route: ${route}`,
      );
    }
  });

  it('exposes client helpers for canonical Phase 1 and Phase 2 workflows', () => {
    const apiClient = read('lib/api.ts');
    const requiredHelpers = [
      'checkAdmissionDuplicates',
      'bulkImportAdmissions',
      'openStudentDocumentPdf',
      'getStudentProfile',
      'getInvoiceDetail',
      'getStudentFeeLedger',
      'refundPayment',
      'previewCashierClose',
      'listCashierCloses',
      'finalizeCashierClose',
      'getAttendanceRoster',
      'syncAttendance',
      'reviewAttendanceConflict',
      'sendDefaulterReminders',
      'openReceiptPdf',
      'listLedgerEntries',
      'createActivityReaction',
      'createDevelopmentalMilestone',
      'getGuardianConsentStatus',
      'createSubject',
      'createExamTerm',
      'enterMark',
      'generateReportCard',
      'createTimetableSlot',
      'listTimetablePeriods',
      'createTimetablePeriod',
      'listRooms',
      'createRoom',
      'listTimetableVersions',
      'createTimetableVersion',
      'validateTimetableVersion',
      'publishTimetableVersion',
      'lockTimetableVersion',
      'archiveTimetableVersion',
      'listTeacherAvailability',
      'createTeacherAvailability',
      'listSubstitutions',
      'createSubstitution',
      'assignSubstitution',
      'createHomework',
      'assignHomework',
      'closeHomework',
      'previewHomeworkReminders',
      'sendHomeworkReminders',
      'getHomeworkAttachmentPreviewUrl',
      'getHomeworkAttachmentDownloadUrl',
      'listHomeworkAssignmentSubmissions',
      'reviewHomeworkSubmissionById',
      'requestHomeworkCorrection',
      'reviewHomeworkSubmission',
      'createStaffContract',
      'createPayrollRun',
      'postPayrollRun',
      'getPayrollPreview',
      'listAccountingReports',
      'createConversation',
      'createMessage',
      'markMessageRead',
      'listStaffHistory',
      'listStaffAttendanceSummary',
      'listLeaveRequests',
      'approveLeaveRequest',
      'rejectLeaveRequest',
      'listStaffLeaveBalances',
      'listPlatformTenants',
      'getPlatformTenantDetail',
      'updatePlatformTenantStatus',
      'getTenantSettings',
      'getPublicTenantSettings',
      'updateTenantSetting',
      'uploadSchoolLogo',
      'getSchoolLogoPreview',
      'getSchoolLogoDownload',
      'removeSchoolLogo',
    ];

    for (const helper of requiredHelpers) {
      assert.match(
        apiClient,
        new RegExp(`${helper}:`),
        `Missing API helper: ${helper}`,
      );
    }
  });

  it('exposes Phase 2B homework and timetable workflow controls without fake production data', () => {
    const timetableBuilder = read(
      'components/timetable/tabs/timetable-builder-tab.tsx',
    );
    const homeworkTab = read('components/timetable/tabs/homework-tab.tsx');
    const studentHomeworkTab = read(
      'components/timetable/tabs/student-homework-tab.tsx',
    );
    const activityForm = read('components/forms/activity-feed-form.tsx');

    for (const label of [
      'Periods',
      'Rooms',
      'Validate',
      'Publish',
      'Lock',
      'Archive',
      'Substitution Management',
    ]) {
      assert.match(timetableBuilder, new RegExp(label));
    }

    for (const label of ['Send Reminder', 'Assign', 'Close', 'All Statuses']) {
      assert.match(homeworkTab, new RegExp(label));
    }

    assert.match(studentHomeworkTab, /getHomeworkAttachmentDownloadUrl/);
    assert.match(studentHomeworkTab, /student-homework-attachment-download/);
    assert.doesNotMatch(studentHomeworkTab, /fileAsset\?\.publicUrl/);
    assert.doesNotMatch(activityForm, /Private object key/);
    assert.doesNotMatch(activityForm, /Photo Reference/);

    assert.doesNotMatch(
      `${timetableBuilder}\n${homeworkTab}\n${studentHomeworkTab}\n${activityForm}`,
      /demo-|fake-|placeholderId/i,
    );
  });

  it('uses in-app feedback for timetable, report export, and accounting safety actions', () => {
    const polishedSurfaces = readMany([
      'components/timetable/versions-list.tsx',
      'components/timetable/substitutions-list.tsx',
      'app/dashboard/reports/page.tsx',
      'components/accounting/chart-of-accounts-view.tsx',
      'components/accounting/journal-entries-view.tsx',
      'components/accounting/journal-detail-dialog.tsx',
    ]);

    for (const marker of [
      'Toast',
      'Version published',
      'Export ready',
      'Seed default chart accounts?',
      'Cancel substitution?',
      'Open fiscal year required',
      'Active fiscal period required',
      'Posting failed',
      'Reversal failed',
      'Correction failed',
    ]) {
      assert.ok(polishedSurfaces.includes(marker), `Missing marker: ${marker}`);
    }

    assert.doesNotMatch(polishedSurfaces, /alert\(/);
    assert.doesNotMatch(polishedSurfaces, /window\.confirm|confirm\(/);
  });

  it('keeps platform administration routes present and secure', () => {
    const platformRoutes = ['dashboard', 'schools'];

    for (const route of platformRoutes) {
      assert.equal(
        existsSync(join(webRoot, `app/platform/${route}/page.tsx`)),
        true,
        `Missing platform route: ${route}`,
      );
    }

    const layout = read('app/platform/layout.tsx');
    assert.match(
      layout,
      /platform_super_admin|platform_support|platform_billing_admin/,
    );
    assert.match(layout, /router\.push\('\/dashboard'\)/);
  });

  it('does not keep raw demo replacement IDs in production-facing forms', () => {
    const formFiles = [
      'components/forms/admission-form.tsx',
      'components/forms/attendance-form.tsx',
      'components/forms/finance-form.tsx',
      'components/forms/activity-feed-form.tsx',
      'components/forms/communications-form.tsx',
      'components/forms/academics-form.tsx',
      'components/forms/timetable-homework-form.tsx',
      'components/forms/payroll-form.tsx',
      'components/forms/accounting-form.tsx',
      'components/forms/messaging-form.tsx',
    ];

    for (const formFile of formFiles) {
      assert.doesNotMatch(
        read(formFile),
        /replace-me/i,
        `${formFile} has a raw replacement ID`,
      );
    }
  });

  it('centralizes browser session storage access in lib/session', () => {
    const files = sourceFiles('.');

    for (const file of files) {
      if (file === 'lib/session.ts' || file.startsWith('test/')) {
        continue;
      }

      assert.doesNotMatch(
        read(file),
        /localStorage|sessionStorage/,
        `${file} touches browser storage directly`,
      );
    }
  });

  it('stores only metadata in browser session state', () => {
    const sessionModule = read('lib/session.ts');

    assert.match(sessionModule, /Omit<AuthSession, 'accessToken'>/);
    assert.match(sessionModule, /toBrowserSession/);
    assert.doesNotMatch(
      sessionModule,
      /JSON\.stringify\(session\)/,
      'raw AuthSession must not be persisted',
    );
  });

  it('parses API JSON error messages before surfacing them to forms', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /parseApiErrorMessage/);
    assert.match(apiClient, /JSON\.parse\(text\)/);
    assert.match(apiClient, /payload\.message/);
    assert.doesNotMatch(
      apiClient,
      /throw new Error\(text \|\| `Request failed/,
    );
  });

  it('uses cookie credentials instead of bearer tokens for browser API calls', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /credentials:\s*'include'/);
    assert.doesNotMatch(apiClient, /Authorization:\s*`Bearer/);
    assert.doesNotMatch(apiClient, /getAccessToken/);
  });

  it('keeps Phase 1 pilot navigation permission-gated and prominent', () => {
    const sidebar = read('components/layout/sidebar.tsx');
    const requiredPhaseOneLabels = [
      'Students',
      'Admissions',
      'Attendance',
      'Fees',
      'Activity Feed',
      'Notices',
      'Settings',
    ];

    assert.match(sidebar, /export const dashboardNavGroups/);
    assert.match(
      sidebar,
      /visibleGroups = filterNavGroups\(dashboardNavGroups\)/,
    );
    assert.match(sidebar, /visiblePlatformItems = platformNavItems\.filter/);
    assert.match(sidebar, /canSeeNavItem\(item, session\)/);
    assert.match(sidebar, /Platform Control/);

    for (const label of requiredPhaseOneLabels) {
      assert.match(sidebar, new RegExp(label.replace('/', '\\/')));
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

  it('guards direct dashboard module URLs with role permissions', () => {
    const layout = read('app/dashboard/layout.tsx');
    const requiredRoutes = [
      '/dashboard/students',
      '/dashboard/admissions',
      '/dashboard/attendance',
      '/dashboard/finance',
      '/dashboard/activity',
      '/dashboard/notices',
      '/dashboard/academics',
      '/dashboard/homework',
      '/dashboard/timetable',
      '/dashboard/hr',
      '/dashboard/payroll',
      '/dashboard/accounting',
      '/dashboard/library',
      '/dashboard/transport',
      '/dashboard/canteen',
      '/dashboard/settings',
    ];

    assert.match(layout, /const dashboardRouteGates/);
    assert.match(layout, /getRouteGateForHref/);
    assert.match(layout, /hasAnyPermission\(session\.user\.permissions/);
    assert.match(layout, /<PermissionDenied/);

    for (const route of requiredRoutes) {
      assert.match(
        layout,
        new RegExp(`prefix: '${route.replaceAll('/', '\\/')}'`),
      );
    }
  });

  it('offers slow session recovery in the dashboard layout', () => {
    const layout = read('app/dashboard/layout.tsx');

    assert.match(layout, /showSlowSessionHelp/);
    assert.match(layout, /setTimeout\(\(\) =>/);
    assert.match(layout, /Retry session/);
    assert.match(layout, /void refreshSession\(\)/);
    assert.match(layout, /Sign in again/);
  });

  it('uses authenticated session metadata and real shell APIs in the header', () => {
    const header = read('components/layout/header.tsx');

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

  it('builds the admin dashboard from real Phase 1 APIs without fake KPI numbers', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const requiredApis = [
      'api.listAcademicYears',
      'api.listClasses',
      'api.listFeePlans',
      'api.listStudents',
      'api.listAdmissions',
      'api.listAttendanceAnalytics',
      'api.listInvoices',
      'api.listDefaulters',
      'api.listReceipts',
      'api.listActivityPosts',
      'api.listNotices',
      'api.listNotificationDeliveries',
    ];

    for (const apiCall of requiredApis) {
      assert.match(dashboard, new RegExp(apiCall.replace('.', '\\.')));
    }

    assert.doesNotMatch(dashboard, /\b847\b/);
    assert.doesNotMatch(dashboard, /94\.2%/);
    assert.doesNotMatch(dashboard, /8,45,000|845000/);
    assert.doesNotMatch(dashboard, /Phase 2 Academic Cycle/);
  });

  it('keeps the dashboard shell polished and routes fee alerts to the canonical fees page', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const shell = read('components/layout/dashboard-shell.tsx');
    const globals = read('app/globals.css');

    assert.match(shell, /Skip to workspace/);
    assert.match(dashboard, /DashboardHeroMetric/);
    assert.match(dashboard, /alertToneStyles/);
    assert.match(dashboard, /href: '\/dashboard\/fees'/);
    assert.doesNotMatch(dashboard, /href: '\/dashboard\/finance'/);
    assert.doesNotMatch(dashboard, /blur-3xl/);
    assert.match(globals, /\.tracking-tight\s*\{\s*letter-spacing: 0;/);
    assert.match(globals, /\.shell-card\s*\{[\s\S]*border-radius: 1rem;/);
  });

  it('keeps admin dashboard quick actions on existing Phase 1 routes', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const requiredRoutes = [
      '/dashboard/admissions',
      '/dashboard/attendance',
      '/dashboard/fees',
      '/dashboard/activity',
      '/dashboard/notices',
      '/dashboard/settings',
    ];

    for (const route of requiredRoutes) {
      assert.match(dashboard, new RegExp(`href: '${route}'`));
    }
  });

  it('handles dashboard setup and empty-data states explicitly', () => {
    const dashboard = read('app/dashboard/page.tsx');

    assert.match(dashboard, /Setup needs attention/);
    assert.match(dashboard, /No alerts available yet/);
    assert.match(dashboard, /No recent operations yet/);
    assert.match(dashboard, /\?\? \[\]/);
  });

  it('keeps admissions enrollment as a multi-step pilot flow', () => {
    const admissionForm = read('components/forms/admission-form.tsx');
    const requiredSteps = [
      'Personal Info',
      'Academic Placement',
      'Guardian Contacts',
      'Documents & Review',
      'Success / Next Actions',
    ];

    assert.match(admissionForm, /const enrollmentSteps = \[/);

    for (const step of requiredSteps) {
      assert.match(admissionForm, new RegExp(step.replace('/', '\\/')));
    }
  });

  it('preserves admissions setup, duplicate warning, and create-anyway behavior', () => {
    const admissionForm = read('components/forms/admission-form.tsx');

    assert.match(admissionForm, /Setup required before enrollment/);
    assert.match(admissionForm, /api\.checkAdmissionDuplicates/);
    assert.match(
      admissionForm,
      /Possible duplicate found|Potential Duplicate Detected/,
    );
    assert.match(admissionForm, /Create anyway|Confirm & Enroll Anyway/);
    assert.match(admissionForm, /setupIsMissing/);
  });

  it('keeps guardian phone validation hints and document review in admissions', () => {
    const admissionForm = read('components/forms/admission-form.tsx');
    const coreValidation = read('../../packages/core/src/validation.ts');

    assert.match(
      coreValidation,
      /guardians: z\.array\(guardianSchema\)\.min\(1\)/,
    );
    assert.match(coreValidation, /primaryPhone: z\.string\(\)\.min\(7\)/);
    assert.match(admissionForm, /Document/);
    assert.match(admissionForm, /Review & Documents/);
    assert.match(admissionForm, /fileToBase64Payload/);
  });

  it('requires iEMIS disability confirmation in the admissions flow', () => {
    const admissionForm = read('components/forms/admission-form.tsx');
    const coreValidation = read('../../packages/core/src/validation.ts');

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

  it('keeps admissions bulk import and success next actions available', () => {
    const admissionForm = read('components/forms/admission-form.tsx');

    assert.match(admissionForm, /Bulk Import/);
    assert.match(admissionForm, /api\.bulkImportAdmissions/);
    assert.match(admissionForm, /confirmNoDisability/);
    assert.match(admissionForm, /Error report CSV/);
    assert.match(admissionForm, /Collect First Fee/);
    assert.match(admissionForm, /Download ID Card/);
    assert.match(admissionForm, /Add Another Student/);
  });

  it('adds a student directory workspace without removing admissions flows', () => {
    const admissionForm = read('components/forms/admission-form.tsx');
    const directory = read('components/forms/student-directory.tsx');

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

  it('keeps student profile and directory actions wired to real helpers', () => {
    const directory = read('components/forms/student-directory.tsx');
    const detailPage = readMany([
      'components/students/student-detail-page.tsx',
      'components/students/profile/tabs/documents-tab.tsx',
      'components/students/profile/tabs/fees-tab.tsx',
    ]);
    const studentsPage = read('app/dashboard/students/page.tsx');

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

  it('adds the Phase 1B student detail route with tabbed profile sections', () => {
    const route = read('app/dashboard/students/[studentId]/page.tsx');
    const detailPage = read('components/students/student-detail-page.tsx');

    assert.equal(
      existsSync(join(webRoot, 'app/dashboard/students/[studentId]/page.tsx')),
      true,
    );
    assert.match(route, /useParams/);
    assert.match(route, /<StudentDetailPage studentId=/);
    assert.match(detailPage, /const detailTabs = \[/);

    for (const tab of [
      'Overview',
      'Guardians',
      'Health',
      'Documents',
      'Fees',
      'Attendance',
      'Activity',
      'History',
    ]) {
      assert.match(detailPage, new RegExp(tab));
    }

    assert.doesNotMatch(detailPage, /replace-me|demo-student|student-123/i);
  });

  it('adds student and guardian edit workflows to the student detail page', () => {
    const detailPage = readMany([
      'components/students/student-detail-page.tsx',
      'components/students/profile/student-edit-card.tsx',
      'components/students/profile/tabs/guardians-tab.tsx',
    ]);
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /updateStudent:/);
    assert.match(apiClient, /method: 'PATCH'/);
    assert.match(apiClient, /updateStudentGuardian:/);
    assert.match(detailPage, /Edit Profile/);
    assert.match(detailPage, /Save Changes/);
    assert.match(detailPage, /System ID|studentSystemId/);
    assert.match(detailPage, /confirmNoDisability/);
    assert.match(detailPage, /Disability Status/);
    assert.match(detailPage, /onEditGuardian/);
    assert.match(detailPage, /onSaveGuardian/);
    assert.match(detailPage, /Primary Guardian|isPrimary/);
    assert.match(detailPage, /error/);
    assert.doesNotMatch(detailPage, /demo-guardian|student-123|guardian-123/i);
  });

  it('adds lifecycle and transfer actions to the student detail page', () => {
    const detailPage = readMany([
      'components/students/student-detail-page.tsx',
      'components/students/profile/lifecycle-panel.tsx',
      'components/students/profile/tabs/documents-tab.tsx',
    ]);
    const apiClient = read('lib/api.ts');

    for (const helper of [
      'getStudentFeeClearance',
      'transferStudent',
      'archiveStudent',
      'archiveStudentAsAlumni',
      'softDeleteStudent',
      'revokeGeneratedStudentDocument',
    ]) {
      assert.match(apiClient, new RegExp(`${helper}:`));
    }

    assert.match(detailPage, /Lifecycle Management/);
    assert.match(detailPage, /Check Fee Clearance/);
    assert.match(detailPage, /Transfer/);
    assert.match(detailPage, /Archive/);
    assert.match(detailPage, /Alumni/);
    assert.match(detailPage, /Soft Delete|delete/);
    assert.match(detailPage, /Transfer Certificate/);
    assert.match(detailPage, /Leaving Certificate/);
    assert.match(detailPage, /Outstanding fees must be cleared/);
    assert.match(detailPage, /softDeleteStudent|delete/);
    assert.doesNotMatch(detailPage, /hard delete|demo-lifecycle|student-123/i);
  });

  it('adds a dedicated student document manager without exposing storage internals', () => {
    const detailPage = readMany([
      'components/students/student-detail-page.tsx',
      'components/students/profile/tabs/documents-tab.tsx',
    ]);
    const apiClient = read('lib/api.ts');

    assert.match(detailPage, /System Generated Docs/);
    assert.match(detailPage, /Uploaded Documents/);
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
    assert.match(apiClient, /revokeGeneratedStudentDocument:/);
    assert.match(apiClient, /openStudentDocumentPdf[\s\S]*openPdfBlob/);
    assert.doesNotMatch(
      detailPage,
      /document\.objectKey|document\.publicUrl|doc\.objectKey|doc\.publicUrl/,
    );
    assert.doesNotMatch(detailPage, /demo-document|document-123/i);
  });

  it('keeps student photo upload private, bounded, and app-controlled', () => {
    const studentEditCard = read('components/students/profile/student-edit-card.tsx');
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /uploadStudentPhoto:/);
    assert.match(apiClient, /removeStudentPhoto:/);
    assert.match(studentEditCard, /STUDENT_PHOTO_MAX_BYTES = 2 \* 1024 \* 1024/);
    assert.match(studentEditCard, /STUDENT_PHOTO_MIME_TYPES/);
    assert.match(studentEditCard, /image\/jpeg/);
    assert.match(studentEditCard, /image\/png/);
    assert.match(studentEditCard, /image\/webp/);
    assert.match(studentEditCard, /data-testid="student-photo-upload-input"/);
    assert.match(studentEditCard, /data-testid="student-photo-remove-button"/);
    assert.match(studentEditCard, /ConfirmDialog/);
    assert.doesNotMatch(studentEditCard, /window\.confirm|alert\(/);
  });

  it('validates PDF responses before opening blob tabs', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /async function openPdfBlob/);
    assert.match(apiClient, /response\.ok/);
    assert.match(apiClient, /content-type/);
    assert.match(apiClient, /application\/pdf/);
    assert.match(apiClient, /blob\.size === 0/);
    assert.match(apiClient, /header !== '%PDF-'/);
    assert.match(apiClient, /parseApiErrorMessage/);
    assert.match(apiClient, /openStudentDocumentPdf[\s\S]*openPdfBlob/);
    assert.match(apiClient, /openReceiptPdf[\s\S]*openPdfBlob/);
  });

  it('keeps attendance screen wired to real roster, submit, sync, analytics, and conflict APIs', () => {
    const attendanceForm = readMany([
      'components/forms/attendance-form.tsx',
      'app/dashboard/attendance/page.tsx',
      'components/attendance/attendance-analytics.tsx',
      'components/attendance/attendance-conflict-review.tsx',
      'components/attendance/attendance-correction-review.tsx',
    ]);
    const requiredApis = [
      'api.listAcademicYears',
      'api.listClasses',
      'api.listSections',
      'api.getAttendanceRoster',
      'api.submitAttendance',
      'api.syncAttendance',
      'api.listAttendanceAnalytics',
      'api.listAttendanceConflicts',
      'api.reviewAttendanceConflict',
      'api.listAttendanceCorrections',
      'api.approveAttendanceCorrection',
      'api.rejectAttendanceCorrection',
    ];

    for (const apiCall of requiredApis) {
      assert.match(attendanceForm, new RegExp(apiCall.replace('.', '\\.')));
    }

    assert.match(attendanceForm, /AttendanceCorrectionReview/);
    assert.match(attendanceForm, /Correction Review Queue/);
    assert.match(attendanceForm, /Required audit reason/);
  });

  it('supports the full Phase 1 attendance exception status cycle', () => {
    const attendanceForm = readMany([
      'components/forms/attendance-form.tsx',
      'components/attendance/attendance-roster-item.tsx',
    ]);
    const statuses = [
      'PRESENT',
      'ABSENT',
      'LATE',
      'SICK_LEAVE',
      'EXCUSED_LEAVE',
      'UNEXCUSED_LEAVE',
    ];

    assert.match(
      attendanceForm,
      /const statusCycle: AttendanceStatus\[\] = \[|STATUS_OPTIONS/,
    );

    for (const status of statuses) {
      assert.match(attendanceForm, new RegExp(status));
    }
  });

  it('blocks future attendance dates and keeps teacher summary labels visible', () => {
    const attendanceForm = readMany([
      'components/forms/attendance-form.tsx',
      'components/attendance/attendance-header.tsx',
      'components/attendance/attendance-roster-item.tsx',
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

  it('keeps offline sync secondary and preserves analytics plus conflict review sections', () => {
    const attendanceForm = readMany([
      'components/forms/attendance-form.tsx',
      'app/dashboard/attendance/page.tsx',
      'components/attendance/attendance-analytics.tsx',
      'components/attendance/attendance-conflict-review.tsx',
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

  it('keeps finance screen wired to real Phase 1 finance APIs', () => {
    const financeForm = read('components/forms/finance-form.tsx');
    const requiredApis = [
      'api.listAcademicYears',
      'api.listClasses',
      'api.listFeeHeads',
      'api.listFeePlans',
      'api.listInvoices',
      'api.getInvoiceDetail',
      'api.listReceipts',
      'api.listLedgerEntries',
      'api.listDefaulters',
      'api.listDiscounts',
      'api.listWaivers',
      'api.createFeeHead',
      'api.createFeePlan',
      'api.generateBillingRun',
      'api.collectPayment',
      'api.previewCashierClose',
      'api.listCashierCloses',
      'api.finalizeCashierClose',
      'api.createDiscount',
      'api.createWaiver',
      'api.sendDefaulterReminders',
      'api.openReceiptPdf',
    ];

    for (const apiCall of requiredApis) {
      assert.match(financeForm, new RegExp(apiCall.replace('.', '\\.')));
    }
  });

  it('builds finance around the collection counter without fake IDs', () => {
    const financeForm = read('components/forms/finance-form.tsx');

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
    assert.doesNotMatch(financeForm, /replace-me/i);
  });

  it('keeps cashier close day-end workflow wired to backend close endpoints', () => {
    const financeForm = read('components/forms/finance-form.tsx');

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

  it('surfaces backend student fee ledger on the student detail page', () => {
    const studentDetail = readMany([
      'components/students/student-detail-page.tsx',
      'components/students/profile/tabs/fees-tab.tsx',
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

  it('blocks overpayment in the finance UI before submitting', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /payment\.amount > outstanding/);
    assert.match(
      financeForm,
      /Payment amount cannot exceed the outstanding balance/,
    );
    assert.match(financeForm, /Payment amount must be greater than zero/);
  });

  it('adds interactive fee-head and period controls to the collection counter dues table', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    for (const marker of [
      'finance-dues-interaction-toolbar',
      'Filter dues by fee head',
      'Filter dues by billing period',
      'Collect line',
      'onQuickCollect',
      'getLineNetDue',
      'Math.min(lineAmount, outstanding)',
    ]) {
      assert.ok(financeForm.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('keeps receipt success, discounts, waivers, and defaulter reminders available', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /Receipt Generated/);
    assert.match(financeForm, /Open receipt PDF/);
    assert.match(financeForm, /Approval reason/);
    assert.match(financeForm, /Approve waiver/);
    assert.match(financeForm, /Remind all filtered/);
    assert.match(financeForm, /Remind selected/);
  });

  it('adds a fee collection export action to the finance screen', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /Export Fee Collection CSV/);
    assert.match(financeForm, /api\.exportReport\('fee-collection-report'/);
    assert.match(financeForm, /History & Reports/);
  });

  it('adds a defaulter aging export action to the finance screen', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /Export Defaulter Aging CSV/);
    assert.match(financeForm, /api\.exportReport\('defaulter-aging-report'/);
    assert.match(financeForm, /asOfDate: new Date\(\)\.toISOString\(\)/);
  });

  it('keeps day-end cashier close PDFs protected and app-opened', () => {
    const financeForm = read('components/forms/finance-form.tsx');
    const cashierCloseSection = read('components/finance/cashier-close-section.tsx');
    const apiService = read('../api/src/finance/finance.service.ts');
    const pdfBuilder = read('../api/src/common/pdf/simple-pdf.ts');
    const coreTypes = read('../../packages/core/src/types.ts');

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

  it('keeps active finance analysis exports app-controlled', () => {
    const duesAnalysis = read('components/finance/dues-analysis-section.tsx');
    const defaulterAging = read('components/finance/defaulter-aging-summary.tsx');

    for (const marker of [
      "api.downloadReport('dues-table-report'",
      'finance-dues-csv-export',
      'Clear filters',
      'exportMutation.error.message',
    ]) {
      assert.ok(duesAnalysis.includes(marker), `Missing dues marker: ${marker}`);
    }

    for (const marker of [
      "api.downloadReport('defaulter-aging-report'",
      'finance-defaulter-aging-csv-export',
      'Export Aging CSV',
      'exportMutation.error.message',
    ]) {
      assert.ok(defaulterAging.includes(marker), `Missing aging marker: ${marker}`);
    }
  });

  it('keeps report-card corrections behind a review dialog with audited reason entry', () => {
    const reportCardsWorkspace = read(
      'components/academics/report-cards/report-cards-workspace.tsx',
    );

    for (const marker of [
      'ReportCardCorrectionDialog',
      'Review Locked Report-Card Correction',
      'Regeneration creates a new report-card version',
      'data-testid="report-card-correction-panel"',
      'data-testid="report-card-correction-reason"',
      'data-testid="report-card-submit-correction"',
      'disabled={isSubmitting || !reason.trim()}',
      'reportCardStudentName',
      'Confirm locked report-card generation',
      'generationStudentIds',
      'Could not load report card PDF',
    ]) {
      assert.ok(
        reportCardsWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }

    assert.doesNotMatch(reportCardsWorkspace, /alert\(/);
    assert.doesNotMatch(reportCardsWorkspace, /confirm\(/);
  });

  it('keeps ledger preview preview-only without direct accounting calls', () => {
    const financeForm = read('components/forms/finance-form.tsx');

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

  it('labels the activity page as Activity Feed instead of Transport', () => {
    const activityPage = read('app/dashboard/activity/page.tsx');

    assert.match(activityPage, /Activity Feed/);
    assert.match(
      activityPage,
      /Photo posts, student tags, mood logs, milestones/,
    );
    assert.doesNotMatch(activityPage, />\s*Transport\s*</);
  });

  it('keeps activity screen wired to real M5 and M10 APIs', () => {
    const activityForm = read('components/forms/activity-feed-form.tsx');
    const requiredApis = [
      'api.listClasses',
      'api.listSections',
      'api.listStudents',
      'api.listActivityPosts',
      'api.listActivityGallery',
      'api.listMoodLogs',
      'api.listDevelopmentalMilestones',
      'api.listNotificationDeliveries',
      'api.createActivityPost',
      'api.createMoodLog',
      'api.createActivityReaction',
      'api.createDevelopmentalMilestone',
      'filesToBase64Payloads',
    ];

    for (const apiCall of requiredApis) {
      assert.match(activityForm, new RegExp(apiCall.replace('.', '\\.')));
    }
  });

  it('keeps canteen POS receipt preview and PDF reprint wired to real APIs', () => {
    const canteenClient = read('lib/canteen-api.ts');
    const canteenWorkspace = read('components/canteen/canteen-workspace.tsx');

    assert.match(canteenClient, /getPosReceipt/);
    assert.match(canteenClient, /openPosReceiptPdf/);
    assert.match(canteenClient, /receipt\.pdf/);
    assert.match(canteenWorkspace, /ReceiptPreview/);
    assert.match(canteenWorkspace, /onReceiptPdf/);
    assert.doesNotMatch(canteenWorkspace, /window\.print/);
  });

  it('keeps canteen reports and CSV exports wired to backend report routes', () => {
    const canteenClient = read('lib/canteen-api.ts');
    const canteenWorkspace = read('components/canteen/canteen-workspace.tsx');

    for (const helper of [
      'getDailyMealCountReport',
      'downloadDailyMealCountCsv',
      'getItemWiseSalesReport',
      'downloadItemWiseSalesCsv',
      'getLowBalanceWallets',
      'getStudentSpendingSummary',
      'getStockLedger',
    ]) {
      assert.match(
        canteenClient,
        new RegExp(`${helper}:`),
        `Missing canteen report helper: ${helper}`,
      );
    }

    for (const endpoint of [
      '/canteen/reports/daily-meal-count',
      '/canteen/reports/daily-meal-count.csv',
      '/canteen/reports/item-wise-sales',
      '/canteen/reports/item-wise-sales.csv',
      '/canteen/reports/low-balance-wallets',
      '/canteen/reports/student-spending-summary',
      '/canteen/reports/stock-ledger',
    ]) {
      assert.match(canteenClient, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    for (const marker of [
      'canteen-daily-meal-csv-export',
      'canteen-item-sales-csv-export',
      'Report range from',
      'Report range to',
      'Low-balance wallets',
      'stockLedgerRows.slice(0, 10).map',
    ]) {
      assert.ok(canteenWorkspace.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('routes linked canteen meal-plan invoices into the finance counter', () => {
    const canteenWorkspace = read('components/canteen/canteen-workspace.tsx');
    const financePage = read('app/dashboard/finance/page.tsx');
    const collectionSection = read('components/finance/collection-section.tsx');
    const collectionCounter = read('components/finance/collection-counter.tsx');

    assert.match(canteenWorkspace, /Open invoice/);
    assert.match(canteenWorkspace, /\/dashboard\/finance\?invoiceId=/);
    assert.match(financePage, /useSearchParams/);
    assert.match(financePage, /initialInvoiceId/);
    assert.match(collectionSection, /initialInvoiceId/);
    assert.match(collectionCounter, /linkedInvoice/);
    assert.match(collectionCounter, /selectedInvoiceId === initialInvoiceId/);
  });

  it('adds accounting audit summary context and richer log detail fields', () => {
    const auditWorkspace = read(
      'components/accounting/accounting-audit-workspace.tsx',
    );

    for (const marker of [
      'AuditSummaryCard',
      'Records on page',
      'activeFilterLabel',
      'data-testid="accounting-audit-page-summary"',
      'AuditDetailField',
      'Tenant scope',
      'Resource ID',
      'Actor ID',
    ]) {
      assert.ok(auditWorkspace.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('makes transport latest-location freshness explicit for operators', () => {
    const transportWorkspace = read(
      'components/transport/transport-workspace.tsx',
    );

    for (const marker of [
      'transport-location-freshness-panel',
      'getLocationFreshness',
      'LocationMetric',
      'Latest backend coordinate is fresh enough',
      'Confirm with the driver before sharing transport updates',
      'Treat the trip position as approximate',
    ]) {
      assert.ok(
        transportWorkspace.includes(marker),
        `Missing marker: ${marker}`,
      );
    }
  });

  it('keeps transport route operations and trip report exports backend-backed', () => {
    const transportClient = read('lib/transport-api.ts');
    const transportWorkspace = read('components/transport/transport-workspace.tsx');

    for (const helper of [
      'getTripHistoryReport',
      'downloadTripHistoryCsv',
      'getBoardingReport',
      'getReports',
    ]) {
      assert.match(
        transportClient,
        new RegExp(`${helper}:`),
        `Missing transport report helper: ${helper}`,
      );
    }

    for (const endpoint of [
      '/transport/reports',
      '/transport/reports/trips',
      '/transport/reports/trips.csv',
      '/transport/reports/boarding',
    ]) {
      assert.match(transportClient, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    for (const marker of [
      'transport-route-dashboard-panel',
      'RouteOperationsPanel',
      'Report filters',
      'transport-trip-history-csv-export',
      'Export full trip CSV',
      'Trip-history CSV export uses server-side generation',
      'setReportRouteId',
      'setReportVehicleId',
      'setReportDriverAssignmentId',
    ]) {
      assert.ok(transportWorkspace.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('keeps canteen Serving and POS QR scan flows fast and backend-purpose compatible', () => {
    const canteenWorkspace = read('components/canteen/canteen-workspace.tsx');
    const resolver = read('components/ui/qr-resolver.tsx');

    for (const marker of [
      'CanteenQrStudentCard',
      'resolvedServingStudent',
      'resolvedPosStudent',
      'canteen-serving-control-preview',
      'Scan a student QR; the serving form stays ready',
      'Scan student QR to select wallet payment',
      '!posForm.studentId',
      '!posForm.items[0]?.menuItemId',
      'Number(posForm.items[0]?.quantity ?? 0) <= 0',
    ]) {
      assert.ok(canteenWorkspace.includes(marker), `Missing marker: ${marker}`);
    }

    assert.match(
      resolver,
      /purpose === 'CANTEEN_POS' \|\| purpose === 'CANTEEN_SERVE'/,
    );
    assert.match(resolver, /return 'CANTEEN'/);
  });

  it('keeps canteen inventory and supplier surfaces wired to real APIs', () => {
    const canteenClient = read('lib/canteen-api.ts');
    const canteenWorkspace = read('components/canteen/canteen-workspace.tsx');

    for (const helper of [
      'listSuppliers',
      'createSupplier',
      'listInventoryItems',
      'createInventoryItem',
      'createPurchaseBill',
      'recordWastage',
      'adjustStock',
      'getStockLedger',
    ]) {
      assert.match(
        canteenClient,
        new RegExp(`${helper}:`),
        `Missing canteen helper: ${helper}`,
      );
    }

    for (const endpoint of [
      '/canteen/suppliers',
      '/canteen/inventory-items',
      '/canteen/purchase-bills',
      '/canteen/wastage',
      '/canteen/stock-adjustment',
      '/canteen/reports/stock-ledger',
    ]) {
      assert.match(canteenClient, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    assert.match(canteenWorkspace, /supplierMutation/);
    assert.match(canteenWorkspace, /inventoryItemMutation/);
    assert.match(canteenWorkspace, /purchaseBillMutation/);
    assert.match(canteenWorkspace, /wastageMutation/);
    assert.match(canteenWorkspace, /stockAdjustmentMutation/);
    assert.match(canteenWorkspace, /Stock ledger/);
    assert.equal(
      existsSync(join(webRoot, 'app/dashboard/canteen/inventory/page.tsx')),
      true,
    );
    assert.doesNotMatch(
      canteenWorkspace,
      /Inventory Later|Rice \(Premium\)|Cooking Oil/,
    );
  });

  it('keeps activity categories and upload limits explicit', () => {
    const activityForm = read('components/forms/activity-feed-form.tsx');
    const categories = [
      'LEARNING',
      'OUTDOOR_PLAY',
      'ART_AND_CRAFT',
      'CELEBRATION',
      'SPORTS',
      'GENERAL',
    ];

    for (const category of categories) {
      assert.match(activityForm, new RegExp(category));
    }

    assert.match(activityForm, /Attach 1 to 5 images/);
    assert.match(activityForm, /selectedFiles\.length > 5/);
    assert.match(activityForm, /file\.type\.startsWith\('image\/'\)/);
    assert.match(activityForm, /10MB/);
  });

  it('preserves feed preview, media gallery, mood logs, milestones, and delivery records', () => {
    const activityForm = read('components/forms/activity-feed-form.tsx');

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

  it('does not implement AI captions or permanent public media URLs in activity feed', () => {
    const activityForm = read('components/forms/activity-feed-form.tsx');

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

  it('keeps notices screen wired to real M10 APIs', () => {
    const communicationsForm = read('components/forms/communications-form.tsx');
    const requiredApis = [
      'api.listClasses',
      'api.listSections',
      'api.listNotificationDeliveries',
      'api.listNotices',
      'api.listEvents',
      'api.listAdmissions',
      'api.getGuardianConsentStatus',
      'api.createNotice',
      'api.createEvent',
      'api.captureGuardianConsent',
      'api.revokeGuardianConsent',
    ];

    for (const apiCall of requiredApis) {
      assert.match(communicationsForm, new RegExp(apiCall.replace('.', '\\.')));
    }
  });

  it('keeps communications sections and notice audience controls available', () => {
    const communicationsForm = read('components/forms/communications-form.tsx');
    const requiredSections = [
      'Notices',
      'Events',
      'Delivery Records',
      'Consent Management',
    ];
    const priorities = ['NORMAL', 'URGENT', 'EMERGENCY'];
    const audiences = ['ALL', 'CLASS', 'SECTION'];

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
      /Emergency notices may trigger forced delivery channels/,
    );
    assert.match(communicationsForm, /Publish notice/);
    assert.match(communicationsForm, /Schedule notice/);
  });

  it('preserves events, delivery records, and consent management behavior', () => {
    const communicationsForm = read('components/forms/communications-form.tsx');
    const deliveryStatuses = [
      'QUEUED',
      'SENT',
      'FAILED',
      'SKIPPED',
      'PENDING',
      'RETRYING',
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

  it('keeps parent-teacher messaging moderation and escalation decisions explicit', () => {
    const messaging = read(
      'components/messaging/parent-teacher-messaging-workspace.tsx',
    );

    for (const marker of [
      'chat-moderation-decision-panel',
      'Safety & Escalation Queue',
      'getModerationDecision',
      'Concern reason',
      'Moderation reason',
      'Escalation reason',
      'Thread closed with an audited moderation reason.',
      'Thread escalated for school leadership review.',
      'Escalated thread needs owner review',
    ]) {
      assert.ok(messaging.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('keeps notice unread recipient follow-up controls available', () => {
    const noticeDetail = read('app/dashboard/notices/[noticeId]/page.tsx');

    for (const marker of [
      'notice-unread-recipient-controls',
      'Search unread notice recipients',
      'Filter unread recipients by channel',
      'Filter unread recipients by class',
      'Follow-up queue:',
      'visible delivery records failed',
      'visible recipients need contact cleanup',
      'Contact:',
      'No unread recipients match these filters',
    ]) {
      assert.ok(noticeDetail.includes(marker), `Missing marker: ${marker}`);
    }
  });

  it('removes default emergency sample copy from communications', () => {
    const communicationsForm = read('components/forms/communications-form.tsx');

    assert.doesNotMatch(communicationsForm, /Emergency holiday notice/);
    assert.doesNotMatch(
      communicationsForm,
      /School will remain closed tomorrow/,
    );
    assert.doesNotMatch(communicationsForm, /Parent-teacher meeting/);
    assert.doesNotMatch(communicationsForm, /replace-me/i);
  });

  it('provides a dedicated HR & Payroll workspace with contract and leave management', () => {
    const sidebar = read('components/layout/sidebar.tsx');
    const hrWorkspace = read('components/hr/hr-workspace.tsx');
    const contractList = read('components/hr/contract-list.tsx');
    const leaveList = read('components/hr/leave-request-list.tsx');
    const attendanceSummary = read(
      'components/hr/staff-attendance-summary.tsx',
    );
    const staffDetail = read('components/hr/staff-detail-workspace.tsx');
    const page = read('app/dashboard/payroll/page.tsx');

    assert.match(sidebar, /label: 'HR \/ Staff'/);
    assert.match(sidebar, /label: 'Payroll'/);
    assert.match(sidebar, /href: '\/dashboard\/hr'/);
    assert.match(sidebar, /href: '\/dashboard\/payroll'/);
    assert.match(
      sidebar,
      /permissions: \['hr:read', 'payroll:read', 'payroll:manage'\]/,
    );
    assert.match(page, /PayrollDashboardPage/);
    assert.match(page, /api\.listPayrollRuns/);
    assert.match(
      hrWorkspace,
      /'Staff Directory'|'Contracts'|'Leave Requests'|'Attendance Summary'|'Leave Balances'/,
    );

    assert.match(contractList, /api\.listStaffContracts/);
    assert.match(contractList, /api\.createStaffContract/);
    assert.match(contractList, /Base Salary/);
    assert.match(contractList, /Allowances/);

    assert.match(leaveList, /api\.listLeaveRequests/);
    assert.match(leaveList, /api\.approveLeaveRequest/);
    assert.match(leaveList, /api\.rejectLeaveRequest/);
    assert.match(leaveList, /PENDING|APPROVED|REJECTED/);

    const leaveBalanceList = read('components/hr/leave-balance-list.tsx');
    assert.match(leaveBalanceList, /api\.list(Staff|All)LeaveBalances/);
    assert.match(leaveBalanceList, /Entitlement|Used|Pending|Remaining/);

    assert.match(attendanceSummary, /api\.listStaffAttendanceSummary/);
    assert.match(attendanceSummary, /Present|Late|Absent|Leave/);

    assert.match(staffDetail, /api\.listStaffHistory/);
    assert.match(staffDetail, /Lifecycle Audit/);
    assert.match(staffDetail, /staff-history/);

    const payrollPreview = read('components/hr/payroll-preview.tsx');
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

    assert.doesNotMatch(hrWorkspace, /replace-me|demo-staff|fake-contract/i);
    // Note: Payroll processing, salary slips, and M9 accounting auto-posting are deferred to future Phase 2 HR/Accounting work.
    assert.doesNotMatch(
      contractList,
      /api\.createAccountingEntry|api\.postLedger/i,
    );
  });
});
