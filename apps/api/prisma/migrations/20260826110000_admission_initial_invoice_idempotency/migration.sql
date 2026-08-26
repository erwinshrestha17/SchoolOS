-- Admission finalization can be retried after the enrollment transaction has
-- committed. Keep the admission-created invoice replay-safe without limiting
-- the recurring invoices that legitimately share an enrollment.
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Invoice_tenantId_idempotencyKey_key"
  ON "Invoice"("tenantId", "idempotencyKey");
