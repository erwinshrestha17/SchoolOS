-- Production reporting and lifecycle hardening support.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'StudentLifecycleStatus'
  ) THEN
    CREATE TYPE "StudentLifecycleStatus" AS ENUM (
      'ACTIVE',
      'TRANSFERRED',
      'EXITED',
      'ALUMNI',
      'DELETED'
    );
  END IF;
END $$;

-- Add column first if it doesn't exist (as TEXT, before type conversion)
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Student"
  ALTER COLUMN "lifecycleStatus" DROP DEFAULT;

ALTER TABLE "Student"
  ALTER COLUMN "lifecycleStatus"
  TYPE "StudentLifecycleStatus"
  USING CASE
    WHEN "lifecycleStatus" IN ('ACTIVE', 'TRANSFERRED', 'EXITED', 'ALUMNI', 'DELETED')
      THEN "lifecycleStatus"::"StudentLifecycleStatus"
    ELSE 'ACTIVE'::"StudentLifecycleStatus"
  END;

ALTER TABLE "Student"
  ALTER COLUMN "lifecycleStatus" SET DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "CashierClose" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "closeNumber" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "collectorUserId" TEXT,
  "paymentMethod" "PaymentMethod",
  "grossCollected" DECIMAL(12,2) NOT NULL,
  "totalRefunded" DECIMAL(12,2) NOT NULL,
  "netCollected" DECIMAL(12,2) NOT NULL,
  "paymentCount" INTEGER NOT NULL,
  "refundCount" INTEGER NOT NULL,
  "firstReceiptNumber" TEXT,
  "lastReceiptNumber" TEXT,
  "notes" TEXT,
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashierClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashierClose_tenantId_closeNumber_key"
  ON "CashierClose"("tenantId", "closeNumber");

CREATE INDEX IF NOT EXISTS "CashierClose_tenantId_openedAt_closedAt_idx"
  ON "CashierClose"("tenantId", "openedAt", "closedAt");

CREATE INDEX IF NOT EXISTS "CashierClose_tenantId_collectorUserId_paymentMethod_idx"
  ON "CashierClose"("tenantId", "collectorUserId", "paymentMethod");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashierClose_tenantId_fkey'
  ) THEN
    ALTER TABLE "CashierClose"
      ADD CONSTRAINT "CashierClose_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashierClose_collectorUserId_fkey'
  ) THEN
    ALTER TABLE "CashierClose"
      ADD CONSTRAINT "CashierClose_collectorUserId_fkey"
      FOREIGN KEY ("collectorUserId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashierClose_closedById_fkey'
  ) THEN
    ALTER TABLE "CashierClose"
      ADD CONSTRAINT "CashierClose_closedById_fkey"
      FOREIGN KEY ("closedById")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StudentLifecycleTransition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "fromStatus" "StudentLifecycleStatus" NOT NULL,
  "toStatus" "StudentLifecycleStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "feeClearanceWaived" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,

  CONSTRAINT "StudentLifecycleTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentLifecycleTransition_tenantId_studentId_changedAt_idx"
  ON "StudentLifecycleTransition"("tenantId", "studentId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentLifecycleTransition_tenantId_fkey'
  ) THEN
    ALTER TABLE "StudentLifecycleTransition"
      ADD CONSTRAINT "StudentLifecycleTransition_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentLifecycleTransition_studentId_fkey'
  ) THEN
    ALTER TABLE "StudentLifecycleTransition"
      ADD CONSTRAINT "StudentLifecycleTransition_studentId_fkey"
      FOREIGN KEY ("studentId")
      REFERENCES "Student"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "GeneratedStudentDocument"
  ADD COLUMN IF NOT EXISTS "storageObjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "checksumSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signatureMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedById" TEXT;