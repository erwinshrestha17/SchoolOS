import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const webRoot = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(webRoot, path), "utf8");

test("remote option clients use bounded paginated endpoints and forward cancellation", () => {
  const studentsApi = read("lib/api/students.ts");
  const payrollApi = read("lib/api/payroll.ts");

  assert.match(studentsApi, /listStudentOptions/);
  assert.match(studentsApi, /\/students\/options/);
  assert.match(studentsApi, /signal\?: AbortSignal/);
  assert.match(studentsApi, /\{ signal \}/);
  assert.match(payrollApi, /listStaffOptions/);
  assert.match(payrollApi, /\/staff\/options/);
  assert.match(payrollApi, /signal\?: AbortSignal/);
  assert.match(payrollApi, /\{ signal \}/);
});

test("shared remote selectors debounce, cache, page, retain selection, and expose accessible recovery", () => {
  const combobox = read("components/ui/remote-combobox.tsx");
  const studentSelector = read(
    "components/students/remote-student-selector.tsx",
  );
  const staffSelector = read("components/staff/remote-staff-selector.tsx");

  assert.match(combobox, /REMOTE_SEARCH_DEBOUNCE_MS = 350/);
  assert.match(combobox, /useInfiniteQuery/);
  assert.match(combobox, /staleTime: 30_000/);
  assert.match(combobox, /signal/);
  assert.match(combobox, /minimumSearchLength = 2/);
  assert.match(combobox, /pageSize = 25/);
  assert.match(combobox, /fetchNextPage/);
  assert.match(combobox, /Load more results/);
  assert.match(combobox, /retainedOption/);
  assert.match(combobox, /selectedOption\?\.id === value/);
  assert.match(combobox, /role="combobox"/);
  assert.match(combobox, /role="listbox"/);
  assert.match(combobox, /role="option"/);
  assert.match(combobox, /aria-activedescendant/);
  assert.match(combobox, /event\.key === ["']ArrowDown["']/);
  assert.match(combobox, /event\.key === ["']ArrowUp["']/);
  assert.match(combobox, /event\.key === ["']Enter["']/);
  assert.match(combobox, /event\.key === ["']Escape["']/);
  assert.match(combobox, /optionsQuery\.refetch\(\)/);
  assert.match(combobox, />\s*Retry\s*</);
  assert.match(studentSelector, /classId/);
  assert.match(studentSelector, /sectionId/);
  assert.match(studentSelector, /limit/);
  assert.match(staffSelector, /listStaffOptions/);
});

test("Activity selectors no longer load or locally filter the full student roster", () => {
  const activitySources = [
    "app/dashboard/activity/milestones/page.tsx",
    "app/dashboard/activity/observations/page.tsx",
    "app/dashboard/activity/gallery/page.tsx",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(activitySources, /listStudents\s*\(/);
  assert.doesNotMatch(activitySources, /limit:\s*1000/);
  assert.doesNotMatch(activitySources, /studentsQuery/);
  assert.match(activitySources, /RemoteStudentSelector/);
});

test("Learning and timetable selectors use bounded remote student and staff search", () => {
  const learning = read("components/learning/learning-workspace.tsx");
  const timetable = read("components/staff/staff-selector.tsx");

  assert.doesNotMatch(learning, /listStudents\s*\(/);
  assert.doesNotMatch(learning, /listStaff\s*\(/);
  assert.doesNotMatch(learning, /limit:\s*1000/);
  assert.match(learning, /RemoteStudentSelector/);
  assert.match(learning, /RemoteStaffSelector/);
  assert.doesNotMatch(timetable, /listStaff\s*\(/);
  assert.match(timetable, /RemoteStaffSelector/);
});

test("HR and academic structure staff selectors use bounded remote search", () => {
  const selectorSources = [
    "components/hr/central-documents-panel.tsx",
    "components/hr/contract-list.tsx",
    "components/hr/leave-balance-adjust-dialog.tsx",
    "components/hr/leave-request-create-dialog.tsx",
    "components/hr/salary-structure-dialog.tsx",
    "components/hr/teacher-development-workspace.tsx",
    "components/settings/academic-structure-workspace.tsx",
  ].map((path) => ({ path, source: read(path) }));

  for (const { path, source } of selectorSources) {
    assert.doesNotMatch(source, /\bapi\.listStaff\b/, path);
    assert.match(source, /RemoteStaffSelector/, path);
  }

  for (const path of [
    "components/hr/central-documents-panel.tsx",
    "components/hr/contract-list.tsx",
    "components/hr/leave-balance-adjust-dialog.tsx",
    "components/hr/leave-request-create-dialog.tsx",
    "components/hr/salary-structure-dialog.tsx",
    "components/hr/teacher-development-workspace.tsx",
  ]) {
    assert.match(read(path), /selectedOption=/, path);
  }
  assert.match(
    read("components/settings/academic-structure-workspace.tsx"),
    /selectedLabel=/,
  );
});

test("bulk staff attendance uses the paginated purpose-limited active roster", () => {
  const dialog = read("components/hr/staff-attendance-mark-dialog.tsx");
  const attendanceApi = read("lib/api/attendance.ts");

  assert.doesNotMatch(dialog, /\bapi\.listStaff\b/);
  assert.match(dialog, /api\.listStaffAttendanceRoster/);
  assert.match(dialog, /staff\.staffId/);
  assert.match(attendanceApi, /\/hr\/staff-attendance\/roster/);
  assert.match(attendanceApi, /STAFF_ATTENDANCE_ROSTER_PAGE_SIZE = 100/);
  assert.match(attendanceApi, /Promise\.all/);
  assert.match(attendanceApi, /\{ signal \}/);
});
