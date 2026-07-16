ALTER TABLE "AttendanceSyncSubmission"
ADD COLUMN "processingLeaseAt" TIMESTAMP(3);

ALTER TABLE "AttendanceSession"
ADD COLUMN "sourceClientSubmissionId" TEXT;

CREATE UNIQUE INDEX "attendance_session_source_submission_key"
ON "AttendanceSession"("tenantId", "sourceClientSubmissionId");

UPDATE "AttendanceSyncSubmission"
SET "processingLeaseAt" = "serverReceivedAt"
WHERE "syncStatus" = 'PROCESSING';
