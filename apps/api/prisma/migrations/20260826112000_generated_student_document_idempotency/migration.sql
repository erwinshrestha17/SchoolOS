-- Admission finalization may be resumed. Link generated student documents to
-- their protected file record and make a caller-supplied operation key unique
-- per tenant so an ID card is never revoked and reissued by a retry.
ALTER TABLE "GeneratedStudentDocument"
  ADD COLUMN "fileId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "GeneratedStudentDocument_fileId_key"
  ON "GeneratedStudentDocument"("fileId");
CREATE UNIQUE INDEX "GeneratedStudentDocument_tenantId_idempotencyKey_key"
  ON "GeneratedStudentDocument"("tenantId", "idempotencyKey");

ALTER TABLE "GeneratedStudentDocument"
  ADD CONSTRAINT "GeneratedStudentDocument_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
