import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

const w3AcademicsSubRoutes = [
  "app/dashboard/academics/exam-terms/page.tsx",
  "app/dashboard/academics/exams/page.tsx",
  "app/dashboard/academics/assessment-components/page.tsx",
  "app/dashboard/academics/marks/page.tsx",
  "app/dashboard/academics/cas/page.tsx",
  "app/dashboard/academics/locks/page.tsx",
  "app/dashboard/academics/retakes/page.tsx",
  "app/dashboard/academics/results/page.tsx",
  "app/dashboard/academics/promotion/page.tsx",
  "app/dashboard/academics/publishing/page.tsx",
  "app/dashboard/academics/report-cards/page.tsx",
];

describe("W3 component polish contracts", () => {
  it("uses ModuleHeader (not PageHeader) on academics sub-routes", () => {
    for (const route of w3AcademicsSubRoutes) {
      const source = read(route);
      assert.doesNotMatch(
        source,
        /<PageHeader/,
        `${route} must not use legacy PageHeader`,
      );
      assert.match(
        source,
        /ModuleHeader|AcademicsSectionPage/,
        `${route} must use ModuleHeader or AcademicsSectionPage`,
      );
    }
  });

  it("wires attendance mark surfaces to shared Button and override-safe lock gating", () => {
    const form = read("components/forms/attendance-form.tsx");
    const rosterItem = read("components/attendance/attendance-roster-item.tsx");

    assert.match(form, /from "@\/components\/ui\/button"/);
    assert.match(form, /rosterEditingDisabled/);
    assert.match(form, /isOverrideMode/);
    assert.match(rosterItem, /from '@\/components\/ui\/button'/);
  });

  it("uses shared Button on priority M3 fee collection surfaces", () => {
    for (const path of [
      "components/finance/collection-counter.tsx",
      "components/finance/collection-section.tsx",
      "components/finance/cashier-close-section.tsx",
    ]) {
      const source = read(path);
      assert.match(source, /from '@\/components\/ui\/button'/);
    }
  });

  it("gates M1 student directory actions with shared Button and StatusBadge", () => {
    const directory = read("components/forms/student-directory.tsx");
    assert.match(directory, /from '@\/components\/ui\/button'/);
    assert.match(directory, /StatusBadge/);
  });

  it("uses ModuleHeader on notice detail and shared Button on composer/review", () => {
    const noticeDetail = read("app/dashboard/notices/[noticeId]/page.tsx");
    const composer = read("components/notices/notice-composer-workspace.tsx");
    const review = read("components/notices/notice-review-workspace.tsx");

    assert.doesNotMatch(noticeDetail, /<PageHeader/);
    assert.match(noticeDetail, /ModuleHeader/);
    assert.match(composer, /from '@\/components\/ui\/button'/);
    assert.match(review, /from '@\/components\/ui\/button'/);
  });

  it("uses StatusBadge on academics lock and publishing tabs", () => {
    const marksLock = read("components/academics/tabs/marks-lock-tab.tsx");
    const publishing = read("components/academics/tabs/result-publishing-tab.tsx");

    assert.match(marksLock, /StatusBadge/);
    assert.match(marksLock, /LoadingState/);
    assert.match(publishing, /StatusBadge/);
    assert.match(publishing, /from '@\/components\/ui\/button'/);
  });

  it("uses shared Button on priority M4 academics tab workspaces", () => {
    for (const path of [
      "components/academics/tabs/marks-entry-tab.tsx",
      "components/academics/tabs/cas-records-tab.tsx",
      "components/academics/tabs/promotion-tab.tsx",
      "components/academics/tabs/exam-terms-tab.tsx",
    ]) {
      const source = read(path);
      assert.match(
        source,
        /from ['"]@\/components\/ui\/button['"]|from ['"]\.\.\/\.\.\/ui\/button['"]/,
        `${path} must import shared Button`,
      );
      assert.doesNotMatch(
        source,
        /<button[\s\S]{0,120}bg-\[var\(--color-mod-academics-accent\)\]/,
        `${path} must not use module-accent raw buttons`,
      );
    }
  });

  it("uses StatusBadge on promotion and exam-terms tabs", () => {
    const promotion = read("components/academics/tabs/promotion-tab.tsx");
    const examTerms = read("components/academics/tabs/exam-terms-tab.tsx");

    assert.match(promotion, /StatusBadge/);
    assert.match(examTerms, /StatusBadge/);
  });

  it("uses shared loading and empty states on marks-entry and promotion tabs", () => {
    const marksEntry = read("components/academics/tabs/marks-entry-tab.tsx");
    const promotion = read("components/academics/tabs/promotion-tab.tsx");

    assert.match(marksEntry, /LoadingState/);
    assert.match(marksEntry, /EmptyState/);
    assert.match(marksEntry, /ErrorState/);
    assert.match(promotion, /LoadingState/);
    assert.match(promotion, /EmptyState/);
  });
});
