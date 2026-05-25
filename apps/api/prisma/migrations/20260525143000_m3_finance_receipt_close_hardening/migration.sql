-- M3 Fees & Receipts hardening:
-- - Add receipt reprint metadata for audit/File Registry traceability.
-- - Add deterministic cashier close window key for duplicate close protection.

ALTER TABLE "CashierClose"
ADD COLUMN "closeWindowKey" TEXT;

CREATE UNIQUE INDEX "CashierClose_tenantId_closeWindowKey_key"
ON "CashierClose"("tenantId", "closeWindowKey");

ALTER TABLE "ReceiptReprintHistory"
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "studentId" TEXT,
ADD COLUMN "fileAssetId" TEXT,
ADD COLUMN "format" TEXT NOT NULL DEFAULT 'pdf',
ADD COLUMN "delivery" TEXT NOT NULL DEFAULT 'download';

CREATE INDEX "ReceiptReprintHistory_tenantId_studentId_reprintedAt_idx"
ON "ReceiptReprintHistory"("tenantId", "studentId", "reprintedAt");

CREATE INDEX "ReceiptReprintHistory_tenantId_paymentId_idx"
ON "ReceiptReprintHistory"("tenantId", "paymentId");
