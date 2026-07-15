import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("recently-viewed storage stays centralized in lib/session.ts", () => {
  it("keeps the pure logic module storage-agnostic", () => {
    const pureModule = read("lib/recently-viewed.ts");
    assert.doesNotMatch(pureModule, /localStorage|sessionStorage/);
  });

  it("only lib/session.ts touches localStorage for it, not the hook", () => {
    const hook = read("lib/hooks/use-recently-viewed.ts");
    assert.doesNotMatch(hook, /localStorage|sessionStorage/);
    assert.match(hook, /from '\.\.\/session'/);

    const session = read("lib/session.ts");
    assert.match(session, /export function readRecentlyViewed/);
    assert.match(session, /export function recordRecentlyViewed/);
    assert.match(session, /export function clearRecentlyViewed/);
  });

  it("clears the trail when the session is cleared (shared front-desk computer safety)", () => {
    const hook = read("lib/hooks/use-recently-viewed.ts");
    assert.match(hook, /SESSION_CLEARED_EVENT/);
    assert.match(hook, /clearRecentlyViewed\(\)/);
  });
});

describe("recently-viewed is actually recorded on the three real detail views", () => {
  it("records a student view once the profile loads", () => {
    const page = read("components/students/student-detail-page.tsx");
    assert.match(page, /useRecentlyViewed/);
    assert.match(page, /kind: ["']student["']/);
  });

  it("records an invoice view once the invoice is resolved from real collection context data", () => {
    const page = read("components/finance/fees-workspace.tsx");
    assert.match(page, /useRecentlyViewed/);
    assert.match(page, /kind: "invoice"/);
    // Must come from the real backend response, not be fabricated from the URL alone.
    assert.match(
      page,
      /studentContextQuery\.data\?\.invoices\.find/,
    );
  });

  it("records a notice view once the notice loads", () => {
    const page = read("app/dashboard/notices/[noticeId]/page.tsx");
    assert.match(page, /useRecentlyViewed/);
    assert.match(page, /kind: "notice"/);
  });
});

describe("command palette surfaces recently-viewed records, not just workspaces", () => {
  const palette = read("components/layout/command-palette.tsx");

  it("shows a Recently viewed section sourced from the real hook", () => {
    assert.match(palette, /useRecentlyViewed/);
    assert.match(palette, /Recently viewed/);
  });

  it("caps recently-viewed rows instead of showing unbounded history", () => {
    assert.match(palette, /MAX_RECENT_ROWS/);
    assert.match(palette, /\.slice\(0, MAX_RECENT_ROWS\)/);
  });
});
