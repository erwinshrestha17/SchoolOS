import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAttendanceDraftRead } from "../lib/attendance-draft-read-result.ts";

describe("attendance draft read result", () => {
  it("does not collapse a rejected storage read into a missing draft", async () => {
    const result = await resolveAttendanceDraftRead(async () => {
      throw new Error("IndexedDB transaction aborted");
    });

    assert.deepEqual(result, { status: "unavailable" });
  });

  it("keeps real missing and found reads distinct", async () => {
    await assert.doesNotReject(async () => {
      assert.deepEqual(await resolveAttendanceDraftRead(async () => null), {
        status: "missing",
      });
      assert.deepEqual(
        await resolveAttendanceDraftRead(async () => ({ id: "draft-1" })),
        { status: "found", draft: { id: "draft-1" } },
      );
    });
  });
});
