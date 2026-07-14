import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('dashboard command center', () => {
  it('keeps the dashboard backed by the existing operational summary contract', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /api\.getDashboardSummary/);
    assert.match(page, /DashboardCommandCenter/);
    assert.match(page, /resolveOperationalSummaryAction/);
    assert.match(page, /OperationalSummaryLoading/);
    assert.match(page, /OperationalSummaryError/);
    assert.match(page, /SummaryStatusBadge/);
  });

  it('keeps dashboard drill-through actions on the shared safe-route allowlist', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /resolveOperationalSummaryAction/);
    assert.match(commandCenter, /function safeRoute/);
    assert.match(commandCenter, /function firstSafeAction/);
    assert.doesNotMatch(commandCenter, /window\.open|signedUrl|objectKey|bucket/);
  });

  it('uses a priority-first operations layout instead of generic repeated summaries', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    for (const marker of [
      'Pending Approvals & Alerts',
      'Today at a glance',
      'Run today’s school workflows',
      'Academic snapshot',
      'Department queues',
      'Recent activity',
      'Recent notices',
      'DashboardUnavailableState',
    ]) {
      assert.ok(commandCenter.includes(marker), `Missing dashboard section: ${marker}`);
    }

    assert.doesNotMatch(commandCenter, /title="Operational summary"/);
  });

  it('moves Pending Approvals into the context rail as a compact real-data panel, not a full-width banner', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /function PendingApprovalsPanel/);
    assert.match(commandCenter, /function PendingApprovalRow/);
    assert.doesNotMatch(commandCenter, /function AttentionCenter/);
    assert.doesNotMatch(commandCenter, /function AttentionCard/);
    // Every row must resolve through the same safe-route allowlist as
    // everything else — no arbitrary href from backend attention payloads.
    assert.match(
      commandCenter,
      /const directHref = safeRoute\(\{\s*\n\s*key: item\.key,/,
    );
  });

  it('renders Recent Notices from the real M12 notices list, permission-gated, never a hardcoded count', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /function RecentNoticesPanel/);
    assert.match(commandCenter, /queryFn: api\.listNotices/);
    assert.match(commandCenter, /hasPermissions\(\["notices:read"\]\)/);
    assert.match(commandCenter, /if \(!canReadNotices\) return null;/);
    assert.match(commandCenter, /import \{ PriorityBadge \} from "\.\.\/forms\/communications-form"/);
    assert.doesNotMatch(commandCenter, /notice\.body/);
  });

  it('builds the six-card KPI strip only from real backend fields, full-width above both columns', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    for (const label of [
      'Active Students',
      'Present Today',
      'Collected Today',
      'Pending Approvals',
      'Staff Present',
      'Overdue Fees',
    ]) {
      assert.ok(commandCenter.includes(`label: "${label}"`), `Missing KPI card: ${label}`);
    }

    // Staff Present and Overdue Fees needed two new real backend metrics
    // (staffPresentToday, overdueFeesAmount) added 2026-07-10 specifically so
    // these cards would be honest instead of omitted or faked.
    assert.match(commandCenter, /metric\(hr, "staffPresentToday"\)/);
    assert.match(commandCenter, /metric\(fees, "overdueFeesAmount"\)/);

    // Pending Approvals sums real attentionItems already on the payload —
    // no second query — and has no href since it has no single destination.
    assert.match(
      commandCenter,
      /attentionItems\.reduce\(\s*\n\s*\(sum, item\) => sum \+ item\.count,/,
    );

    assert.match(commandCenter, /cards\.slice\(0, 6\)/);
    assert.match(commandCenter, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6/);

    // The KPI strip must render outside/above the two-column
    // main-content/aside grid so it spans the full page width, not just the
    // narrower left column.
    const returnIndex = commandCenter.indexOf('return (');
    const pulseIndex = commandCenter.indexOf('School pulse');
    const twoColumnGridIndex = commandCenter.indexOf(
      "xl:grid-cols-[minmax(0,1fr)_24rem]",
    );
    assert.ok(returnIndex < pulseIndex && pulseIndex < twoColumnGridIndex);
  });

  it('adds real backend fields for staff present and overdue fee amount instead of omitting the KPIs', () => {
    const service = read('../api/src/operational-summary/operational-summary.service.ts');

    assert.match(service, /this\.def\('staffPresentToday', 'staffAttendance'/);
    assert.match(service, /function overdueFeesAmountMetric|private async overdueFeesAmountMetric/);
    assert.match(service, /Math\.max\(0, invoiceTotal - paidTotal \+ refundTotal\)/);
  });

  it('shows Today\'s Timetable using the real ISO weekday convention, not JS getDay()', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /function TodaysTimetablePanel/);
    assert.match(commandCenter, /function currentNepalIsoWeekday/);
    // Confirmed from the timetable builder's own DAYS array: 1=Monday, not
    // JS's Date.getDay() 0=Sunday convention (a mismatch a sibling teacher
    // dashboard component actually has — do not copy that bug here). Built
    // from getNepalNow() calendar fields, not Intl.DateTimeFormat, per the
    // no-browser-local-date-rendering contract in date-utils-contract.test.mjs.
    assert.match(commandCenter, /const now = getNepalNow\(\);/);
    assert.match(commandCenter, /jsWeekday === 0 \? 7 : jsWeekday/);
    assert.doesNotMatch(commandCenter, /new Intl\.DateTimeFormat/);
    assert.match(commandCenter, /queryFn: \(\) => api\.listTimetable\(\{ dayOfWeek, limit: 50 \}\)/);
    assert.match(commandCenter, /hasPermissions\(\["timetable:read"\]\)/);
    assert.match(commandCenter, /if \(!canReadTimetable\) return null;/);
    assert.match(commandCenter, /No classes are scheduled for today\./);
  });

  it('shows a radial gauge only for the one metric with a genuine real ratio (attendance)', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /function RadialGauge/);
    assert.match(commandCenter, /function computeAttendanceRate/);
    assert.match(
      commandCenter,
      /ringPercent=\{\s*\n\s*summary\.module === "m2_attendance" \? attendanceRate : null/,
    );
  });

  it('derives the attendance rate only from two real backend numbers, never invented', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(
      commandCenter,
      /typeof presentToday === "number" &&\s*\n\s*typeof expectedStudents === "number" &&\s*\n\s*expectedStudents > 0/,
    );
    assert.match(commandCenter, /Math\.round\(\(presentToday \/ expectedStudents\) \* 100\)/);
  });

  it('renders a real, bounded quick-action icon grid instead of a generic action list', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /function QuickActionsSection/);
    assert.match(commandCenter, /Jump into a workflow/);
    // Every tile must come from the real, permission-filtered nextActions
    // list and resolve through the same safe-route allowlist as the rest of
    // the dashboard — never an invented action or an arbitrary href.
    assert.match(commandCenter, /dashboard\.nextActions/);
    assert.match(commandCenter, /\.slice\(0, 6\)/);
    assert.match(commandCenter, /function quickActionPresentation/);
    assert.doesNotMatch(commandCenter, /function NextActionsPanel/);
  });

  it('uses current product labels for visible module names', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    for (const label of [
      'Library',
      'Transport',
      'Canteen',
      'Accounting & Finance',
      'Notices & Announcements',
      'Learning Layer',
    ]) {
      assert.ok(commandCenter.includes(label), `Missing visible product label: ${label}`);
    }
  });

  it('uses the School Overview header copy with a single role-aware primary action', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /title="School Overview"/);
    assert.match(page, /Daily operating snapshot for your school/);

    // The backend already orders nextActions by priority for the session,
    // so the header's one primary action must be the first authorized entry
    // from that real list, not a generic control like refresh — refresh
    // moves next to the "Updated ..." timestamp where it belongs.
    assert.match(page, /const \[primaryNextAction, \.\.\.remainingNextActions\] = safeNextActions/);
    assert.match(page, /primaryNextAction\.action\.label/);
    assert.match(page, /primaryNextAction\.href/);
    assert.doesNotMatch(
      page,
      /primaryAction=\{\s*<RefreshSummaryButton/,
    );
  });
});
