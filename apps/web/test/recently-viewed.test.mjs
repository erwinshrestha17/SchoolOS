import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearRecentlyViewed,
  RECENTLY_VIEWED_MAX_ENTRIES,
  RECENTLY_VIEWED_STORAGE_KEY,
  readRecentlyViewed,
  recordRecentlyViewed,
} from "../lib/recently-viewed.ts";

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    _raw: store,
  };
}

describe("recently-viewed trail", () => {
  it("returns an empty list when nothing is stored", () => {
    assert.deepEqual(readRecentlyViewed(fakeStorage()), []);
  });

  it("ignores corrupted JSON instead of throwing", () => {
    const storage = fakeStorage({ [RECENTLY_VIEWED_STORAGE_KEY]: "{not json" });
    assert.deepEqual(readRecentlyViewed(storage), []);
  });

  it("ignores entries missing required fields (e.g. from a future schema change)", () => {
    const storage = fakeStorage({
      [RECENTLY_VIEWED_STORAGE_KEY]: JSON.stringify([
        { kind: "student", id: "s1" }, // missing label/href/viewedAt
        { kind: "bogus-kind", id: "s2", label: "x", href: "/x", viewedAt: "now" },
      ]),
    });
    assert.deepEqual(readRecentlyViewed(storage), []);
  });

  it("records a new entry at the front", () => {
    const storage = fakeStorage();
    const result = recordRecentlyViewed(storage, {
      kind: "student",
      id: "student-1",
      label: "Aarav Shrestha",
      href: "/dashboard/students/student-1",
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "student-1");
    assert.ok(result[0].viewedAt);
  });

  it("moves an already-viewed record to the front instead of duplicating it", () => {
    const storage = fakeStorage();
    recordRecentlyViewed(storage, {
      kind: "student",
      id: "s1",
      label: "Aarav",
      href: "/a",
    });
    recordRecentlyViewed(storage, {
      kind: "invoice",
      id: "inv-1",
      label: "INV-001",
      href: "/b",
    });
    const result = recordRecentlyViewed(storage, {
      kind: "student",
      id: "s1",
      label: "Aarav Shrestha (updated)",
      href: "/a",
    });
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "s1");
    assert.equal(result[0].label, "Aarav Shrestha (updated)");
    assert.equal(result[1].id, "inv-1");
  });

  it("distinguishes entries with the same id but different kinds", () => {
    const storage = fakeStorage();
    recordRecentlyViewed(storage, {
      kind: "student",
      id: "same-id",
      label: "Student",
      href: "/s",
    });
    const result = recordRecentlyViewed(storage, {
      kind: "invoice",
      id: "same-id",
      label: "Invoice",
      href: "/i",
    });
    assert.equal(result.length, 2);
  });

  it("caps the list at RECENTLY_VIEWED_MAX_ENTRIES, dropping the oldest", () => {
    const storage = fakeStorage();
    for (let i = 0; i < RECENTLY_VIEWED_MAX_ENTRIES + 3; i += 1) {
      recordRecentlyViewed(storage, {
        kind: "student",
        id: `s${i}`,
        label: `Student ${i}`,
        href: `/s${i}`,
      });
    }
    const result = readRecentlyViewed(storage);
    assert.equal(result.length, RECENTLY_VIEWED_MAX_ENTRIES);
    // Most recent (last recorded) stays at the front; oldest were evicted.
    assert.equal(result[0].id, `s${RECENTLY_VIEWED_MAX_ENTRIES + 2}`);
    assert.equal(result.some((item) => item.id === "s0"), false);
  });

  it("clears the stored trail entirely", () => {
    const storage = fakeStorage();
    recordRecentlyViewed(storage, {
      kind: "notice",
      id: "n1",
      label: "Holiday notice",
      href: "/n",
    });
    clearRecentlyViewed(storage);
    assert.deepEqual(readRecentlyViewed(storage), []);
  });
});
