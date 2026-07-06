import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFilterHref,
  buildFilterQuery,
  parseUrlFilters,
} from "../lib/hooks/url-filters.ts";

describe("URL filter state (parseUrlFilters)", () => {
  it("falls back to defaults when nothing is in the URL", () => {
    const values = parseUrlFilters(
      { page: 1, search: "", status: "" },
      new URLSearchParams(""),
    );
    assert.deepEqual(values, { page: 1, search: "", status: "" });
  });

  it("reads present keys and coerces numeric defaults", () => {
    const values = parseUrlFilters(
      { page: 1, search: "" },
      new URLSearchParams("page=3&search=aarav"),
    );
    assert.deepEqual(values, { page: 3, search: "aarav" });
  });

  it("falls back to the numeric default when the URL value is not a valid number", () => {
    const values = parseUrlFilters(
      { page: 1 },
      new URLSearchParams("page=not-a-number"),
    );
    assert.equal(values.page, 1);
  });

  it("ignores URL keys that are not declared in defaults", () => {
    const values = parseUrlFilters(
      { page: 1 },
      new URLSearchParams("page=2&utm_source=email"),
    );
    assert.deepEqual(values, { page: 2 });
  });
});

describe("URL filter state (buildFilterQuery)", () => {
  it("adds a non-default value as a query param", () => {
    const query = buildFilterQuery(
      { page: 1, search: "" },
      new URLSearchParams(""),
      { search: "aarav" },
    );
    assert.equal(query, "search=aarav");
  });

  it("removes a param when the update matches the default (keeps URLs clean)", () => {
    const query = buildFilterQuery(
      { page: 1, search: "" },
      new URLSearchParams("page=3&search=aarav"),
      { search: "" },
    );
    assert.equal(query, "page=3");
  });

  it("removes a param when the update is page 1 (the default)", () => {
    const query = buildFilterQuery(
      { page: 1 },
      new URLSearchParams("page=5"),
      { page: 1 },
    );
    assert.equal(query, "");
  });

  it("preserves other existing params untouched", () => {
    const query = buildFilterQuery(
      { page: 1, search: "" },
      new URLSearchParams("page=2&status=overdue"),
      { search: "sita" },
    );
    const params = new URLSearchParams(query);
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("status"), "overdue");
    assert.equal(params.get("search"), "sita");
  });

  it("resets the page param when resetPage is true and page was not itself part of this update", () => {
    const query = buildFilterQuery(
      { page: 1, search: "" },
      new URLSearchParams("page=4"),
      { search: "aarav" },
      { resetPage: true },
    );
    const params = new URLSearchParams(query);
    assert.equal(params.has("page"), false);
    assert.equal(params.get("search"), "aarav");
  });

  it("does not clobber an explicit page change even when resetPage is true", () => {
    const query = buildFilterQuery(
      { page: 1, search: "" },
      new URLSearchParams("page=1&search=aarav"),
      { page: 2 },
      { resetPage: true },
    );
    const params = new URLSearchParams(query);
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("search"), "aarav");
  });
});

describe("URL filter state (buildFilterHref)", () => {
  it("does not navigate when the requested query already matches the URL", () => {
    assert.equal(
      buildFilterHref(
        "/dashboard/students",
        "academicYearId=year-1&page=2",
        "academicYearId=year-1&page=2",
      ),
      null,
    );
  });

  it("builds a replacement href only when filters change", () => {
    assert.equal(
      buildFilterHref(
        "/dashboard/students",
        "academicYearId=year-1",
        "academicYearId=year-1&page=2",
      ),
      "/dashboard/students?academicYearId=year-1&page=2",
    );
    assert.equal(
      buildFilterHref("/dashboard/students", "search=aarav", ""),
      "/dashboard/students",
    );
  });
});
