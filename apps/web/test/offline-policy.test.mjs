import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OFFLINE_MUTATION_MESSAGE,
  canStorePendingAttendanceDraft,
  getBrowserSessionIdentity,
  hasSameBrowserSessionIdentity,
  isConfirmedSessionFailureStatus,
  isUnsafeHttpMethod,
  shouldClearLocalAttendanceDraft,
  shouldRejectOfflineMutation,
} from "../lib/offline-policy.ts";

describe("offline request policy", () => {
  it("rejects unsafe server writes offline without queueing them", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(isUnsafeHttpMethod(method), true);
      assert.equal(shouldRejectOfflineMutation(method, false), true);
      assert.equal(shouldRejectOfflineMutation(method, true), false);
    }

    assert.equal(shouldRejectOfflineMutation("GET", false), false);
    assert.match(OFFLINE_MUTATION_MESSAGE, /Nothing was sent or queued/);
  });

  it("treats only confirmed authentication statuses as teardown proof", () => {
    assert.equal(isConfirmedSessionFailureStatus(401), true);
    assert.equal(isConfirmedSessionFailureStatus(403), false);
    assert.equal(isConfirmedSessionFailureStatus(404), false);
    assert.equal(isConfirmedSessionFailureStatus(429), false);
    assert.equal(isConfirmedSessionFailureStatus(0), false);
    assert.equal(isConfirmedSessionFailureStatus(408), false);
    assert.equal(isConfirmedSessionFailureStatus(500), false);
  });

  it("clears attendance drafts only after a server-owned terminal receipt", () => {
    for (const status of ["ACCEPTED", "SYNCED", "CONFLICTED", "accepted"]) {
      assert.equal(shouldClearLocalAttendanceDraft(status), true);
    }

    for (const status of [
      "REJECTED",
      "PROCESSING",
      "DUPLICATE",
      "UNKNOWN",
      "",
    ]) {
      assert.equal(shouldClearLocalAttendanceDraft(status), false);
    }
  });

  it("compares only the tenant and user identity in browser session hints", () => {
    const session = {
      tenant: { id: "tenant-1" },
      user: { id: "user-1", permissions: ["students.read"] },
    };

    assert.deepEqual(getBrowserSessionIdentity(session), {
      tenantId: "tenant-1",
      userId: "user-1",
    });
    assert.equal(
      hasSameBrowserSessionIdentity(session, {
        tenant: { id: "tenant-1" },
        user: { id: "user-1", permissions: ["platform.manage"] },
      }),
      true,
    );
    assert.equal(
      hasSameBrowserSessionIdentity(session, {
        tenant: { id: "tenant-2" },
        user: { id: "user-1" },
      }),
      false,
    );
    assert.equal(
      hasSameBrowserSessionIdentity(session, {
        tenant: { id: "tenant-1" },
        user: { id: "user-2" },
      }),
      false,
    );
    assert.equal(hasSameBrowserSessionIdentity(session, {}), false);
  });

  it("rejects a new attendance draft at capacity without blocking updates", () => {
    const storedKeys = Array.from(
      { length: 20 },
      (_, index) => `attendance-${index + 1}`,
    );

    assert.equal(
      canStorePendingAttendanceDraft(
        storedKeys.slice(0, 19),
        "attendance-new",
        20,
      ),
      true,
    );
    assert.equal(
      canStorePendingAttendanceDraft(storedKeys, "attendance-new", 20),
      false,
    );
    assert.equal(
      canStorePendingAttendanceDraft(storedKeys, "attendance-10", 20),
      true,
    );
  });
});
