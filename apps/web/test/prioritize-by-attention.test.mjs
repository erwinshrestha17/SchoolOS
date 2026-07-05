import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prioritizeByAttention } from "../lib/dashboard/prioritize-by-attention.ts";

function module(key, attentionItems = []) {
  return { module: key, attentionItems };
}

describe("dashboard module card prioritization by attention severity", () => {
  it("keeps original order when nothing needs attention (the common case)", () => {
    const modules = [module("m2_attendance"), module("m3_fees"), module("m8b_transport")];
    const result = prioritizeByAttention(modules);
    assert.deepEqual(
      result.map((m) => m.module),
      ["m2_attendance", "m3_fees", "m8b_transport"],
    );
  });

  it("moves a module with a critical item to the front, regardless of list position", () => {
    const modules = [
      module("m2_attendance"),
      module("m3_fees", [{ severity: "critical", count: 4 }]),
      module("m8b_transport"),
    ];
    const result = prioritizeByAttention(modules);
    assert.equal(result[0].module, "m3_fees");
  });

  it("ranks critical above warning above info regardless of count", () => {
    const modules = [
      module("m8b_transport", [{ severity: "info", count: 50 }]),
      module("m2_attendance", [{ severity: "warning", count: 1 }]),
      module("m3_fees", [{ severity: "critical", count: 1 }]),
    ];
    const result = prioritizeByAttention(modules);
    assert.deepEqual(
      result.map((m) => m.module),
      ["m3_fees", "m2_attendance", "m8b_transport"],
    );
  });

  it("breaks a same-severity tie by total attention count", () => {
    const modules = [
      module("m2_attendance", [{ severity: "warning", count: 2 }]),
      module("m3_fees", [{ severity: "warning", count: 9 }]),
    ];
    const result = prioritizeByAttention(modules);
    assert.deepEqual(
      result.map((m) => m.module),
      ["m3_fees", "m2_attendance"],
    );
  });

  it("sums multiple attention items on the same module for the count tiebreak", () => {
    const modules = [
      module("m2_attendance", [
        { severity: "warning", count: 2 },
        { severity: "warning", count: 2 },
      ]),
      module("m3_fees", [{ severity: "warning", count: 3 }]),
    ];
    const result = prioritizeByAttention(modules);
    // attendance: 2 + 2 = 4 total, beats fees' 3.
    assert.equal(result[0].module, "m2_attendance");
  });

  it("does not mutate the input array", () => {
    const modules = [module("m2_attendance"), module("m3_fees", [{ severity: "critical", count: 1 }])];
    const original = [...modules];
    prioritizeByAttention(modules);
    assert.deepEqual(modules, original);
  });
});
