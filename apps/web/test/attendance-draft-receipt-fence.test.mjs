import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  decideAttendanceDraftReceiptDelete,
  decideAttendanceDraftReceiptWrite,
  isAttendanceDraftReceiptProtected,
} from "../lib/attendance-draft-receipt-fence.ts";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function draft(clientSubmissionId, lastSyncStatus) {
  return { clientSubmissionId, lastSyncStatus };
}

function commitWrite(transactionState, incoming) {
  const decision = decideAttendanceDraftReceiptWrite(
    transactionState.value,
    incoming,
  );
  if (decision.allowed) {
    transactionState.value = structuredClone(incoming);
  }
  return decision;
}

describe("attendance draft receipt transaction fence", () => {
  it("fails closed for canonical and future unresolved receipt states", () => {
    for (const status of [
      "QUEUED",
      "PROCESSING",
      "TRANSPORT_AMBIGUOUS",
      "SERVER_CHECK_REQUIRED",
      "AUTHORIZATION_DENIED",
      "ACCESS_REVALIDATION_REQUIRED",
      "FUTURE_UNRECOGNIZED_RECEIPT",
    ]) {
      assert.equal(
        isAttendanceDraftReceiptProtected(draft("submission-1", status)),
        true,
        status,
      );
    }

    for (const status of [
      undefined,
      "",
      "DRAFT",
      "SAVED_LOCAL",
      "REJECTED",
      "ACCEPTED",
      "SYNCED",
      "CONFLICTED",
    ]) {
      assert.equal(
        isAttendanceDraftReceiptProtected(draft("submission-1", status)),
        false,
        String(status),
      );
    }
  });

  it("compares a stale tab against the live transaction record", () => {
    const transactionState = {
      value: draft("submission-1", undefined),
    };
    const staleEditableSnapshot = structuredClone(transactionState.value);

    assert.deepEqual(
      commitWrite(transactionState, draft("submission-1", "PROCESSING")),
      { allowed: true },
    );
    assert.deepEqual(commitWrite(transactionState, staleEditableSnapshot), {
      allowed: false,
      reason: "protected_status_downgrade",
    });
    assert.equal(transactionState.value.lastSyncStatus, "PROCESSING");

    assert.deepEqual(
      commitWrite(
        transactionState,
        draft("different-submission", "TRANSPORT_AMBIGUOUS"),
      ),
      { allowed: false, reason: "different_submission" },
    );
    assert.deepEqual(transactionState.value, {
      clientSubmissionId: "submission-1",
      lastSyncStatus: "PROCESSING",
    });
  });

  it("allows same-intent receipt progress but keeps denial tombstones sticky", () => {
    const transactionState = {
      value: draft("submission-1", "PROCESSING"),
    };

    assert.deepEqual(
      commitWrite(
        transactionState,
        draft("submission-1", "TRANSPORT_AMBIGUOUS"),
      ),
      { allowed: true },
    );
    assert.deepEqual(
      commitWrite(
        transactionState,
        draft("submission-1", "AUTHORIZATION_DENIED"),
      ),
      { allowed: true },
    );
    assert.deepEqual(
      commitWrite(transactionState, draft("submission-1", "PROCESSING")),
      { allowed: false, reason: "terminal_receipt_tombstone" },
    );
    assert.equal(transactionState.value.lastSyncStatus, "AUTHORIZATION_DENIED");

    assert.deepEqual(
      commitWrite(transactionState, {
        ...draft("submission-1", "AUTHORIZATION_DENIED"),
        exceptions: {},
        remarks: {},
      }),
      { allowed: true },
    );
    assert.deepEqual(
      commitWrite(transactionState, {
        ...draft("submission-1", "AUTHORIZATION_DENIED"),
        exceptions: { "student-1": "ABSENT" },
        remarks: {},
      }),
      { allowed: false, reason: "terminal_receipt_tombstone" },
    );
  });

  it("blocks record-level deletion of protected receipts", () => {
    assert.deepEqual(
      decideAttendanceDraftReceiptDelete(draft("submission-1", "PROCESSING")),
      { allowed: false, reason: "authoritative_receipt_required" },
    );
    assert.deepEqual(
      decideAttendanceDraftReceiptDelete(
        draft("submission-1", "ACCESS_REVALIDATION_REQUIRED"),
      ),
      { allowed: false, reason: "authoritative_receipt_required" },
    );
    assert.deepEqual(
      decideAttendanceDraftReceiptDelete(draft("submission-1", "REJECTED")),
      { allowed: true },
    );
    assert.deepEqual(decideAttendanceDraftReceiptDelete(undefined), {
      allowed: true,
    });
  });

  it("clears a protected receipt only with matching authoritative proof", () => {
    const protectedDraft = draft("submission-1", "PROCESSING");

    for (const syncStatus of ["ACCEPTED", "SYNCED", "CONFLICTED"]) {
      assert.deepEqual(
        decideAttendanceDraftReceiptDelete(protectedDraft, {
          clientSubmissionId: "submission-1",
          syncStatus,
        }),
        { allowed: true },
      );
    }

    assert.deepEqual(
      decideAttendanceDraftReceiptDelete(protectedDraft, {
        clientSubmissionId: "different-submission",
        syncStatus: "ACCEPTED",
      }),
      { allowed: false, reason: "different_submission" },
    );
    assert.deepEqual(
      decideAttendanceDraftReceiptDelete(protectedDraft, {
        clientSubmissionId: "submission-1",
        syncStatus: "PROCESSING",
      }),
      { allowed: false, reason: "non_authoritative_status" },
    );
  });

  it("enforces compare-and-write and compare-and-delete inside readwrite transactions", () => {
    const source = readFileSync(join(webRoot, "lib/session.ts"), "utf8");
    const writeStart = source.indexOf(
      "async function writeIndexedDbDraftWithinCapacity",
    );
    const deleteStart = source.indexOf("async function deleteIndexedDbDraft");
    const clearStart = source.indexOf("function clearIndexedDbDrafts");
    const writeSource = source.slice(writeStart, deleteStart);
    const deleteSource = source.slice(deleteStart, clearStart);

    assert.ok(writeStart >= 0 && deleteStart > writeStart);
    assert.match(writeSource, /db\.transaction\([\s\S]*"readwrite"/);
    assert.match(writeSource, /const request = store\.getAll\(\)/);
    assert.match(writeSource, /decideAttendanceDraftReceiptWrite\(/);
    assert.ok(
      writeSource.indexOf("decideAttendanceDraftReceiptWrite(") <
        writeSource.indexOf("store.put("),
    );

    assert.ok(clearStart > deleteStart);
    assert.match(deleteSource, /db\.transaction\([\s\S]*"readwrite"/);
    assert.match(deleteSource, /const request = store\.get\(key\)/);
    assert.match(deleteSource, /decideAttendanceDraftReceiptDelete\(/);
    assert.ok(
      deleteSource.indexOf("decideAttendanceDraftReceiptDelete(") <
        deleteSource.indexOf("store.delete(key)"),
    );
    assert.match(source, /removeLegacyAttendanceDraftIfUnchanged/);
    assert.match(
      source,
      /window\.localStorage\.getItem\(key\) === expectedValue/,
    );
  });

  it("passes authoritative receipt proof only from the accepted sync branch", () => {
    const source = readFileSync(
      join(webRoot, "components/forms/attendance-form.tsx"),
      "utf8",
    );
    const clearableStart = source.indexOf(
      "if (shouldClearLocalAttendanceDraft(syncStatus))",
    );
    const retainedStart = source.indexOf(
      "const retainedDraft =",
      clearableStart,
    );
    const clearableSource = source.slice(clearableStart, retainedStart);

    assert.ok(clearableStart >= 0 && retainedStart > clearableStart);
    assert.match(
      clearableSource,
      /clearAttendanceDraft\(submissionDraftKey, \{[\s\S]*authoritativeReceipt: \{[\s\S]*clientSubmissionId: draftClientSubmissionId,[\s\S]*syncStatus/,
    );
  });

  it("sanitizes access revocation against the live record in one transaction", () => {
    const session = readFileSync(join(webRoot, "lib/session.ts"), "utf8");
    const form = readFileSync(
      join(webRoot, "components/forms/attendance-form.tsx"),
      "utf8",
    );
    const sanitizerStart = session.indexOf(
      "async function writeIndexedDbAccessRevocationReceipt",
    );
    const writeStart = session.indexOf(
      "async function writeIndexedDbDraftWithinCapacity",
      sanitizerStart,
    );
    const sanitizerSource = session.slice(sanitizerStart, writeStart);

    assert.ok(sanitizerStart >= 0 && writeStart > sanitizerStart);
    assert.match(sanitizerSource, /db\.transaction\([\s\S]*"readwrite"/);
    assert.match(sanitizerSource, /const request = store\.get\(key\)/);
    assert.match(sanitizerSource, /resolveAccessRevocationReceipt\(/);
    assert.match(sanitizerSource, /store\.put\(\{ \.\.\.tombstone, key \}\)/);
    assert.ok(
      (form.match(/sanitizeAttendanceDraftForAccessRevocation\(/g) ?? [])
        .length >= 3,
    );
    assert.match(
      form,
      /setDraftClientSubmissionId\(\s*storedAccessDeniedDraft\.clientSubmissionId/,
    );
    assert.match(
      form,
      /setDraftClientSubmissionId\(storedDeniedDraft\.clientSubmissionId\)/,
    );
  });
});
