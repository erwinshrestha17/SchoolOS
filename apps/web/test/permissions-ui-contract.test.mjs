import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('canonical permissions UI layer', () => {
  it('evaluates permissions through alias-aware session helpers', () => {
    const permissionsUi = read('lib/permissions-ui.ts');

    assert.match(permissionsUi, /from "@\/lib\/session"/);
    assert.match(permissionsUi, /hasPermission\(session, permission\)/);
    assert.match(permissionsUi, /hasAnyPermission\(session, permissions\)/);
    assert.match(permissionsUi, /export function resolveSessionPermissions/);
    assert.doesNotMatch(permissionsUi, /permissions\.includes\(/);
    assert.doesNotMatch(permissionsUi, /new Set\(.*permissions/);
  });

  it('fails closed while session permission context is unresolved', () => {
    const permissionsUi = read('lib/permissions-ui.ts');
    const dashboardPage = read('app/dashboard/page.tsx');

    assert.match(permissionsUi, /export type PermissionResolution = "loading" \| "denied" \| "granted"/);
    assert.match(permissionsUi, /if \(sessionStatus === "loading"\)/);
    assert.match(permissionsUi, /if \(access\.resolution !== "granted"\)/);
    assert.match(dashboardPage, /permissionResolution === "loading"/);
    assert.match(dashboardPage, /enabled: !isTeacherPersona && permissionResolution === "granted"/);
  });

  it('separates notice approval from publication capabilities', () => {
    const permissionsUi = read('lib/permissions-ui.ts');

    assert.match(permissionsUi, /canApprove:/);
    assert.match(permissionsUi, /canPublish:/);
    assert.match(permissionsUi, /canSchedule:/);
    assert.match(permissionsUi, /"notices:approve"/);
    assert.match(permissionsUi, /"advanced:approvals:decide"/);
    assert.match(permissionsUi, /canTargetWholeSchool/);
    assert.match(permissionsUi, /TEACHER_NOTICE_AUDIENCE/);
  });

  it('models attendance read, mark, manage, conflict, and override capabilities', () => {
    const permissionsUi = read('lib/permissions-ui.ts');

    assert.match(permissionsUi, /canView:/);
    assert.match(permissionsUi, /canMark:/);
    assert.match(permissionsUi, /canManageAll:/);
    assert.match(permissionsUi, /canReviewConflicts:/);
    assert.match(permissionsUi, /canOverrideLock:/);
    assert.match(permissionsUi, /"attendance:override_lock"/);
  });
});
