import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Student profile overview layout contract', () => {
  it('uses independently sized rows and school-friendly overview copy', () => {
    const overview = read('components/students/profile/tabs/overview-tab.tsx');

    assert.match(overview, /className="space-y-6"/);
    assert.ok(
      (
        overview.match(
          /<section className="grid items-start gap-6 xl:grid-cols-/g,
        ) ?? []
      ).length >= 3,
    );
    assert.doesNotMatch(overview, /<StudentQrCard/);
    assert.match(
      overview,
      /Information that should be completed or reviewed\./,
    );
    assert.match(
      overview,
      /Key information from this student's current school record\./,
    );
    assert.match(overview, /Current enrollment and recent student activity\./);
    assert.doesNotMatch(
      overview,
      /Backend-owned summary values|profile-contract signals|according to the fee-clearance API/,
    );
  });

  it('keeps identity compact on Overview and routes advanced controls to a dedicated workspace', () => {
    const overview = read('components/students/profile/tabs/overview-tab.tsx');
    const detail = read('components/students/student-detail-page.tsx');
    const identityPage = read('components/students/student-identity-page.tsx');
    const identityRoute = read(
      'app/dashboard/students/[studentId]/identity/page.tsx',
    );

    assert.match(overview, /StudentIdentitySummary/);
    assert.match(overview, /Preview ID card/);
    assert.match(overview, /Manage identity/);
    assert.match(overview, /ProtectedFileButton/);
    assert.match(
      overview,
      /\/dashboard\/students\/\$\{encodeURIComponent\(profile\.student\.id\)\}\/identity/,
    );
    assert.match(detail, /label: ["']Identity & QR["']/);
    assert.match(
      detail,
      /router\.push\([\s\S]*`\/dashboard\/students\/\$\{encodeURIComponent\(studentId\)\}\/identity`/,
    );
    assert.match(identityPage, /<StudentQrCard/);
    assert.match(identityPage, /Back to student profile/);
    assert.match(identityRoute, /<StudentIdentityPage/);
  });

  it('shows only backend-backed lifecycle events with a compact empty state', () => {
    const overview = read('components/students/profile/tabs/overview-tab.tsx');
    const studentsApi = read('lib/api/students.ts');

    assert.match(studentsApi, /getStudentLifecycleTimeline/);
    assert.match(overview, /api\.getStudentLifecycleTimeline\(studentId\)/);
    assert.match(overview, /query\.data\.slice\(0, 3\)/);
    assert.match(overview, /No recent profile activity/);
    assert.match(
      overview,
      /Changes to enrollment, guardians and documents will appear here\./,
    );
  });
});
