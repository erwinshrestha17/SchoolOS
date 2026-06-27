-- M3 finance integrity: receipt file state, idempotent corrections, and approval history.
CREATE TYPE "ReceiptFileStatus" AS ENUM ('PENDING', 'AVAILABLE', 'UNAVAILABLE');

ALTER TYPE "FinanceRequestStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "FinanceRequestStatus" ADD VALUE IF NOT EXISTS 'EXECUTED';
ALTER TYPE "FinanceRequestStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "FinanceRequestHistoryAction" AS ENUM (
  'REQUESTED',
  'REVIEW_STARTED',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'EXECUTION_FAILED'
);

ALTER TABLE "Payment"
  ADD COLUMN "reversalIdempotencyKey" TEXT;

ALTER TABLE "PaymentRefund"
  ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "Receipt"
  ADD COLUMN "fileAssetId" TEXT,
  ADD COLUMN "fileStatus" "ReceiptFileStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fileGeneratedAt" TIMESTAMP(3);

ALTER TABLE "FinanceApprovalRequest"
  ADD COLUMN "failureMessage" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "ReceiptReprintHistory"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE TABLE "FinanceApprovalRequestHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" "FinanceRequestHistoryAction" NOT NULL,
  "status" "FinanceRequestStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinanceApprovalRequestHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_tenantId_reversalIdempotencyKey_key"
  ON "Payment"("tenantId", "reversalIdempotencyKey");
CREATE UNIQUE INDEX "PaymentRefund_tenantId_idempotencyKey_key"
  ON "PaymentRefund"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "Receipt_tenantId_fileAssetId_key"
  ON "Receipt"("tenantId", "fileAssetId");
CREATE UNIQUE INDEX "ReceiptReprintHistory_tenantId_idempotencyKey_key"
  ON "ReceiptReprintHistory"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "FinanceApprovalRequest_tenantId_idempotencyKey_key"
  ON "FinanceApprovalRequest"("tenantId", "idempotencyKey");
CREATE INDEX "FinanceApprovalRequestHistory_tenantId_requestId_createdAt_idx"
  ON "FinanceApprovalRequestHistory"("tenantId", "requestId", "createdAt");
CREATE INDEX "FinanceApprovalRequestHistory_tenantId_status_createdAt_idx"
  ON "FinanceApprovalRequestHistory"("tenantId", "status", "createdAt");

ALTER TABLE "FinanceApprovalRequestHistory"
  ADD CONSTRAINT "FinanceApprovalRequestHistory_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "FinanceApprovalRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
