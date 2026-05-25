ALTER TABLE "AttendanceCorrectionRequest"
ADD COLUMN "previousStatus" "AttendanceStatus",
ADD COLUMN "reviewReason" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "AttendanceCorrectionRequest_tenantId_attendanceDate_status_idx"
ON "AttendanceCorrectionRequest"("tenantId", "attendanceDate", "status");

CREATE INDEX "AttendanceCorrectionRequest_tenantId_attendanceSessionId_status_idx"
ON "AttendanceCorrectionRequest"("tenantId", "attendanceSessionId", "status");

CREATE INDEX "AttendanceCorrectionRequest_tenantId_requestedById_requestedAt_idx"
ON "AttendanceCorrectionRequest"("tenantId", "requestedById", "requestedAt");
