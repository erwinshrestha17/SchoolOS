import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateSmsSegments } from "../lib/sms-segments.ts";

describe("SMS segment estimate (GSM 03.38 / UCS-2, 3GPP TS 23.038)", () => {
  it("returns zero segments for empty text", () => {
    assert.deepEqual(estimateSmsSegments(""), {
      segments: 0,
      encoding: "GSM-7",
      singleSegmentLimit: 160,
    });
  });

  it("treats plain ASCII school notice text as GSM-7 single segment up to 160 chars", () => {
    const result = estimateSmsSegments(
      "School will remain closed tomorrow due to heavy rainfall.",
    );
    assert.equal(result.encoding, "GSM-7");
    assert.equal(result.segments, 1);
  });

  it("stays at 1 GSM-7 segment at exactly the 160-character boundary", () => {
    assert.equal(estimateSmsSegments("a".repeat(160)).segments, 1);
  });

  it("moves to 2 concatenated GSM-7 segments just past the 160-character boundary", () => {
    assert.equal(estimateSmsSegments("a".repeat(161)).segments, 2);
  });

  it("uses the 153-char concatenated-segment budget once split, not 160", () => {
    // 161 chars needs 2 segments; 306 chars (2 * 153) should still fit in 2.
    assert.equal(estimateSmsSegments("a".repeat(306)).segments, 2);
    // 307 chars must spill into a 3rd segment.
    assert.equal(estimateSmsSegments("a".repeat(307)).segments, 3);
  });

  it("forces UCS-2 for any Devanagari (Nepali) text, not the 160-char GSM-7 budget", () => {
    const result = estimateSmsSegments("भोलि विद्यालय बन्द रहनेछ।");
    assert.equal(result.encoding, "UCS-2");
    assert.equal(result.singleSegmentLimit, 70);
  });

  it("forces UCS-2 for the whole message even with a single non-GSM character mixed in", () => {
    const result = estimateSmsSegments("Meeting at 5pm — do not miss it");
    assert.equal(result.encoding, "UCS-2");
  });

  it("stays at 1 UCS-2 segment at exactly the 70-character boundary", () => {
    assert.equal(estimateSmsSegments("क".repeat(70)).segments, 1);
  });

  it("moves to 2 concatenated UCS-2 segments just past the 70-character boundary", () => {
    assert.equal(estimateSmsSegments("क".repeat(71)).segments, 2);
  });

  it("counts GSM-7 extended-table characters (e.g. the euro sign) as two septets", () => {
    // 158 plain chars (158 septets) + 1 extended char (2 septets) = 160 septets, still 1 segment.
    assert.equal(estimateSmsSegments(`${"a".repeat(158)}€`).segments, 1);
    // 159 plain chars (159 septets) + 1 extended char (2 septets) = 161 septets, spills to 2 segments.
    assert.equal(estimateSmsSegments(`${"a".repeat(159)}€`).segments, 2);
  });
});
