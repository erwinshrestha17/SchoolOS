import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

const DASHBOARD_COMPONENT_FILES = [
  'components/dashboard/dashboard-command-center.tsx',
  'components/dashboard/dashboard-module-meta.tsx',
  'components/dashboard/dashboard-summary-strip.tsx',
  'components/dashboard/dashboard-attention-panel.tsx',
  'components/dashboard/dashboard-operations-panel.tsx',
  'components/dashboard/dashboard-readiness-section.tsx',
  'components/dashboard/dashboard-activity-panel.tsx',
];

function readDashboardBundle() {
  return DASHBOARD_COMPONENT_FILES.map(read).join('\n');
}

describe('principal dashboard command center', () => {
  it('keeps the dashboard backed by the existing operational summary contract', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /api\.getDashboardSummary/);
    assert.match(page, /DashboardCommandCenter/);
    assert.match(page, /resolveOperationalSummaryAction/);
    assert.match(page, /OperationalSummaryLoading/);
    assert.match(page, /OperationalSummaryError/);
    assert.match(page, /SummaryStatusBadge/);
  });

  it('keeps every drill-through on the shared safe-route allowlist', () => {
    const meta = read('components/dashboard/dashboard-module-meta.tsx');
    const bundle = readDashboardBundle();

    assert.match(meta, /resolveOperationalSummaryAction/);
    assert.match(meta, /export function safeRoute/);
    assert.match(meta, /export function firstSafeAction/);
    // Module rows use fixed workspace routes, but even those resolve
    // through the same allowlist so it stays the single authority.
    assert.match(meta, /export function moduleWorkspaceRoute/);
    assert.match(meta, /return safeRoute\(\{ key: `open_\$\{module\}`/);
    assert.doesNotMatch(bundle, /window\.open|signedUrl|objectKey|bucket/);
  });

  it('composes the focused one-viewport structure without the old card walls', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /DashboardSummaryStrip/);
    assert.match(commandCenter, /DashboardAttentionPanel/);
    assert.match(commandCenter, /TodayOperationsPanel/);
    assert.match(commandCenter, /SchoolReadinessSection/);
    assert.match(commandCenter, /LatestSchoolActivityPanel/);

    const bundle = readDashboardBundle();
    // Removed sections: the six-card pulse strip, module card walls, the
    // quick-action tile wall, the full timetable list, and the separate
    // notices panel must not come back.
    assert.doesNotMatch(bundle, /Today at a glance/);
    assert.doesNotMatch(bundle, /Department queues/);
    assert.doesNotMatch(bundle, /QuickActionsSection/);
    assert.doesNotMatch(bundle, /Jump into a workflow/);
    assert.doesNotMatch(bundle, /TodaysTimetablePanel/);
    assert.doesNotMatch(bundle, /RecentNoticesPanel/);
    assert.doesNotMatch(bundle, /api\.listTimetable/);
    assert.doesNotMatch(bundle, /api\.listNotices/);
  });

  it('caps the summary strip at four compact cards built only from backend fields', () => {
    const strip = read('components/dashboard/dashboard-summary-strip.tsx');

    assert.match(strip, /\.slice\(0, 4\)/);
    assert.match(strip, /attendanceProgress/);
    assert.match(strip, /collectedTodayAmount/);
    assert.match(strip, /paymentCountToday/);
    assert.match(strip, /staffPresentToday/);
    assert.match(strip, /staffOnApprovedLeaveToday/);

    // Unavailable and permission-missing are never rendered as numbers.
    assert.match(strip, /Information is not available yet\./);
    assert.match(strip, /"Unavailable"/);
    assert.match(strip, /permissionDenied/);
  });

  it('never presents unstarted attendance as student absence', () => {
    const meta = read('components/dashboard/dashboard-module-meta.tsx');
    const strip = read('components/dashboard/dashboard-summary-strip.tsx');
    const operations = read('components/dashboard/dashboard-operations-panel.tsx');

    // Progress comes from register/session counts (including the
    // teacher-scoped keys), with an explicit notStarted state.
    assert.match(meta, /attendanceSessionsToday/);
    assert.match(meta, /unsubmittedRegisters/);
    assert.match(meta, /assignedRegistersToday/);
    assert.match(meta, /pendingRegistersToday/);
    assert.match(meta, /notStarted/);

    assert.match(strip, /"Not started"/);
    assert.match(operations, /Attendance has not started/);
    // The strip and rows must not read absence counts at all.
    assert.doesNotMatch(strip, /absentToday|presentToday\b/);
    assert.doesNotMatch(operations, /absentToday/);
  });

  it('keeps approvals, warnings, and follow-ups distinct instead of one merged pending number', () => {
    const meta = read('components/dashboard/dashboard-module-meta.tsx');
    const strip = read('components/dashboard/dashboard-summary-strip.tsx');

    assert.match(meta, /APPROVAL_ATTENTION_KEYS/);
    assert.match(meta, /export function attentionKind/);
    assert.match(strip, /attentionKind\(item\) === "approval"/);
    // The old misleading total — summing every attention count into one
    // "Pending Approvals" figure — must not return.
    assert.doesNotMatch(
      readDashboardBundle(),
      /reduce\(\s*\n?\s*\(sum, item\) => sum \+ item\.count/,
    );
  });

  it('bounds the attention list at five with an in-place view-all of the bounded payload', () => {
    const panel = read('components/dashboard/dashboard-attention-panel.tsx');

    assert.match(panel, /const DEFAULT_VISIBLE_ITEMS = 5/);
    assert.match(panel, /openItems\.slice\(0, DEFAULT_VISIBLE_ITEMS\)/);
    assert.match(panel, /View all \$\{formatNumber\(openItems\.length\)\} attention items/);
    assert.match(panel, /id="needs-attention"/);
    // Rows resolve through the safe-route allowlist, never raw item.action.
    assert.match(panel, /const href = safeRoute\(\{/);
    // Genuine zero is a distinct, honest state.
    assert.match(panel, /No approvals, warnings, or follow-ups are open/);
  });

  it('renders today’s operations as compact permitted rows, never cards for locked modules', () => {
    const operations = read('components/dashboard/dashboard-operations-panel.tsx');

    assert.match(operations, /summary\.status !== "locked"/);
    assert.match(operations, /prioritizeByAttention/);
    assert.match(operations, /Today’s operations/);
    // One meaningful state per module row with honest unavailable/zero split.
    assert.match(operations, /registers submitted/);
    assert.match(operations, /collected/);
    assert.match(operations, /No open transport issue/);
    assert.match(operations, /Information is not available yet\./);
    assert.match(operations, /Some information is temporarily unavailable\./);
    assert.match(operations, /No operations summaries are available for your current access\./);
  });

  it('keeps the readiness section bounded with honest permission and zero states', () => {
    const readiness = read('components/dashboard/dashboard-readiness-section.tsx');

    assert.match(readiness, /const MAX_ROWS_PER_PANEL = 4/);
    assert.match(readiness, /Academic readiness/);
    assert.match(readiness, /Finance readiness/);
    assert.match(readiness, /People & operations/);
    assert.match(readiness, /You do not have permission to view this summary\./);
    assert.match(readiness, /No academic blockers reported\./);
    assert.match(readiness, /count === null \|\| count <= 0/);
    // Timetable is readiness/exceptions plus a drill-through, not a list.
    assert.match(readiness, /unassignedSubstitutionsToday/);
    assert.match(readiness, /View full timetable/);
    assert.match(readiness, /href="\/dashboard\/timetable"/);
  });

  it('combines recent activity and notices into one bounded feed from the summary payload', () => {
    const activity = read('components/dashboard/dashboard-activity-panel.tsx');

    assert.match(activity, /const MAX_ACTIVITY_ITEMS = 5/);
    assert.match(activity, /items\.slice\(0, MAX_ACTIVITY_ITEMS\)/);
    assert.match(activity, /Latest school activity/);
    assert.match(activity, /formatBsDateTime/);
    // No message bodies, no extra list fetches, no invented view-all route.
    assert.doesNotMatch(activity, /notice\.body|\.body\b/);
    assert.doesNotMatch(activity, /useQuery/);
    assert.match(activity, /ACTIVITY_EVENT_LABELS/);
  });

  it('derives the header primary action from real dashboard data, attention first', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /title="School Overview"/);
    assert.match(page, /Daily operating snapshot for your school/);
    assert.match(page, /Review \$\{attentionCount\} attention item/);
    assert.match(page, /href: '#needs-attention'/);
    assert.match(page, /firstNextAction/);
    assert.doesNotMatch(page, /primaryAction=\{\s*<RefreshSummaryButton/);
    // Secondary actions stay in the shared More Actions menu.
    assert.match(page, /moreActionItems=\{quickActions/);
  });

  it('avoids technical wording and the old repeated status filler', () => {
    const bundle = readDashboardBundle();

    assert.doesNotMatch(bundle, /Current information available/);
    assert.doesNotMatch(bundle, /No open work reported/);
    assert.doesNotMatch(bundle, /Failed to fetch|Error 40|provider payload/i);
    assert.doesNotMatch(bundle, /\bAPI\b|endpoint/);
  });

  it('uses current product labels for visible module names', () => {
    const meta = read('components/dashboard/dashboard-module-meta.tsx');

    for (const label of [
      'Library',
      'Transport',
      'Canteen',
      'Accounting & Finance',
      'Notices & Announcements',
      'Learning Layer',
    ]) {
      assert.ok(meta.includes(label), `Missing visible product label: ${label}`);
    }
  });
});
