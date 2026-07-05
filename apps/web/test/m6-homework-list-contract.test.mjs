import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

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
    assert.match(page, /limit: HOMEWORK_PAGE_SIZE/);
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

    assert.match(page, /row\.submissionSummary\?\.total/);
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
});
