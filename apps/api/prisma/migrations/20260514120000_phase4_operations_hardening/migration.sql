-- Phase 4 M8A/M8C hardening:
-- - Track explicit Library fine posting to M3 invoices.
-- - Add idempotency to Canteen wallet financial transactions.

ALTER TYPE "LibraryFineStatus" ADD VALUE IF NOT EXISTS 'POSTED_TO_FEES';

ALTER TABLE "LibraryFine"
  ADD COLUMN "feeInvoiceId" TEXT,
  ADD COLUMN "feePostedAt" TIMESTAMP(3);

CREATE INDEX "LibraryFine_tenantId_feeInvoiceId_idx"
  ON "LibraryFine"("tenantId", "feeInvoiceId");

ALTER TABLE "CanteenWalletTransaction"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "CanteenWalletTransaction_idempotencyKey_key"
  ON "CanteenWalletTransaction"("idempotencyKey");
