-- Add additive payment refund support with immutable refund records.
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'PAYMENT_REFUND';

CREATE TABLE IF NOT EXISTS "PaymentRefund" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "refundDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "narration" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRefund_tenantId_refundNumber_key"
  ON "PaymentRefund"("tenantId", "refundNumber");

CREATE INDEX IF NOT EXISTS "PaymentRefund_tenantId_refundDate_idx"
  ON "PaymentRefund"("tenantId", "refundDate");

CREATE INDEX IF NOT EXISTS "PaymentRefund_paymentId_idx"
  ON "PaymentRefund"("paymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentRefund_tenantId_fkey'
  ) THEN
    ALTER TABLE "PaymentRefund"
      ADD CONSTRAINT "PaymentRefund_tenantId_fkey"
      FOREIGN KEY ("tenantId")
      REFERENCES "Tenant"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentRefund_paymentId_fkey'
  ) THEN
    ALTER TABLE "PaymentRefund"
      ADD CONSTRAINT "PaymentRefund_paymentId_fkey"
      FOREIGN KEY ("paymentId")
      REFERENCES "Payment"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentRefund_createdById_fkey'
  ) THEN
    ALTER TABLE "PaymentRefund"
      ADD CONSTRAINT "PaymentRefund_createdById_fkey"
      FOREIGN KEY ("createdById")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
