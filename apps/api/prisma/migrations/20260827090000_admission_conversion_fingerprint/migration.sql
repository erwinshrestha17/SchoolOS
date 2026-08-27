-- An accepted application has one authoritative conversion payload. Persist a
-- non-secret fingerprint so retries can resume only the same student,
-- placement, guardian, and document request after the core transaction commits.
ALTER TABLE "AdmissionApplication"
  ADD COLUMN "conversionFingerprint" TEXT;

CREATE INDEX "AdmissionApplication_tenantId_conversionFingerprint_idx"
  ON "AdmissionApplication"("tenantId", "conversionFingerprint");
