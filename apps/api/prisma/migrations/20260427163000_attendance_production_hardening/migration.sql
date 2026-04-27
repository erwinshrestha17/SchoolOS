DO $$
BEGIN
  CREATE TYPE "AttendanceConflictDecision" AS ENUM (
    'REVIEWED_WITHOUT_CHANGE',
    'REVIEWED_AND_OVERRIDDEN',
    'REJECTED_RESUBMISSION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AttendanceSyncRejectionReason" AS ENUM (
    'LOCKED_SESSION',
    'VALIDATION_ERROR',
    'ROSTER_MISMATCH',
    'REFERENCE_NOT_FOUND',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AttendanceConflict"
  ADD COLUMN IF NOT EXISTS "decision" "AttendanceConflictDecision";

ALTER TABLE "AttendanceSyncSubmission"
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "syncAttemptCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "rejectionReason" "AttendanceSyncRejectionReason";

CREATE INDEX IF NOT EXISTS "AttendanceSyncSubmission_tenantId_academicYearId_classId_sectionId_attendanceDate_idx"
  ON "AttendanceSyncSubmission"("tenantId", "academicYearId", "classId", "sectionId", "attendanceDate");
