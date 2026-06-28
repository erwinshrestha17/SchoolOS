import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function componentFiles(relativeDirectory) {
  const directory = join(webRoot, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return componentFiles(relativePath);
    return /\.[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  });
}

describe("SchoolOS Nepal BS Date Utility Contracts", () => {
  it("delegates legacy web formatting to the canonical core policy", () => {
    const dateUtils = read("lib/date-utils.ts");
    assert.match(dateUtils, /@schoolos\/core/);
    assert.match(dateUtils, /coreFormatBsDate/);
    assert.match(dateUtils, /toBsDateFromGregorian/);
    assert.doesNotMatch(dateUtils, /BS_CALENDAR_DATA/);
  });

  it("keeps compatibility helpers but forces school-facing BS output", () => {
    const dateUtils = read("lib/date-utils.ts");
    assert.match(dateUtils, /export function formatAdDate/);
    assert.match(dateUtils, /export function formatBsDate/);
    assert.match(dateUtils, /export function formatSchoolDate/);
    assert.match(dateUtils, /DateDisplayMode/);
    assert.match(dateUtils, /displays BS only/);
  });

  it("keeps dashboard usage on the shared date utility", () => {
    const dashboardPage = read("app/dashboard/page.tsx");
    assert.match(dashboardPage, /formatSchoolDate/);
    assert.doesNotMatch(dashboardPage, /const formatDate =/);
  });

  it("keeps school-facing dashboard code off browser-local date rendering", () => {
    const files = [
      ...componentFiles("app/dashboard"),
      ...componentFiles("components"),
    ];

    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /\.toLocaleDateString\(/, file);
      assert.doesNotMatch(source, /\.toLocaleTimeString\(/, file);
      assert.doesNotMatch(source, /new Date\([^)]*\)\.toLocaleString\(/, file);
      assert.doesNotMatch(source, /new Intl\.DateTimeFormat\(/, file);
    }
  });
});
