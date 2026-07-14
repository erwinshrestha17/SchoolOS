import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const attendanceTab = readFileSync(
  new URL(
    "../components/students/profile/tabs/attendance-tab.tsx",
    import.meta.url,
  ),
  "utf8",
);
const attendanceApi = readFileSync(
  new URL("../lib/api/attendance.ts", import.meta.url),
  "utf8",
);
const studentDetail = readFileSync(
  new URL("../components/students/student-detail-page.tsx", import.meta.url),
  "utf8",
);

test("student profile attendance loads one selected month and never starts twelve parallel requests", () => {
  assert.match(attendanceApi, /monthly-register/);
  assert.doesNotMatch(attendanceApi, /academic-year-summary/);
  assert.equal(
    (attendanceTab.match(/getStudentAttendanceMonthlyRegister/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(attendanceTab, /Promise\.all\([^)]*months/);
  assert.doesNotMatch(attendanceTab, /data\.months\.map\([^)]*useQuery/);
});

test("attendance restores academic year and BS month URL state and resets month on year change", () => {
  assert.match(attendanceTab, /ACADEMIC_YEAR_PARAM = ["']academicYearId["']/);
  assert.match(attendanceTab, /MONTH_PARAM = ["']month["']/);
  assert.match(attendanceTab, /searchParams\.get\(ACADEMIC_YEAR_PARAM\)/);
  assert.match(attendanceTab, /searchParams\.get\(MONTH_PARAM\)/);
  assert.match(attendanceTab, /next\.set\(["']tab["'], ["']attendance["']\)/);
  assert.match(attendanceTab, /navigation: ["']push["'] \| ["']replace["']/);
  assert.match(attendanceTab, /updateUrlState\(updates, ["']replace["']\)/);
  assert.match(studentDetail, /attendance: ["']Attendance["']/);
  assert.match(
    attendanceTab,
    /\[ACADEMIC_YEAR_PARAM\]: academicYearId,[\s\S]*\[MONTH_PARAM\]: null/,
  );
});

test("current-month navigation follows backend boundaries", () => {
  assert.match(attendanceTab, /disabled=\{!data\.previousMonthKey\}/);
  assert.match(attendanceTab, /disabled=\{!data\.nextMonthKey\}/);
  assert.match(attendanceTab, /data\.previousMonthKey && onSelectMonth/);
  assert.match(attendanceTab, /data\.nextMonthKey && onSelectMonth/);
  assert.match(attendanceTab, /data\.currentMonthKey/);
  assert.match(attendanceTab, /Current Month/);
  assert.match(attendanceTab, /month\.isAvailable/);
});

test("calendar uses Sunday-first BS labels and keeps day classes distinct", () => {
  assert.match(
    attendanceTab,
    /WEEKDAYS = \[[\s\S]*["']Sun["'],[\s\S]*["']Mon["']/,
  );
  assert.match(attendanceTab, /day\.dateBs\.slice\(-2\)/);
  assert.match(attendanceTab, /data\.days\[0\]\?\.weekday/);
  for (const state of [
    "SCHOOL_DAY",
    "HOLIDAY",
    "WEEKEND",
    "EXAM_DAY",
    "NOT_MARKED",
    "PRESENT",
    "ABSENT",
    "LATE",
  ]) {
    assert.match(attendanceTab, new RegExp(state));
  }
  assert.match(attendanceTab, /aria-label=\{tooltip\}/);
  assert.match(attendanceTab, /aria-pressed=\{selected\}/);
});

test("monthly totals and percentage render directly from the selected-month response", () => {
  for (const label of [
    "School Days",
    "Present",
    "Absent",
    "Late",
    "Leave",
    "Attendance",
  ]) {
    assert.match(attendanceTab, new RegExp(label));
  }
  assert.match(attendanceTab, /month\.totalSchoolDays/);
  assert.match(attendanceTab, /month\.attendancePercentage/);
  assert.doesNotMatch(
    attendanceTab,
    /days\.filter\([^)]*PRESENT[^)]*\)\.length/,
  );
});

test("loading, empty, partial, error, permission, locked, and expired-session states are explicit", () => {
  for (const copy of [
    "Loading attendance month",
    "Academic calendar unavailable",
    "No attendance month available",
    "Partial attendance data",
    "Selected month could not be loaded",
    "Permission denied",
    "Attendance module locked",
    "Session expired",
  ]) {
    assert.match(attendanceTab, new RegExp(copy));
  }
  assert.match(attendanceTab, /No previous-month data is[\s\S]*being shown/);
});

test("attendance uses installed shadcn composition, semantic tokens, and contained responsive surfaces", () => {
  for (const primitive of [
    "primitives/card",
    "primitives/button",
    "primitives/select",
    "primitives/badge",
    "primitives/tooltip",
    "primitives/separator",
    "primitives/skeleton",
    "primitives/alert",
    "primitives/table",
    "primitives/scroll-area",
    "primitives/empty",
  ]) {
    assert.match(attendanceTab, new RegExp(primitive.replace("/", "\\/")));
  }
  assert.match(attendanceTab, /min-w-\[640px\]/);
  assert.match(attendanceTab, /min-w-\[760px\]/);
  assert.match(attendanceTab, /bg-success-50/);
  assert.match(attendanceTab, /bg-danger-50/);
  assert.match(attendanceTab, /bg-warning-50/);
  assert.match(attendanceTab, /bg-info-50/);
  assert.doesNotMatch(
    attendanceTab,
    /(?:bg|text|border)-(?:red|green|blue|amber|yellow|emerald|orange)-\d+/,
  );
  assert.doesNotMatch(attendanceTab, /space-[xy]-/);
  assert.doesNotMatch(
    attendanceTab,
    /Back to profile|studentSystemId|onBackToProfile/i,
  );
});
