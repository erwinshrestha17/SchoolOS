import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const webRoot = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), "utf8");

describe("shared icon accessibility primitives", () => {
  it("Tooltip shows on hover and keyboard focus, and links via aria-describedby", () => {
    const tooltip = read("components/ui/tooltip.tsx");

    assert.match(tooltip, /role="tooltip"/);
    assert.match(tooltip, /onMouseEnter/);
    assert.match(tooltip, /onFocus/);
    assert.match(tooltip, /aria-describedby/);
  });

  it("IconButton requires a label and always renders a tooltip plus aria-label", () => {
    const iconButton = read("components/ui/icon-button.tsx");

    assert.match(iconButton, /label: string/);
    assert.doesNotMatch(iconButton, /label\?: string/);
    assert.match(iconButton, /<Tooltip content=\{label\}/);
    assert.match(iconButton, /aria-label=\{label\}/);
  });

  it("ProtectedFileButton auto-wraps its icon-only variant with a tooltip", () => {
    const protectedFile = read("components/ui/protected-file.tsx");

    assert.match(protectedFile, /aria-label=\{accessibleName\}/);
    assert.match(
      protectedFile,
      /size === 'icon' \? <Tooltip content=\{accessibleName\}>\{button\}<\/Tooltip> : button/,
    );
  });

  it("keeps destructive row actions text-first instead of icon-only", () => {
    const weeklyRequirements = read(
      "components/timetable/weekly-requirements-list.tsx",
    );

    // Delete is an explicitly-listed high-risk action — must show visible
    // text, not just an accessible name on an icon-only button.
    assert.doesNotMatch(
      weeklyRequirements,
      /size="icon"[\s\S]{0,120}onClick=\{\(\) => setDeleteTarget\(row\)\}/,
    );
    assert.match(weeklyRequirements, />\s*Delete\s*</);
    assert.match(weeklyRequirements, /<Tooltip content="Edit weekly requirement">/);
  });

  it("shows visible text on the homework attachment preview action instead of a bare icon", () => {
    const detailPage = read("components/homework/homework-detail-page.tsx");
    const reviewModal = read("components/homework/homework-review-modal.tsx");

    assert.doesNotMatch(detailPage, /Download className="h-4 w-4" \/>\s*<\/Button>/);
    assert.doesNotMatch(reviewModal, /Download className="h-4 w-4" \/>\s*<\/Button>/);
    assert.match(detailPage, />\s*View\s*</);
    assert.match(reviewModal, />\s*View\s*</);
  });

  it("renders a real icon plus loading state on the dashboard Refresh control, never a blank button", () => {
    const summary = read("components/ui/operational-summary.tsx");

    assert.match(summary, /export function RefreshSummaryButton/);
    assert.match(summary, /<RefreshCw[\s\S]{0,80}size=\{18\}/);
    assert.match(summary, /aria-label=\{isLoading \? "Refreshing dashboard" : "Refresh dashboard"\}/);
    assert.match(summary, /title=\{isLoading \? "Refreshing dashboard" : "Refresh dashboard"\}/);
    assert.match(summary, /disabled=\{isLoading\}/);
  });

  it("gives the ActionMenu default icon-only trigger both an aria-label and a title", () => {
    const actionMenu = read("components/ui/action-menu.tsx");

    // This is the canonical trigger every ModuleHeader "More Actions" menu
    // renders when no custom trigger is supplied — an aria-label alone is
    // not enough for a mouse user with no visible text on the button.
    assert.match(actionMenu, /<MoreHorizontal size=\{18\}/);
    assert.match(actionMenu, /aria-label=\{label\}\s*\n\s*title=\{label\}/);
  });

  it("gives back/navigation icon buttons a tooltip and accessible name", () => {
    const detailPage = read("components/homework/homework-detail-page.tsx");
    const newHomeworkPage = read("app/dashboard/homework/new/page.tsx");
    const substitutionsTab = read(
      "components/timetable/tabs/substitutions-tab.tsx",
    );

    assert.match(detailPage, /Tooltip content="Back to homework"/);
    assert.match(newHomeworkPage, /Tooltip content="Back to homework"/);
    assert.match(substitutionsTab, /Tooltip content="Previous day"/);
    assert.match(substitutionsTab, /Tooltip content="Next day"/);
  });
});
