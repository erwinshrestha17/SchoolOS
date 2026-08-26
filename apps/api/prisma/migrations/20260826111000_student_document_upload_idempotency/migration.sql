-- Admission finalization and offline-safe clients may retry the same protected
-- document upload. Persist the request identity and content fingerprint so a
-- replay returns the original document rather than creating another record.
ALTER TABLE "StudentDocument"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "contentChecksumSha256" TEXT;

CREATE UNIQUE INDEX "StudentDocument_tenantId_idempotencyKey_key"
  ON "StudentDocument"("tenantId", "idempotencyKey");
