import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAccessRevocationReceipt,
  resolveAccessRevocationReceipt,
} from "../lib/attendance-draft-access-revocation.ts";

describe("attendance draft access revocation receipt", () => {
  it("removes student and display data while retaining a purpose-limited receipt", () => {
    const receipt = createAccessRevocationReceipt(
      {
        clientSubmissionId: "submission-1",
        academicYearId: "year-1",
        academicYearLabel: "2083",
        classId: "class-1",
        classLabel: "Grade 3",
        sectionId: "section-1",
        sectionLabel: "A",
        attendanceDate: "2026-08-24",
        exceptions: { "student-1": "ABSENT" },
        remarks: { "student-1": "Private remark" },
        savedAt: "2026-08-24T08:00:00.000Z",
        serverSessionId: "session-1",
        serverSubmittedAt: "2026-08-24T08:01:00.000Z",
        lastSyncStatus: "PROCESSING",
      },
      "AUTHORIZATION_DENIED",
    );

    assert.deepEqual(receipt, {
      clientSubmissionId: "submission-1",
      academicYearId: "year-1",
      classId: "class-1",
      sectionId: "section-1",
      attendanceDate: "2026-08-24",
      exceptions: {},
      remarks: {},
      savedAt: "2026-08-24T08:00:00.000Z",
      serverSessionId: null,
      serverSubmittedAt: null,
      lastSyncStatus: "AUTHORIZATION_DENIED",
    });
    assert.equal("academicYearLabel" in receipt, false);
    assert.equal("classLabel" in receipt, false);
    assert.equal("sectionLabel" in receipt, false);
  });

  it("sanitizes the live transaction record without replacing its intent", () => {
    const liveReceipt = resolveAccessRevocationReceipt(
      {
        clientSubmissionId: "live-submission",
        academicYearId: "live-year",
        academicYearLabel: "Live year label",
        classId: "live-class",
        classLabel: "Live class label",
        sectionId: "live-section",
        sectionLabel: "Live section label",
        attendanceDate: "2026-08-25",
        exceptions: { "live-student": "LATE" },
        remarks: { "live-student": "Sensitive live remark" },
        savedAt: "2026-08-25T08:00:00.000Z",
        serverSessionId: "live-server-session",
        serverSubmittedAt: "2026-08-25T08:01:00.000Z",
        lastSyncStatus: "PROCESSING",
      },
      {
        clientSubmissionId: "stale-submission",
        academicYearId: "stale-year",
        classId: "stale-class",
        sectionId: "stale-section",
        attendanceDate: "2026-08-24",
        exceptions: { "stale-student": "ABSENT" },
        remarks: { "stale-student": "Sensitive stale remark" },
        savedAt: "2026-08-24T08:00:00.000Z",
        serverSessionId: "stale-server-session",
        serverSubmittedAt: null,
      },
      "ACCESS_REVALIDATION_REQUIRED",
    );

    assert.deepEqual(liveReceipt, {
      clientSubmissionId: "live-submission",
      academicYearId: "live-year",
      classId: "live-class",
      sectionId: "live-section",
      attendanceDate: "2026-08-25",
      exceptions: {},
      remarks: {},
      savedAt: "2026-08-25T08:00:00.000Z",
      serverSessionId: null,
      serverSubmittedAt: null,
      lastSyncStatus: "ACCESS_REVALIDATION_REQUIRED",
    });
  });
});
