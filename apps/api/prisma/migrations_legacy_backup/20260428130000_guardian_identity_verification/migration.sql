CREATE TYPE "GuardianIdentityVerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'REVOKED'
);

CREATE TABLE "GuardianIdentityVerification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "status" "GuardianIdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT,
  "evidenceDocumentId" TEXT,
  "notes" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GuardianIdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuardianIdentityVerification_tenantId_guardianId_status_idx"
  ON "GuardianIdentityVerification"("tenantId", "guardianId", "status");

CREATE INDEX "GuardianIdentityVerification_tenantId_status_createdAt_idx"
  ON "GuardianIdentityVerification"("tenantId", "status", "createdAt");

ALTER TABLE "GuardianIdentityVerification"
  ADD CONSTRAINT "GuardianIdentityVerification_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "GuardianIdentityVerification"
  ADD CONSTRAINT "GuardianIdentityVerification_guardianId_fkey"
  FOREIGN KEY ("guardianId")
  REFERENCES "Guardian"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
