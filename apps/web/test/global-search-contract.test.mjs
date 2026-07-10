import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("global topbar search (students + invoices)", () => {
  const search = read("components/layout/global-student-search.tsx");

  it("keeps student search real-API-backed and permission-gated", () => {
    assert.match(search, /\/students\/search\?q=/);
    assert.match(search, /canSearchStudents = hasPermissions\(\['students:read'\]\)/);
  });

  it("gates invoice search behind the same permission the backend route requires", () => {
    // GET /fees/invoices is guarded by @Permissions('payments:collect') on
    // the backend (apps/api/src/finance/fees.controller.ts) — the frontend
    // gate must match exactly, not a broader finance permission.
    assert.match(search, /canSearchInvoices = hasPermissions\(\['payments:collect'\]\)/);
    assert.match(search, /api\.listInvoices\(\{ search: debouncedQuery, limit: 5 \}\)/);
  });

  it("does not invent a search entity the backend has no query support for", () => {
    // Staff directory search exists on the backend but M7 HR/Payroll is out
    // of scope; Notices (GET /notices) has no query params at all. Neither
    // should be wired into global search.
    assert.doesNotMatch(search, /staff\/directory/);
    assert.doesNotMatch(search, /\/notices\?/);
  });

  it("routes invoice results through the canonical fees collection contract", () => {
    assert.match(search, /\/dashboard\/fees\/collect\?\$\{params\.toString\(\)\}/);
    assert.match(search, /params\.set\('invoiceId', entry\.invoice\.id\)/);
  });

  it("navigates a combined, keyboard-accessible result list", () => {
    assert.match(search, /results\.length\) % results\.length|current \+ 1\) % results\.length/);
    assert.match(search, /event\.key === 'Enter'/);
    assert.match(search, /event\.key === 'Escape'/);
    assert.match(search, /data-testid="global-student-search-result"/);
    assert.match(search, /data-testid="global-invoice-search-result"/);
  });

  it("keeps the module color tokens instead of ad-hoc colors", () => {
    assert.match(search, /bg-\[var\(--primary-soft\)\]/);
  });
});
