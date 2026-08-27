ALTER TABLE "Student"
ADD COLUMN "admissionOperationId" TEXT,
ADD COLUMN "admissionRequestFingerprint" TEXT;

CREATE UNIQUE INDEX "Student_tenantId_admissionOperationId_key"
ON "Student"("tenantId", "admissionOperationId");

CREATE INDEX "Student_tenantId_admissionRequestFingerprint_idx"
ON "Student"("tenantId", "admissionRequestFingerprint");
