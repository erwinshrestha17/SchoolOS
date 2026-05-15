-- Phase 4 M8A/M8C hardening:
-- - Track explicit Library fine posting to M3 invoices.
-- - Add idempotency to Canteen wallet financial transactions.

-- Ensure LibraryFineStatus exists
DO $$ BEGIN
    CREATE TYPE "LibraryFineStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "LibraryFineStatus" ADD VALUE IF NOT EXISTS 'POSTED_TO_FEES';

-- Ensure LibraryFine table exists
CREATE TABLE IF NOT EXISTS "LibraryFine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "waivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "LibraryFineStatus" NOT NULL DEFAULT 'PENDING',
    "waiverReason" TEXT,
    "correctionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryFine_pkey" PRIMARY KEY ("id")
);

-- Apply the additions
ALTER TABLE "LibraryFine"
  ADD COLUMN IF NOT EXISTS "feeInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "feePostedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LibraryFine_tenantId_feeInvoiceId_idx"
  ON "LibraryFine"("tenantId", "feeInvoiceId");

ALTER TABLE "CanteenWalletTransaction"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

DO $$ BEGIN
    CREATE UNIQUE INDEX "CanteenWalletTransaction_idempotencyKey_key"
      ON "CanteenWalletTransaction"("idempotencyKey");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;
