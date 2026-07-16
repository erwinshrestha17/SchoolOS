import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

const routeSources = {
  students: [
    "app/dashboard/students/page.tsx",
    "components/m1/m1-page-header.tsx",
    "components/forms/student-directory.tsx",
  ],
  admissions: [
    "app/dashboard/admissions/page.tsx",
    "components/m1/m1-page-header.tsx",
    "components/m1/admission-case-queues.tsx",
  ],
  attendance: [
    "app/dashboard/attendance/page.tsx",
    "components/attendance/attendance-m2-workspaces.tsx",
  ],
  fees: [
    "app/dashboard/fees/page.tsx",
    "components/finance/fees-workspace.tsx",
    "components/finance/fees-module-shell.tsx",
    "components/finance/fee-overview.tsx",
  ],
  homework: ["app/dashboard/homework/page.tsx"],
  academics: ["app/dashboard/academics/page.tsx"],
  activity: [
    "app/dashboard/activity/page.tsx",
    "components/ui/operational-summary-grid.tsx",
  ],
  hr: ["app/dashboard/hr/page.tsx"],
  payroll: ["app/dashboard/payroll/page.tsx"],
  library: [
    "app/dashboard/library/page.tsx",
    "components/library/library-workspace.tsx",
  ],
  transport: [
    "app/dashboard/transport/layout.tsx",
    "components/transport/transport-workspace.tsx",
  ],
  canteen: [
    "app/dashboard/canteen/page.tsx",
    "components/canteen/canteen-workspace.tsx",
  ],
  accounting: [
    "app/dashboard/accounting/layout.tsx",
    "components/accounting/accounting-dashboard-view.tsx",
  ],
  notices: ["components/notices/notices-workspace.tsx"],
  learning: [
    "app/dashboard/learning/page.tsx",
    "components/learning/learning-workspace.tsx",
    "components/ui/operational-summary-grid.tsx",
  ],
};

const optionalSummaryRoutes = new Set(["canteen"]);
const remainingMigrationRoutes = [
  "activity",
  "hr",
  "payroll",
  "library",
  "transport",
  "canteen",
  "accounting",
  "notices",
  "learning",
];

const sourceFor = (route) => routeSources[route].map(read).join("\n");

describe("SchoolOS workspace consistency contract", () => {
  it("composes every priority route from the canonical shell and header", () => {
    for (const route of Object.keys(routeSources)) {
      const source = sourceFor(route);
      assert.match(source, /DashboardPageShell/, `${route} must use DashboardPageShell`);
      assert.match(source, /ModuleHeader/, `${route} must use ModuleHeader`);
    }
  });

  it("uses shared summaries, tabs, and work surfaces without route-local copies", () => {
    for (const route of Object.keys(routeSources)) {
      const source = sourceFor(route);
      if (!optionalSummaryRoutes.has(route)) {
        assert.match(source, /SummaryGrid/, `${route} must use SummaryGrid`);
        assert.match(source, /SummaryCard/, `${route} must use SummaryCard`);
      }
      assert.match(source, /WorkspaceTabs/, `${route} must use WorkspaceTabs`);
      assert.match(source, /WorkSurface/, `${route} must use WorkSurface`);
      assert.doesNotMatch(source, /function\s+SummaryCard|const\s+SummaryCard\s*=/);
    }
  });

  it("keeps remaining modules on shared primitives with no duplicate KPI or tab implementations", () => {
    for (const route of remainingMigrationRoutes) {
      const source = sourceFor(route);
      assert.doesNotMatch(source, /\b(?:KpiCard|KpiGrid|StatCard|ModuleTabs)\b/);
      assert.doesNotMatch(source, /function\s+SummaryCard|const\s+SummaryCard\s*=/);

      const summaryCardCount = (source.match(/<SummaryCard\b/g) ?? []).length;
      assert.ok(
        summaryCardCount <= 4,
        `${route} must render no more than four primary summary cards`,
      );
    }

    const canteen = sourceFor("canteen");
    assert.doesNotMatch(canteen, /<SummaryGrid|<SummaryCard/);
    assert.match(canteen, /Open POS|Serving counter|Recent POS transactions/);
  });

  it("retains task-specific operational workspaces", () => {
    const markers = {
      activity: /consent|moderation|protected gallery/i,
      hr: /leave queue|staff directory|payroll/i,
      payroll: /Posting Status|Payroll Runs/i,
      library: /Issue \/ Return|overdue attention/i,
      transport: /Location Status|stale GPS|assigned trips/i,
      canteen: /Open POS|serving|allergy/i,
      accounting: /Double-Entry Guard|reconciliation/i,
      notices: /Recipient Preview|Delivery Logs/i,
      learning: /teacher-led|LearningSessionsPanel|protected resources/i,
    };

    for (const [route, marker] of Object.entries(markers)) {
      assert.match(sourceFor(route), marker, `${route} lost its operational purpose`);
    }
  });

  it("keeps shared states and protected-file helpers in the migrated system", () => {
    const fixture = read("components/test-fixtures/workspace-state-fixture.tsx");
    for (const state of [
      "LoadingState",
      "EmptyState",
      "NoResultsState",
      "ErrorState",
      "PermissionDenied",
      "ModuleLockedState",
      "PartialFailureState",
      "QueuedJobState",
      "FileUnavailableState",
    ]) {
      assert.match(fixture, new RegExp(state));
    }

    const protectedSurfaces = [
      read("components/hr/staff-documents-panel.tsx"),
      read("components/hr/payslip-list.tsx"),
      read("components/learning/learning-resources-panel.tsx"),
      read("app/dashboard/notices/[noticeId]/page.tsx"),
    ].join("\n");
    assert.match(protectedSurfaces, /ProtectedFileButton/);
    assert.doesNotMatch(protectedSurfaces, /window\.open\([^)]*(?:file|attachment|payslip)/i);
  });

  it("keeps M12 delivery, M15 notice authoring, and removed chat boundaries distinct", () => {
    const notices = sourceFor("notices");
    const removedChat = read("components/messaging/chat-removed-state.tsx");
    const sidebar = read("components/layout/sidebar.tsx");

    assert.match(notices, /communicationsApi\.getCommunicationsSummary/);
    assert.match(notices, /recipient|Delivery/i);
    assert.match(removedChat, /New conversations and messages are unavailable/i);
    assert.doesNotMatch(sidebar, /href:\s*["']\/dashboard\/(?:messages|messaging)["']/);
  });

  it("keeps module colour out of primary actions and workspace navigation", () => {
    const attendanceSource = read(
      "components/attendance/attendance-m2-workspaces.tsx",
    );
    const attendanceOverview = attendanceSource.slice(
      attendanceSource.indexOf("export function AttendanceOverviewWorkspace"),
      attendanceSource.indexOf("export function AttendanceMarkWorkspace"),
    );
    const targetSource = [
      read("app/dashboard/students/page.tsx"),
      read("app/dashboard/admissions/page.tsx"),
      attendanceOverview,
      read("components/finance/fees-workspace.tsx"),
      read("components/finance/fees-module-shell.tsx"),
      read("components/finance/fee-overview.tsx"),
      read("app/dashboard/homework/page.tsx"),
      read("app/dashboard/academics/page.tsx"),
      read("app/dashboard/activity/page.tsx"),
      read("app/dashboard/hr/page.tsx"),
      read("app/dashboard/payroll/page.tsx"),
      read("app/dashboard/library/page.tsx"),
      read("app/dashboard/transport/layout.tsx"),
      read("app/dashboard/canteen/page.tsx"),
      read("app/dashboard/accounting/layout.tsx"),
      read("components/notices/notices-workspace.tsx"),
      read("app/dashboard/learning/page.tsx"),
    ].join("\n");
    assert.doesNotMatch(
      targetSource,
      /bg-\[var\(--color-mod-(?:admissions|attendance|fees|homework|academics|activity)-accent\)\]/,
    );

    const tabs = read("components/dashboard/module-tabs.tsx");
    // One shared active-tab treatment: the module tint via the data-module
    // scope with a brand-tint fallback — never per-tab accent style props.
    assert.match(
      tabs,
      /bg-\[var\(--mod-soft,var\(--primary-soft\)\)\] text-\[color:var\(--mod-text,var\(--primary-dark\)\)\]/,
    );
    assert.doesNotMatch(tabs, /activeDark|activeLight|tabAccentStyles/);
  });

  it("enforces four-column summaries and hidden tab scrollbars in the shared primitives", () => {
    const summaries = read("components/ui/summary-card.tsx");
    const tabs = read("components/dashboard/module-tabs.tsx");
    const globals = read("app/globals.css");

    assert.match(summaries, /sm:grid-cols-2 xl:grid-cols-4/);
    assert.doesNotMatch(summaries, /xl:grid-cols-(?:5|6|7|8)/);
    assert.match(tabs, /\[scrollbar-width:none\]/);
    assert.match(tabs, /\[&::\-webkit-scrollbar\]:hidden/);
    assert.match(
      globals,
      /\*\s*\{[\s\S]*?border-color:\s*var\(--border\)/,
      "bare shadcn borders must resolve to the shared subtle border token",
    );
  });

  it("uses one global motion boundary and no automatic page entrance", () => {
    const provider = read(
      "components/schoolos/motion/schoolos-motion-provider.tsx",
    );
    const shell = read("components/dashboard/dashboard-page-shell.tsx");
    const providers = read("app/providers.tsx");

    assert.match(provider, /fast: 0\.14/);
    assert.match(provider, /standard: 0\.18/);
    assert.match(provider, /deliberate: 0\.22/);
    assert.match(provider, /0\.2, 0\.8, 0\.2, 1/);
    assert.match(provider, /reducedMotion="user"/);
    assert.match(providers, /SchoolOSMotionProvider/);
    assert.doesNotMatch(shell, /animate-in|duration-300|slide-in|zoom-in/);
  });

  it("keeps pagination and URL-backed filtering contracts present", () => {
    const students = sourceFor("students");
    const admissions = sourceFor("admissions");
    const homework = sourceFor("homework");
    const fees = sourceFor("fees");
    const activity = sourceFor("activity");

    assert.match(students, /useUrlFilters/);
    assert.match(students, /TablePagination/);
    assert.match(admissions, /useUrlFilters/);
    assert.match(admissions, /TablePagination/);
    assert.match(homework, /useUrlFilters/);
    assert.match(homework, /listHomeworkPage/);
    assert.match(fees, /searchParams/);
    assert.match(fees, /searchCollectionStudents/);
    assert.match(activity, /limit: pageSize \+ 1/);
    assert.match(activity, /offset: \(page - 1\) \* pageSize/);
    assert.match(activity, /OffsetPagination/);
  });
});
