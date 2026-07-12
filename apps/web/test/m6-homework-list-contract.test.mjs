import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

// Rewritten for the M6 homework redesign (fuzzy-gliding-hopper.md): homework
// is now a standalone, single-route, 4-tab workspace fully decoupled from
// timetable, with 5 backend-driven KPI cards and no "Supporting homework
// tools" disclosure — Templates and Completion are real tabs now.
describe("M6 homework list contract", () => {
  it("uses the backend page contract with URL-backed filters and pagination", () => {
    const page = read("app/dashboard/homework/page.tsx");
    const api = read("lib/api/academics.ts");

    assert.match(api, /listHomeworkPage/);
    assert.match(api, /request<HomeworkAssignmentPage>/);
    assert.match(api, /result\) => result\.items/);
    assert.match(page, /useUrlFilters/);
    assert.match(page, /api\.listHomeworkPage/);
    assert.match(page, /filters\.search/);
    assert.match(page, /filters\.classId/);
    assert.match(page, /filters\.sectionId/);
    assert.match(page, /filters\.subjectId/);
    assert.match(page, /filters\.status/);
    assert.match(page, /HOMEWORK_PAGE_SIZE/);
    assert.match(page, /<TablePagination/);
    assert.match(page, /homeworkMeta\.total/);
    assert.match(page, /setFilters\(\{ page \}\)/);
  });

  it("keeps quick inspection in a drawer and protected files behind the helper", () => {
    const page = read("app/dashboard/homework/page.tsx");
    const api = read("lib/api/academics.ts");

    assert.match(page, /<Drawer/);
    assert.match(page, /Quick View/);
    assert.match(page, /onClick=\{\(\) => setSelectedHomework\(row\)\}/);
    assert.doesNotMatch(page, /onRowClick=\{setSelectedHomework\}/);
    assert.match(page, /openHomeworkAttachmentPreview/);
    assert.match(page, /Attachment unavailable/);
    assert.match(api, /openProtectedFile\(access\.fileAssetId/);
    assert.doesNotMatch(page, /window\.open|signedUrl|objectKey|bucket/);
  });

  it("uses backend submission counts instead of a fabricated progress bar", () => {
    const page = read("app/dashboard/homework/page.tsx");

    assert.match(page, /submissionSummary\.total/);
    assert.doesNotMatch(page, /row\.submissions\?\.length/);
    assert.doesNotMatch(page, /Math\.min\(100,[\s\S]*submissions/);
  });

  it("keeps permission, retry, empty, no-result, and stale-data states explicit", () => {
    const page = read("app/dashboard/homework/page.tsx");

    assert.match(page, /ApiRequestError/);
    assert.match(page, /statusCode === 403/);
    assert.match(page, /onRetry=\{\(\) => void homeworkQuery\.refetch\(\)\}/);
    assert.match(page, /No homework matches these filters/);
    assert.match(page, /No homework assignments yet/);
    assert.match(page, /May be stale/);
    assert.match(page, /canCreateHomework/);
    assert.match(page, /canReviewHomework/);
  });

  it("sources the 5 summary cards from the real per-role backend endpoint", () => {
    const page = read("app/dashboard/homework/page.tsx");

    // Regression guard for the recurring "loading-literal" KPI bug: value
    // must never fall back to the bare string "Loading" — a separate
    // `loading` prop drives the spinner state instead.
    assert.doesNotMatch(page, /value=\{isLoading \? ['"]Loading['"]/);
    assert.match(page, /api\.getHomeworkSummaryToday\(\)/);
    assert.match(page, /summary\?\.givenToday/);
    assert.match(page, /summary\?\.dueToday/);
    assert.match(page, /summary\?\.notChecked/);
    assert.match(page, /summary\?\.incompleteStudents/);
    assert.match(page, /summary\?\.classesWithoutHomework/);
    assert.doesNotMatch(page, /api\.getModuleSummary\("homework-timetable"\)/);
  });

  it("keeps the header within the 4-tab / 5-KPI budget and fully decoupled from timetable", () => {
    const page = read("app/dashboard/homework/page.tsx");

    assert.equal(
      (page.match(/\{ value: "(?:today|all|completion|templates)", label: /g) ?? [])
        .length,
      4,
    );
    assert.equal((page.match(/<KpiCard/g) ?? []).length, 5);
    assert.doesNotMatch(page, /title="Homework Assigned"/);
    assert.doesNotMatch(page, /title="Pending Submissions"/);
    assert.doesNotMatch(page, /title="Timetable Conflicts"/);
    assert.doesNotMatch(page, /title="Teacher Workload"/);
    assert.doesNotMatch(page, /\/dashboard\/timetable/);
    assert.doesNotMatch(page, /Supporting homework tools/);
  });

  it("gates the Templates and Completion tabs' queries behind the active tab", () => {
    const page = read("app/dashboard/homework/page.tsx");

    assert.match(page, /enabled: activeTab === "templates"/);
    assert.match(page, /enabled: activeTab === "completion"/);
    assert.match(page, /api\.listHomeworkTemplates/);
    assert.match(page, /api\.getHomeworkCompletionReport/);
  });
});
