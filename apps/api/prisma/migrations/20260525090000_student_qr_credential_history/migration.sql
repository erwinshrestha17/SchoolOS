-- M1 Student QR release hardening: preserve credential history across rotation.
ALTER TYPE "StudentQrStatus" ADD VALUE IF NOT EXISTS 'ROTATED';

DROP INDEX IF EXISTS "StudentQrCredential_tenantId_studentId_key";

ALTER TABLE "StudentQrCredential"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rotateReason" TEXT,
  ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;

CREATE INDEX IF NOT EXISTS "StudentQrCredential_tenantId_studentId_status_idx"
  ON "StudentQrCredential"("tenantId", "studentId", "status");
