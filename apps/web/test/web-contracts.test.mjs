import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
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
});
