import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AttendanceDraftStorageFence,
  AttendanceDraftStorageInvalidatedError,
} from "../lib/attendance-draft-storage-fence.ts";

describe("attendance draft storage fence", () => {
  it("orders teardown after an active write and rejects every stale late write", async () => {
    const fence = new AttendanceDraftStorageFence();
    const staleTicket = fence.captureTicket();
    const events = [];
    let releaseActiveWrite;
    let markActiveWriteStarted;
    const activeWriteStarted = new Promise((resolve) => {
      markActiveWriteStarted = resolve;
    });
    const activeWriteGate = new Promise((resolve) => {
      releaseActiveWrite = resolve;
    });

    const activeWrite = fence.run(staleTicket, async () => {
      events.push("active-write");
      markActiveWriteStarted();
      await activeWriteGate;
    });
    await activeWriteStarted;

    const cleanupTicket = fence.invalidate();
    const cleanup = fence.run(cleanupTicket, () => {
      events.push("clear");
    });
    const lateWrite = fence.run(staleTicket, () => {
      events.push("late-write");
    });

    releaseActiveWrite();

    await assert.rejects(activeWrite, AttendanceDraftStorageInvalidatedError);
    await cleanup;
    await assert.rejects(lateWrite, AttendanceDraftStorageInvalidatedError);
    assert.deepEqual(events, ["active-write", "clear"]);
  });

  it("accepts only tickets from the current generation", async () => {
    const fence = new AttendanceDraftStorageFence();
    const first = fence.captureTicket();
    const second = fence.invalidate();

    assert.equal(fence.isCurrent(first), false);
    assert.equal(fence.isCurrent(second), true);
    await assert.rejects(
      fence.run(first, () => undefined),
      AttendanceDraftStorageInvalidatedError,
    );
    await assert.doesNotReject(fence.run(second, () => undefined));
  });
});
