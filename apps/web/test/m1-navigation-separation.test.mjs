import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

describe("M1 Students and Admissions workspace navigation", () => {
  const sidebar = read("components/layout/sidebar.tsx");
  const studentsPage = read("app/dashboard/students/page.tsx");
  const admissionsPage = read("app/dashboard/admissions/page.tsx");
  const pageHeader = read("components/m1/m1-page-header.tsx");
  const studentDirectory = read("components/forms/student-directory.tsx");
  const admissionQueues = read("components/m1/admission-case-queues.tsx");
  const summaryCards = read("components/ui/summary-card.tsx");
  const workspaceTabs = read("components/dashboard/module-tabs.tsx");

  it("keeps Students and Admissions as separate sidebar workspaces", () => {
    assert.match(sidebar, /label: 'Students & Admissions'/);
    assert.match(sidebar, /href: '\/dashboard\/students',\s*label: 'Students'/);
    assert.match(sidebar, /href: '\/dashboard\/admissions',\s*label: 'Admissions'/);
    assert.match(sidebar, /function computeActiveHref/);
    assert.match(sidebar, /function isActiveNavItem/);
  });

  it("removes the M1-wide horizontal navigation from both workspace pages", () => {
    assert.equal(
      existsSync(join(webRoot, "components/m1/m1-module-nav.tsx")),
      false,
    );
    assert.doesNotMatch(studentsPage + admissionsPage + pageHeader, /M1ModuleNav/);
    assert.doesNotMatch(
      studentsPage + admissionsPage + pageHeader,
      /label: ['"]Students['"].*label: ['"]Admissions['"].*label: ['"]Applications['"]/s,
    );
  });

  it("gives each primary route its approved identity and action path", () => {
    assert.match(studentsPage, /title="Students"/);
    assert.doesNotMatch(studentsPage, /title="Admissions & Student Profiles"/);
    assert.match(admissionsPage, /title="Admissions"/);
    assert.match(studentsPage, /href="\/dashboard\/admissions\/new"/);
    assert.match(admissionsPage, /href="\/dashboard\/admissions\/new"/);
  });

  it("uses URL-backed lifecycle and queue views without client totals", () => {
    assert.match(studentDirectory, /label="Student lifecycle views"/);
    assert.match(studentDirectory, /value: 'EXITED', label: 'Withdrawn'/);
    assert.match(admissionQueues, /label="Admission queue views"/);
    assert.match(admissionQueues, /useUrlFilters/);
    assert.match(admissionQueues, /history: "push"/);
    assert.match(studentDirectory, /history: 'push'/);
    assert.match(admissionQueues, /admissionCasesApi\.listQueues/);
    assert.match(admissionQueues, /TablePagination/);
    assert.match(admissionQueues, /<Empty/);
    assert.doesNotMatch(admissionsPage, /items\.length|filter\(/);
  });

  it("uses one compact shared summary-card composition on both workspaces", () => {
    assert.match(studentDirectory, /SummaryGrid/);
    assert.match(admissionsPage, /SummaryGrid/);
    assert.match(summaryCards, /data-schoolos-ui="summary-grid"/);
    assert.match(summaryCards, /grid gap-4 sm:grid-cols-2 xl:grid-cols-4/);
    assert.match(summaryCards, /<CardHeader/);
    assert.match(summaryCards, /<CardContent/);
    assert.match(summaryCards, /<CardDescription/);
    assert.match(summaryCards, /min-h-36 gap-3 py-4/);
    assert.doesNotMatch(summaryCards, /border-(?:slate|gray|black)-/);
    assert.doesNotMatch(summaryCards, /py-(?:8|10|12|16|20)/);
  });

  it("keeps local tabs compact without a visible desktop scrollbar", () => {
    for (const workspace of [studentDirectory, admissionQueues]) {
      assert.match(workspace, /<WorkspaceTabs/);
      assert.doesNotMatch(workspace, /<TabsList/);
    }
    assert.match(workspaceTabs, /\[scrollbar-width:none\]/);
    assert.match(workspaceTabs, /\[&::\-webkit-scrollbar\]:hidden/);
    assert.doesNotMatch(workspaceTabs, /min-w-\[[^\]]+\]/);
  });

  it("keeps the roster and admission queue as compact cohesive workspaces", () => {
    assert.match(studentDirectory, /data-testid="student-roster-workspace"/);
    assert.match(studentDirectory, /role="group"/);
    assert.match(studentDirectory, /aria-label="Directory filters"/);
    assert.doesNotMatch(studentDirectory, /Readiness & duplicate attention panels/);
    assert.doesNotMatch(studentDirectory, /Search and filter student records/);
    assert.match(admissionQueues, /data-testid="admission-queue-workspace"/);
    assert.match(admissionQueues, /<Empty/);
    assert.match(admissionQueues, /More queues/);
    assert.doesNotMatch(admissionQueues, /min-h-64|Additional queues/);
    assert.doesNotMatch(admissionQueues, /sourceId|classId|dateFrom|dateTo/);
  });

  it("keeps every former M1 destination reachable through contextual actions", () => {
    const combined = studentsPage + admissionsPage;
    for (const route of [
      "/dashboard/admissions/applications",
      "/dashboard/admissions/documents",
      "/dashboard/admissions/duplicates",
      "/dashboard/admissions/iemis",
      "/dashboard/admissions/qr",
    ]) {
      assert.match(combined, new RegExp(route.replaceAll("/", "\\/")));
    }
  });
});
