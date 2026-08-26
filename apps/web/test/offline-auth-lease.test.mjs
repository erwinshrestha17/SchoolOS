import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createOfflineAuthLease,
  isOfflineAuthLeaseValid,
} from "../lib/offline-auth-lease.ts";
import { isAttendanceScopeRevokedRejection } from "../lib/attendance-draft-access-revocation.ts";
import {
  isOfflineOutboxRecordOwnedBy,
  offlineOutboxRecordKey,
  outboxStatusFromSyncReceipt,
} from "../lib/offline-sync-outbox.ts";
import { authorityFenceFields } from "../lib/school-authority-discovery.ts";

describe("offline auth lease", () => {
  it("keeps a school session available only while the lease is unexpired", () => {
    const now = new Date("2026-08-25T03:00:00.000Z");
    const lease = createOfflineAuthLease({
      tenantId: "tenant-1",
      userId: "user-1",
      permissions: ["attendance:mark"],
      roles: ["teacher"],
      now,
      ttlMs: 60_000,
    });

    assert.equal(
      isOfflineAuthLeaseValid(
        lease,
        {
          tenantId: "tenant-1",
          userId: "user-1",
          securityDomain: "SCHOOL",
          permissions: ["attendance:mark"],
          roles: ["teacher"],
        },
        now,
      ),
      true,
    );
    assert.equal(
      isOfflineAuthLeaseValid(
        lease,
        {
          tenantId: "tenant-1",
          userId: "user-1",
          securityDomain: "SCHOOL",
          permissions: ["attendance:mark"],
          roles: ["teacher"],
        },
        new Date("2026-08-25T03:02:00.000Z"),
      ),
      false,
    );
    assert.equal(
      isOfflineAuthLeaseValid(
        lease,
        {
          tenantId: "tenant-1",
          userId: "user-1",
          securityDomain: "PLATFORM",
          permissions: ["attendance:mark"],
          roles: ["teacher"],
        },
        now,
      ),
      false,
    );
    assert.equal(
      isOfflineAuthLeaseValid(
        lease,
        {
          tenantId: "tenant-1",
          userId: "user-1",
          securityDomain: "SCHOOL",
          permissions: [],
          roles: ["teacher"],
        },
        now,
      ),
      false,
    );
  });
});

describe("attendance scope-revoked receipts", () => {
  it("maps SCOPE_REVOKED and UNASSIGNED_TEACHER to the revocation path", () => {
    assert.equal(isAttendanceScopeRevokedRejection("SCOPE_REVOKED"), true);
    assert.equal(isAttendanceScopeRevokedRejection("UNASSIGNED_TEACHER"), true);
    assert.equal(isAttendanceScopeRevokedRejection("LOCKED_SESSION"), false);
    assert.equal(outboxStatusFromSyncReceipt("AUTHORIZATION_DENIED"), "revoked");
  });

  it("scopes outbox records to the exact tenant and user", () => {
    const record = {
      tenantId: "tenant-1",
      userId: "teacher-1",
      module: "attendance",
      operationId: "operation-1",
    };
    assert.equal(
      offlineOutboxRecordKey(record),
      "tenant-1:teacher-1:attendance:operation-1",
    );
    assert.equal(
      isOfflineOutboxRecordOwnedBy(record, {
        tenantId: "tenant-1",
        userId: "teacher-1",
      }),
      true,
    );
    assert.equal(
      isOfflineOutboxRecordOwnedBy(record, {
        tenantId: "tenant-1",
        userId: "teacher-2",
      }),
      false,
    );
  });
});

describe("school authority fence", () => {
  it("omits fence fields when discovery has not run", () => {
    assert.deepEqual(authorityFenceFields(null), {});
    assert.deepEqual(
      authorityFenceFields({
        authorityNodeId: "cloud",
        authorityEpoch: 1,
      }),
      { authorityNodeId: "cloud", authorityEpoch: 1 },
    );
  });
});
