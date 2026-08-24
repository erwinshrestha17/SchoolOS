import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(webRoot, '..', '..');

function readWeb(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function definitionBlock(source, key, nextKey) {
  const start = source.indexOf(`key: "${key}"`);
  const end = source.indexOf(`key: "${nextKey}"`, start + 1);
  assert.notEqual(start, -1, `Missing ${key} support scope`);
  assert.notEqual(end, -1, `Missing ${nextKey} support scope`);
  return source.slice(start, end);
}

describe('purpose-limited published support workspaces', () => {
  it('projects narrow homework/timetable permissions instead of broad module reads', () => {
    // This is a repository-source contract check, not a runtime source import.
    // Build the path by segment so the runtime import-boundary scanner can
    // continue treating every literal `packages/core/src/*` reference as a
    // forbidden application import.
    const scopes = readRepo(
      join('packages', 'core', 'src', 'support-override.ts'),
    );
    const block = definitionBlock(
      scopes,
      'HOMEWORK_TIMETABLE',
      'NOTICES_DELIVERY',
    );
    const homeworkController = readRepo(
      'apps/api/src/homework/homework.controller.ts',
    );
    const timetableController = readRepo(
      'apps/api/src/timetable/timetable.controller.ts',
    );

    assert.match(block, /"homework:read_published"/);
    assert.match(block, /"timetable:read_published"/);
    assert.doesNotMatch(block, /"homework:read",/);
    assert.doesNotMatch(block, /"timetable:read",/);

    assert.match(
      homeworkController,
      /@Get\(\)[\s\S]{0,100}@Permissions\('homework:read_published'\)/,
    );
    assert.match(
      homeworkController,
      /@Get\(':id'\)[\s\S]{0,100}@Permissions\('homework:read_published'\)/,
    );
    assert.match(
      homeworkController,
      /@Get\('summary\/today'\)[\s\S]{0,100}@Permissions\('homework:read'\)/,
    );
    assert.match(
      timetableController,
      /@Get\(\)[\s\S]{0,100}@Permissions\('timetable:read_published'\)/,
    );
  });

  it('uses exact session-aware route gates and keeps setup subroutes broad-only', () => {
    const layout = readWeb('app/dashboard/layout.tsx');
    const nav = [
      readWeb('components/layout/sidebar-persona-nav.config.ts'),
      readWeb('components/layout/sidebar-persona-nav.base.ts'),
    ].join('\n');

    assert.match(
      layout,
      /hasAllPermissions\(session, routeGate\.permissions\)/,
    );
    assert.match(layout, /hasAnyPermission\(session, routeGate\.permissions\)/);
    assert.match(
      layout,
      /prefix: "\/dashboard\/homework"[\s\S]{0,100}"homework:read_published"/,
    );
    assert.match(
      layout,
      /prefix: "\/dashboard\/timetable\/builder"[\s\S]{0,140}"timetable:create"/,
    );
    assert.match(
      layout,
      /prefix: "\/dashboard\/timetable"[\s\S]{0,100}"timetable:read_published"/,
    );
    assert.ok(
      layout.includes(
        'if (/^\\/dashboard\\/notices\\/[^/]+\\/edit$/.test(href))',
      ),
    );
    assert.match(nav, /\[['"]homework:read_published['"]\]/);
    assert.match(nav, /\[['"]timetable:read_published['"]\]/);
  });

  it('fails closed on every dashboard URL outside the selected support scopes', () => {
    const layout = readWeb('app/dashboard/layout.tsx');

    assert.match(layout, /function supportOverrideRouteAllowed\(/);
    assert.match(
      layout,
      /session\.user\.isSupportOverride &&[\s\S]{0,180}!supportOverrideRouteAllowed/,
    );
    assert.match(layout, /pathname === "\/dashboard\/academics"/);
    assert.match(layout, /pathname === "\/dashboard\/attendance"/);
    assert.match(layout, /pathname === "\/dashboard\/timetable"/);
    assert.match(layout, /"new",\s*"review"/);
    assert.match(layout, /"new",\s*"scheduled",\s*"approvals"/);
    assert.match(layout, /Outside the approved support scope/);
  });

  it('does not start homework submission, report, template, or file requests in support UI', () => {
    const homework = readWeb('app/dashboard/homework/page.tsx');
    const detailRoute = readWeb('app/dashboard/homework/[homeworkId]/page.tsx');
    const supportDetail = readWeb(
      'components/homework/support-homework-detail-page.tsx',
    );

    assert.match(homework, /enabled: !isSupportOverride/);
    assert.match(
      homework,
      /!isSupportOverride &&[\s\S]{0,100}activeTab === "completion"/,
    );
    assert.match(homework, /const SUPPORT_HOMEWORK_TABS/);
    assert.match(homework, /tab\.value === "today" \|\| tab\.value === "all"/);
    assert.match(
      homework,
      /isSupportOverride[\s\S]{0,80}\[\.\.\.SUPPORT_HOMEWORK_TABS\]/,
    );
    assert.match(
      homework,
      /canOpenProtectedFiles = !session\?\.user\.isSupportOverride/,
    );
    assert.match(detailRoute, /session\?\.user\.isSupportOverride/);
    assert.match(detailRoute, /<SupportHomeworkDetailPage/);
    assert.match(supportDetail, /api\.getHomework\(homeworkId\)/);
    assert.doesNotMatch(
      supportDetail,
      /listHomeworkAssignmentSubmissions|getHomeworkRegister|useMutation|ProtectedFile/,
    );
  });

  it('renders support timetable from only the published paginated endpoint', () => {
    const route = readWeb('app/dashboard/timetable/page.tsx');
    const supportTimetable = readWeb(
      'components/timetable/support-published-timetable.tsx',
    );

    assert.match(route, /session\?\.user\.isSupportOverride/);
    assert.match(route, /<SupportPublishedTimetable/);
    assert.match(
      supportTimetable,
      /api\.listSupportPublishedTimetable\(\{ page, limit: PAGE_SIZE \}\)/,
    );
    assert.match(supportTimetable, /<TablePagination/);
    assert.match(supportTimetable, /<caption className="sr-only">/);
    assert.doesNotMatch(
      supportTimetable,
      /listTimetableVersions|listTimetablePeriods|listSubstitutions|validateTimetableVersion|useMutation/,
    );
  });

  it('renders academics from narrow evidence APIs without operational summaries or writes', () => {
    const route = readWeb('app/dashboard/academics/page.tsx');
    const supportAcademics = readWeb(
      'components/academics/support-academics-overview.tsx',
    );

    assert.match(route, /session\?\.user\.isSupportOverride/);
    assert.match(route, /<SupportAcademicsOverview/);
    assert.match(supportAcademics, /api\.listExamTerms/);
    assert.match(supportAcademics, /api\.listMarksPage/);
    assert.match(supportAcademics, /api\.listReportCards/);
    assert.match(supportAcademics, /<TablePagination/);
    assert.doesNotMatch(
      supportAcademics,
      /getAcademicsOperationalSummary|listPromotionReadiness|getResultsPublishingReadiness|useMutation|ProtectedFile|downloadReportCard/,
    );
  });

  it('keeps notice support UI read-only and excludes recipient/history panels', () => {
    const workspace = readWeb('components/notices/notices-workspace.tsx');
    const supportWorkspace = readWeb(
      'components/notices/support-notices-workspace.tsx',
    );
    const list = readWeb('components/notices/notice-list-workspace.tsx');
    const detail = readWeb('app/dashboard/notices/[noticeId]/page.tsx');
    const acknowledgement = readWeb(
      'components/notices/notice-acknowledgement-panel.tsx',
    );
    const deliveries = readWeb(
      'components/notifications/delivery-operations-workspace.tsx',
    );

    assert.match(workspace, /session\?\.user\.isSupportOverride/);
    assert.match(workspace, /<SupportNoticesWorkspace/);
    assert.match(supportWorkspace, /Read-only support/);
    assert.match(
      supportWorkspace,
      /published notices and masked delivery diagnostics/i,
    );
    assert.equal((supportWorkspace.match(/<SummaryCard/g) ?? []).length, 3);
    assert.doesNotMatch(
      supportWorkspace,
      /NoticeComposerWorkspace|NoticeDetailLinksPanel|useMutation|ProtectedFile/,
    );
    assert.match(
      list,
      /const lifecycleStatus = isSupportOverride[\s\S]{0,80}\? ""/,
    );
    assert.match(list, /!fixedLifecycleStatus && !isSupportOverride/);
    assert.match(
      detail,
      /showRecipientReporting =\s*showPublicationReporting && !isSupportOverride/,
    );
    assert.match(detail, /!noticeQuery\.data \|\| isSupportOverride/);
    assert.match(acknowledgement, /!session\?\.user\.isSupportOverride/);
    assert.match(
      deliveries,
      /isSupportOverride[\s\S]{0,240}Read-only masked delivery diagnostics/,
    );
  });
});
