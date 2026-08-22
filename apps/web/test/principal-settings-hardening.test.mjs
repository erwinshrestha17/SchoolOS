import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

const backendSettingsItemIds = [
  'overview',
  'school-profile',
  'branding-documents',
  'academic-calendar',
  'academic-structure',
  'attendance',
  'exams-report-cards',
  'homework-timetable',
  'activity-consent',
  'fees',
  'accounting',
  'hr-payroll',
  'communication',
  'documents-templates',
  'security',
  'modules',
  'integrations',
  'admissions',
  'users-access',
  'roles-permissions',
  'audit-export',
  'library-settings',
  'transport-settings',
  'canteen-settings',
  'learning-settings',
];

describe('Principal Settings hardening', () => {
  it('keeps institutional Settings out of the Principal sidebar shell', () => {
    const personaNav = read('components/layout/sidebar-persona-nav.config.ts');
    assert.match(personaNav, /const principalLeadershipOnly/);
    assert.match(
      personaNav,
      /isTeacherPersona \|\| personalOnly \|\| principalLeadershipOnly/,
    );
    assert.match(personaNav, /School Configuration Owner\/Admin authority/);
  });

  it('fails closed on direct institutional Settings routes while keeping personal routes separate', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    assert.match(frame, /isPrincipalRestrictedFromInstitutionalSettings/);
    assert.match(frame, /principalInstitutionalRestricted/);
    assert.match(frame, /!pathname\.startsWith\('\/dashboard\/settings\/personal\/'\)/);
    assert.match(frame, /School Settings access needed/);
    assert.match(frame, /School Configuration Owner role/);
    assert.match(frame, /Personal Settings/);
  });

  it('keeps backend Settings item ownership explicit in the web catalog', () => {
    const navigation = read('components/settings/settings-navigation.config.ts');
    for (const id of backendSettingsItemIds) {
      const hasDefinition = navigation.includes(`backendItemId: '${id}'`);
      const hasDisposition = navigation.includes(`'${id}':`);
      assert.ok(
        hasDefinition || hasDisposition,
        `Backend Settings item ${id} must have frontend metadata or an explicit disposition`,
      );
    }
    for (const id of ['fees', 'accounting', 'hr-payroll', 'security', 'admissions']) {
      assert.match(navigation, new RegExp(`backendItemId: '${id}'`));
    }
    assert.match(navigation, /'learning-settings': 'frozen-hidden'/);
  });

  it('uses one atomic domain mutation instead of sequential setting writes', () => {
    const workspace = read('components/settings/settings-policy-workspace.tsx');
    const api = read('lib/api/school-settings.ts');
    assert.match(workspace, /buildSchoolSettingsDomainVersion/);
    assert.match(workspace, /updateSchoolSettingsDomain/);
    assert.match(workspace, /crypto\.randomUUID/);
    assert.match(workspace, /Reason for change/);
    assert.match(workspace, /ConfirmDialog/);
    assert.doesNotMatch(workspace, /api\.updateTenantSetting/);
    assert.match(api, /\/settings\/domains\/\$\{domain\}/);
  });

  it('renders grading bands as structured school-friendly controls rather than raw JSON', () => {
    const workspace = read('components/settings/settings-policy-workspace.tsx');
    assert.match(workspace, /function GradingScaleField/);
    assert.match(workspace, /Minimum percentage/);
    assert.match(workspace, /Maximum percentage/);
    assert.match(workspace, /Grade point/);
    assert.match(workspace, /Pass status/);
    assert.match(workspace, /Add grade band/);
    assert.match(workspace, /field\.key === 'grading_scale'/);
  });

  it('stabilizes Settings until entitlements resolve', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    assert.match(frame, /loading: entitlementsLoading/);
    assert.match(frame, /navigationLoading/);
    assert.match(frame, /SettingsControlCenterSkeleton/);
    assert.match(frame, /enabled: mayLoadSchoolSettings && !entitlementsLoading/);
  });

  it('makes Settings access state visible before entering a workspace', () => {
    const hub = read('components/settings/settings-control-center.tsx');
    assert.match(hub, /View-only/);
    assert.match(hub, /Can manage/);
    assert.match(hub, /Platform managed/);
    assert.match(hub, /Personal/);
  });

  it('removes fake standalone Timetable and frozen Learning from School Modules', () => {
    const modules = read(
      'components/settings/school-modules-settings-workspace.tsx',
    );
    assert.doesNotMatch(modules, /key: 'timetable'/);
    assert.doesNotMatch(modules, /key: 'learning'/);
    assert.match(modules, /Homework & Timetable/);
    for (const route of [
      '/dashboard/students/overview',
      '/dashboard/attendance/overview',
      '/dashboard/academics/readiness',
      '/dashboard/hr/overview',
      '/dashboard/finance-overview',
      '/dashboard/activity/oversight',
      '/dashboard/communications/oversight',
      '/dashboard/operations/overview',
    ]) {
      assert.ok(modules.includes(route), `Missing Principal-safe module route ${route}`);
    }
  });

  it('keeps Principal configuration audit in Leadership Audit and sanitizes onboarding errors', () => {
    const principalAudit = read('app/dashboard/audit/page.tsx');
    const onboarding = read('app/dashboard/settings/onboarding/page.tsx');
    assert.match(principalAudit, /Leadership Audit/);
    assert.match(principalAudit, /AuditLogWorkspace/);
    assert.match(onboarding, /School setup checklist unavailable/);
    assert.match(onboarding, /Please try again/);
    assert.doesNotMatch(onboarding, /err\.message|error\.message/);
  });
});
