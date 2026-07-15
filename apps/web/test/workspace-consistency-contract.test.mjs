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
};

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
      assert.match(source, /SummaryGrid/, `${route} must use SummaryGrid`);
      assert.match(source, /SummaryCard/, `${route} must use SummaryCard`);
      assert.match(source, /WorkspaceTabs/, `${route} must use WorkspaceTabs`);
      assert.match(source, /WorkSurface/, `${route} must use WorkSurface`);
      assert.doesNotMatch(source, /function\s+SummaryCard|const\s+SummaryCard\s*=/);
    }
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
    ].join("\n");
    assert.doesNotMatch(
      targetSource,
      /bg-\[var\(--color-mod-(?:admissions|attendance|fees|homework|academics)-accent\)\]/,
    );

    const tabs = read("components/dashboard/module-tabs.tsx");
    assert.match(tabs, /bg-primary text-primary-foreground/);
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
    assert.match(providers, /SchoolOSMotionProvider/);
    assert.doesNotMatch(shell, /animate-in|duration-300|slide-in|zoom-in/);
  });

  it("keeps pagination and URL-backed filtering contracts present", () => {
    const students = sourceFor("students");
    const admissions = sourceFor("admissions");
    const homework = sourceFor("homework");
    const fees = sourceFor("fees");

    assert.match(students, /useUrlFilters/);
    assert.match(students, /TablePagination/);
    assert.match(admissions, /useUrlFilters/);
    assert.match(admissions, /TablePagination/);
    assert.match(homework, /useUrlFilters/);
    assert.match(homework, /listHomeworkPage/);
    assert.match(fees, /searchParams/);
    assert.match(fees, /searchCollectionStudents/);
  });
});
