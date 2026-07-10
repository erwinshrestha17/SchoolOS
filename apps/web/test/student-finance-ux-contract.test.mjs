import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Student profile to finance collection UX contract', () => {
  it('uses backend fee clearance before exposing Collect fees', () => {
    const detail = read('components/students/student-detail-page.tsx');
    const header = read('components/students/profile/profile-header.tsx');

    assert.match(detail, /api\.getStudentFeeClearance\(studentId\)/);
    assert.match(detail, /enabled: Boolean\(studentId\)/);
    assert.match(header, /feeClearance && !feeClearance\.cleared && feeClearance\.outstandingAmount > 0/);
    assert.match(header, /label: 'Collect fees'/);
    assert.match(header, /\/dashboard\/fees\/collect\?studentId=\$\{encodeURIComponent\(student\.id\)\}&source=student-profile/);
    assert.match(header, /label: 'View fee history'/);
    assert.doesNotMatch(header, /items=\{\[\s*\{\s*label: 'Collect fees'[\s\S]*router\.push/);
  });

  it('keeps finance collection contextual for selected students', () => {
    const page = read('components/finance/fees-workspace.tsx');
    const section = read('components/finance/collection-section.tsx');
    const counter = read('components/finance/collection-counter.tsx');
    const financeApi = read('lib/api/finance.ts');

    assert.match(financeApi, /\/fees\/students\/\$\{encodeURIComponent\(studentId\)\}\/collection-context/);
    assert.match(page, /section === "collect" && canCollect/);
    assert.match(page, /enabled: Boolean\(studentId\)/);
    assert.match(page, /updateUrl\(\{ studentId: null, source: null, invoiceId: null \}\)/);
    assert.match(page, /<CollectionStudentDiscovery/);
    assert.match(page, /key=\{`student-\$\{studentId\}`\}/);
    assert.match(section, /isStudentContextMode\s*\?\s*\(studentCollectionContext\?\.invoices \?\? \[\]\)/);
    assert.match(counter, /Collecting fees for:\s*\{studentContext\.name\}/);
    assert.match(counter, /\{studentContext\.studentSystemId\}/);
    assert.match(counter, /invoices\.length === 1 && selectedInvoiceId !== invoices\[0\]\.id/);
    assert.match(counter, /Choose an invoice to collect payment\./);
    assert.match(counter, /This student has no outstanding invoices\./);
    assert.match(counter, /invoices\.length === 0 && !isLoading && !studentContext/);
  });

  it('normalizes profile labels and persisted relation copy', () => {
    const header = read('components/students/profile/profile-header.tsx');
    const profileTab = read('components/students/profile/tabs/profile-tab.tsx');
    const overview = read('components/students/profile/tabs/overview-tab.tsx');
    const guardians = read('components/students/profile/tabs/guardians-tab.tsx');

    assert.match(header, /function formatClassLabel/);
    assert.match(profileTab, /formatClassLabel\(className\)/);
    assert.match(overview, /formatClassLabel\(currentEnrollment\.className\)/);
    assert.doesNotMatch(profileTab, /`Class \$\{className\}`/);
    assert.match(profileTab, /currentEnrollment\.status \? \(/);
    assert.match(header, /formatGuardianRelation\(primaryGuardian\.relation\)/);
    assert.match(guardians, /formatGuardianRelation\(guardian\.relation\)/);
    assert.match(guardians, /value="FATHER">Father/);
  });

  it('keeps attendance and documents inside student-profile context', () => {
    const detail = read('components/students/student-detail-page.tsx');
    const attendance = read('components/students/profile/tabs/attendance-tab.tsx');
    const documents = read('components/students/profile/tabs/documents-tab.tsx');
    const overview = read('components/students/profile/tabs/overview-tab.tsx');

    assert.match(detail, /AttendanceTab\s+profile=\{profile\}/);
    assert.match(attendance, /Back to profile/);
    assert.match(attendance, /\{studentName\} · \{student\.studentSystemId\} · \{classSection \|\| 'Class not assigned'\}/);
    assert.match(overview, /Review iEMIS fields/);
    assert.match(documents, /Upload required documents/);
    assert.match(documents, /Replace/);
    assert.match(documents, /Generate ID card/);
    assert.match(documents, /Generate transfer certificate/);
    assert.match(documents, /Generate character certificate/);
    assert.match(documents, /No required document issues are visible from uploaded records/);
    assert.doesNotMatch(documents, /Required student documents are verified and current/);
  });

  it('renders ActionMenu through a viewport-aware portal', () => {
    const menu = read('components/ui/action-menu.tsx');

    assert.match(menu, /createPortal/);
    assert.match(menu, /document\.body/);
    assert.match(menu, /getBoundingClientRect/);
    assert.match(menu, /window\.addEventListener\('scroll', updatePosition, true\)/);
    assert.match(menu, /window\.addEventListener\('resize', updatePosition\)/);
    assert.match(menu, /spaceBelow < menuHeight && spaceAbove > spaceBelow/);
    assert.match(menu, /z-\[2147483647\]/);
    assert.match(menu, /aria-haspopup': 'menu'/);
    assert.match(menu, /aria-expanded': open/);
    assert.match(menu, /event\.key === 'Escape'/);
    assert.match(menu, /ArrowDown/);
    assert.match(menu, /minWidth: MENU_MIN_WIDTH/);
  });
});
