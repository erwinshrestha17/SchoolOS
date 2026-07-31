import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

const NOTICE_SURFACES = [
  'components/notices/notices-workspace.tsx',
  'components/notices/notice-composer-workspace.tsx',
  'components/notices/notice-review-workspace.tsx',
  'components/notices/notice-acknowledgement-panel.tsx',
  'app/dashboard/notices/[noticeId]/page.tsx',
];

const ATTENDANCE_SURFACES = [
  'components/attendance/attendance-m2-workspaces.tsx',
];

describe('Slice 2 attendance authorization UI', () => {
  it('uses canonical attendance capabilities instead of raw permission sets', () => {
    for (const path of ATTENDANCE_SURFACES) {
      const source = read(path);
      assert.doesNotMatch(
        source,
        /permissions\.includes\(/,
        `${path} must not use raw permissions.includes`,
      );
      assert.doesNotMatch(
        source,
        /new Set\(.*permissions/,
        `${path} must not build raw permission sets`,
      );
    }

    const workspaces = read('components/attendance/attendance-m2-workspaces.tsx');
    assert.match(workspaces, /useAttendanceCapabilities/);
    assert.match(workspaces, /attendance\.canManageAll/);
  });
});

describe('Slice 2 notices authorization UI', () => {
  it('uses canonical notice capabilities instead of raw permission sets', () => {
    for (const path of NOTICE_SURFACES) {
      const source = read(path);
      assert.doesNotMatch(
        source,
        /permissions\.includes\(/,
        `${path} must not use raw permissions.includes`,
      );
      assert.doesNotMatch(
        source,
        /granted\.has\(/,
        `${path} must not use raw granted.has checks`,
      );
      assert.doesNotMatch(
        source,
        /new Set\(.*permissions/,
        `${path} must not build raw permission sets`,
      );
    }
  });

  it('limits teacher audience options to assigned scope without whole-school targeting', () => {
    const composer = read('components/notices/notice-composer-workspace.tsx');

    assert.match(composer, /useNoticeCapabilities\(\{ isTeacherPersona \}\)/);
    assert.match(composer, /noticeCaps\.allowedAudienceTypes\.map/);
    assert.match(composer, /!noticeCaps\.allowedAudienceTypes\.includes\(form\.audienceType\)/);
    assert.doesNotMatch(composer, /<option value="ALL">Whole school<\/option>/);
  });

  it('keeps approval and publication actions on separate capabilities', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');
    const review = read('components/notices/notice-review-workspace.tsx');

    assert.match(detail, /noticeCaps\.canApprove/);
    assert.match(detail, /noticeCaps\.canPublish/);
    assert.match(detail, /noticeCaps\.canSchedule/);
    assert.match(review, /noticeCaps\.canPublish/);
    assert.match(review, /noticeCaps\.canSchedule/);
    assert.match(review, /Submit for approval/);
  });

  it('fails closed on direct notice routes while permissions resolve', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');
    const composer = read('components/notices/notice-composer-workspace.tsx');
    const review = read('components/notices/notice-review-workspace.tsx');

    assert.match(detail, /noticeCaps\.resolution === "loading"/);
    assert.match(detail, /!noticeCaps\.canView/);
    assert.match(composer, /noticeCaps\.resolution === "loading"/);
    assert.match(review, /noticeCaps\.resolution === "loading"/);
  });
});
