-- P0-05: make authority explicit per guardian-child relationship.
CREATE TYPE "GuardianCapability" AS ENUM (
  'ACADEMICS_VIEW',
  'ATTENDANCE_VIEW',
  'LEAVE_MANAGE',
  'FEES_VIEW',
  'FEES_PAY',
  'EMERGENCY_ALERT_RECEIVE',
  'SCHOOL_COMMUNICATE',
  'SPECIFIC_CONSENT_GIVE',
  'PICKUP_AUTHORIZE',
  'COMPLAINT_OR_CORRECTION_SUBMIT'
);

CREATE TYPE "GuardianRelationshipVerificationStatus" AS ENUM (
  'UNVERIFIED',
  'VERIFIED'
);

CREATE TYPE "GuardianRelationshipStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED'
);

CREATE TYPE "GuardianRelationshipApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "StudentGuardian"
  ADD COLUMN "capabilities" "GuardianCapability"[] NOT NULL DEFAULT ARRAY[]::"GuardianCapability"[],
  ADD COLUMN "verificationStatus" "GuardianRelationshipVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "status" "GuardianRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "effectiveUntil" TIMESTAMP(3),
  ADD COLUMN "emergencyContactPriority" INTEGER,
  ADD COLUMN "approvalStatus" "GuardianRelationshipApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "restrictionReasonRef" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve the access existing linked guardians already held. Pickup remains
-- excluded because digital pickup is outside the initial pilot boundary.
UPDATE "StudentGuardian"
SET
  "capabilities" = ARRAY[
    'ACADEMICS_VIEW'::"GuardianCapability",
    'ATTENDANCE_VIEW'::"GuardianCapability",
    'LEAVE_MANAGE'::"GuardianCapability",
    'FEES_VIEW'::"GuardianCapability",
    'FEES_PAY'::"GuardianCapability",
    'EMERGENCY_ALERT_RECEIVE'::"GuardianCapability",
    'SCHOOL_COMMUNICATE'::"GuardianCapability",
    'SPECIFIC_CONSENT_GIVE'::"GuardianCapability",
    'COMPLAINT_OR_CORRECTION_SUBMIT'::"GuardianCapability"
  ],
  "verificationStatus" = 'VERIFIED',
  "status" = 'ACTIVE',
  "effectiveFrom" = "createdAt",
  "approvalStatus" = 'APPROVED',
  "approvedAt" = "createdAt";

ALTER TABLE "StudentGuardian"
  ADD CONSTRAINT "StudentGuardian_effective_window_check"
  CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  ADD CONSTRAINT "StudentGuardian_emergency_priority_check"
  CHECK (
    "emergencyContactPriority" IS NULL
    OR "emergencyContactPriority" BETWEEN 1 AND 100
  );

CREATE INDEX "StudentGuardian_tenantId_guardianId_status_approvalStatus_idx"
  ON "StudentGuardian"("tenantId", "guardianId", "status", "approvalStatus");

CREATE INDEX "StudentGuardian_tenantId_studentId_status_effectiveUntil_idx"
  ON "StudentGuardian"("tenantId", "studentId", "status", "effectiveUntil");
