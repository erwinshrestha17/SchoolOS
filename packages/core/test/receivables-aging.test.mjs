import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agingBucketForDays,
  daysBetweenGregorianDates,
  daysOverdueOn,
  nepalDateOf,
  RECEIVABLES_AGING_BUCKET_LABELS,
} from "../dist/index.js";

describe("receivables aging (Phase 7.11b)", () => {
  it("buckets by whole days overdue with established keys", () => {
    assert.equal(agingBucketForDays(0), "CURRENT");
    assert.equal(agingBucketForDays(1), "0-30");
    assert.equal(agingBucketForDays(30), "0-30");
    assert.equal(agingBucketForDays(31), "31-60");
    assert.equal(agingBucketForDays(60), "31-60");
    assert.equal(agingBucketForDays(61), "61-90");
    assert.equal(agingBucketForDays(90), "61-90");
    assert.equal(agingBucketForDays(91), "90+");
    assert.equal(RECEIVABLES_AGING_BUCKET_LABELS["0-30"], "1–30 days overdue");
  });

  it("counts calendar days, not 24-hour blocks", () => {
    assert.equal(daysBetweenGregorianDates("2026-02-28", "2026-03-01"), 1);
    assert.equal(daysBetweenGregorianDates("2028-02-28", "2028-03-01"), 2);
    assert.equal(daysBetweenGregorianDates("2026-12-31", "2027-01-01"), 1);
  });

  it("uses the Nepal date of the due instant", () => {
    // 2026-08-14T19:00Z is 2026-08-15 00:45 in Nepal.
    assert.equal(nepalDateOf("2026-08-14T19:00:00.000Z"), "2026-08-15");
    // A date-only due date stored at UTC midnight keeps its date.
    assert.equal(nepalDateOf("2026-08-15T00:00:00.000Z"), "2026-08-15");
    assert.equal(daysOverdueOn("2026-08-15T00:00:00.000Z", "2026-08-15"), 0);
    assert.equal(daysOverdueOn("2026-08-15T00:00:00.000Z", "2026-08-16"), 1);
    assert.equal(daysOverdueOn("2026-08-14T19:00:00.000Z", "2026-08-16"), 1);
    // Not yet due is never negative.
    assert.equal(daysOverdueOn("2026-09-01T00:00:00.000Z", "2026-08-16"), 0);
  });
});
