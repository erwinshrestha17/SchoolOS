import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
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

  it('keeps Phase 1 and Phase 2 admin dashboard routes present', () => {
    const requiredRoutes = [
      'admissions',
      'attendance',
      'finance',
      'activity',
      'notices',
      'academics',
      'timetable',
      'payroll',
      'accounting',
      'messaging',
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
      'createHomework',
      'reviewHomeworkSubmission',
      'createStaffContract',
      'createPayrollRun',
      'postPayrollRun',
      'listAccountingReports',
      'createConversation',
      'createMessage',
      'markMessageRead',
    ];

    for (const helper of requiredHelpers) {
      assert.match(apiClient, new RegExp(`${helper}:`), `Missing API helper: ${helper}`);
    }
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
      assert.doesNotMatch(read(formFile), /replace-me/i, `${formFile} has a raw replacement ID`);
    }
  });

  it('centralizes browser session storage access in lib/session', () => {
    const files = sourceFiles('.');

    for (const file of files) {
      if (file === 'lib/session.ts' || file.startsWith('test/')) {
        continue;
      }

      assert.doesNotMatch(read(file), /localStorage|sessionStorage/, `${file} touches browser storage directly`);
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

  it('uses cookie credentials instead of bearer tokens for browser API calls', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /credentials:\s*'include'/);
    assert.doesNotMatch(apiClient, /Authorization:\s*`Bearer/);
    assert.doesNotMatch(apiClient, /getAccessToken/);
  });

  it('keeps Phase 1 pilot navigation permission-gated and prominent', () => {
    const sidebar = read('components/layout/sidebar.tsx');
    const requiredPhaseOneLabels = [
      'Students / Admissions',
      'Attendance',
      'Fee Collection',
      'Activity Feed',
      'Notices',
      'Settings',
    ];

    assert.match(sidebar, /export const dashboardNavItems/);
    assert.match(sidebar, /visiblePrimaryItems = dashboardNavItems\.filter/);
    assert.match(sidebar, /canSeeNavItem\(item, session\)/);

    for (const label of requiredPhaseOneLabels) {
      assert.match(sidebar, new RegExp(label.replace('/', '\\/')));
    }

    assert.match(sidebar, /href: '\/dashboard\/activity'/);
    assert.doesNotMatch(
      sidebar,
      /label: 'Transport'[\s\S]*href: '\/dashboard\/activity'/,
      'Transport must not point at the Activity Feed route',
    );
    assert.doesNotMatch(
      sidebar,
      /label: 'Library'[\s\S]*href: '\/dashboard\/timetable'/,
      'Library must not point at the Timetable route',
    );
  });

  it('uses authenticated session metadata and real shell APIs in the header', () => {
    const header = read('components/layout/header.tsx');

    assert.match(header, /const \{ hasPermissions, session, logout \} = useSession\(\)/);
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

  it('keeps admin dashboard quick actions on existing Phase 1 routes', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const requiredRoutes = [
      '/dashboard/admissions',
      '/dashboard/attendance',
      '/dashboard/finance',
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
    assert.match(admissionForm, /Possible duplicate found/);
    assert.match(admissionForm, /Create anyway/);
    assert.match(admissionForm, /setupIsMissing/);
  });

  it('keeps guardian phone validation hints and document review in admissions', () => {
    const admissionForm = read('components/forms/admission-form.tsx');

    assert.match(admissionForm, /At least one guardian with a valid phone number is required/);
    assert.match(admissionForm, /Required phone number/);
    assert.match(admissionForm, /Document/);
    assert.match(admissionForm, /ReviewCard/);
    assert.match(admissionForm, /formatFileSize/);
  });

  it('keeps admissions bulk import and success next actions available', () => {
    const admissionForm = read('components/forms/admission-form.tsx');

    assert.match(admissionForm, /Bulk Import/);
    assert.match(admissionForm, /api\.bulkImportAdmissions/);
    assert.match(admissionForm, /Error report CSV/);
    assert.match(admissionForm, /Collect First Fee/);
    assert.match(admissionForm, /Download ID Card/);
    assert.match(admissionForm, /Add Another Student/);
  });

  it('keeps attendance screen wired to real roster, submit, sync, analytics, and conflict APIs', () => {
    const attendanceForm = read('components/forms/attendance-form.tsx');
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
    ];

    for (const apiCall of requiredApis) {
      assert.match(attendanceForm, new RegExp(apiCall.replace('.', '\\.')));
    }
  });

  it('supports the full Phase 1 attendance exception status cycle', () => {
    const attendanceForm = read('components/forms/attendance-form.tsx');
    const statuses = [
      'PRESENT',
      'ABSENT',
      'LATE',
      'SICK_LEAVE',
      'EXCUSED_LEAVE',
      'UNEXCUSED_LEAVE',
    ];

    assert.match(attendanceForm, /const statusCycle = \[/);

    for (const status of statuses) {
      assert.match(attendanceForm, new RegExp(status));
    }
  });

  it('blocks future attendance dates and keeps teacher summary labels visible', () => {
    const attendanceForm = read('components/forms/attendance-form.tsx');

    assert.match(attendanceForm, /max=\{today\}/);
    assert.match(attendanceForm, /Future dates cannot be submitted/);
    assert.match(attendanceForm, /Present/);
    assert.match(attendanceForm, /Absent/);
    assert.match(attendanceForm, /Late/);
    assert.match(attendanceForm, /Leave/);
    assert.match(attendanceForm, /exceptions only/);
  });

  it('keeps offline sync secondary and preserves analytics plus conflict review sections', () => {
    const attendanceForm = read('components/forms/attendance-form.tsx');

    assert.match(attendanceForm, /<details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">/);
    assert.match(attendanceForm, /Sync offline draft/);
    assert.match(attendanceForm, /Recent Attendance Analytics/);
    assert.match(attendanceForm, /Conflict Review/);
    assert.match(attendanceForm, /Attendance Risk Alerts/);
    assert.match(attendanceForm, /Mark reviewed/);
  });

  it('keeps finance screen wired to real Phase 1 finance APIs', () => {
    const financeForm = read('components/forms/finance-form.tsx');
    const requiredApis = [
      'api.listAcademicYears',
      'api.listClasses',
      'api.listFeeHeads',
      'api.listFeePlans',
      'api.listInvoices',
      'api.listReceipts',
      'api.listLedgerEntries',
      'api.listDefaulters',
      'api.listDiscounts',
      'api.listWaivers',
      'api.createFeeHead',
      'api.createFeePlan',
      'api.generateBillingRun',
      'api.collectPayment',
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
    assert.match(financeForm, /Search by name, SCH-YYYY-NNNN, or invoice number/);
    assert.match(financeForm, /Confirm Payment & Generate Receipt/);
    assert.match(financeForm, /No fake production IDs are used/);
    assert.doesNotMatch(financeForm, /replace-me/i);
  });

  it('blocks overpayment in the finance UI before submitting', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /payment\.amount > outstanding/);
    assert.match(financeForm, /Payment amount cannot exceed the outstanding balance/);
    assert.match(financeForm, /Payment amount must be greater than zero/);
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

  it('keeps ledger preview preview-only without direct accounting calls', () => {
    const financeForm = read('components/forms/finance-form.tsx');

    assert.match(financeForm, /Ledger Entry Preview/);
    assert.match(financeForm, /Preview only - backend posts final ledger entry/);
    assert.doesNotMatch(financeForm, /api\.createAccounting|api\.closeAccounting|api\.listAccountingReports/);
  });
});
