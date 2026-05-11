-- M3 Fees & Receipts hardening guardrails.
-- Adds tenant/integrity checks and report/idempotency indexes without changing the modular monolith boundary.

CREATE OR REPLACE FUNCTION "enforce_payment_finance_guard"()
RETURNS trigger AS $$
DECLARE
  invoice_tenant_id text;
  invoice_student_id text;
  invoice_status text;
  payment_student_id text;
BEGIN
  SELECT "tenantId", "studentId", "status"::text
    INTO invoice_tenant_id, invoice_student_id, invoice_status
  FROM "Invoice"
  WHERE "id" = NEW."invoiceId";

  IF invoice_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Payment invoice does not exist';
  END IF;

  IF invoice_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payment invoice is outside this tenant';
  END IF;

  payment_student_id := COALESCE(to_jsonb(NEW) ->> 'studentId', invoice_student_id);

  IF payment_student_id <> invoice_student_id THEN
    RAISE EXCEPTION 'Payment student does not match invoice student';
  END IF;

  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF invoice_status IN ('VOID', 'CANCELLED') THEN
    RAISE EXCEPTION 'Payment cannot be collected against a void/cancelled invoice';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payment_finance_guard" ON "Payment";

CREATE TRIGGER "payment_finance_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "invoiceId", "amount"
ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_payment_finance_guard"();

CREATE OR REPLACE FUNCTION "enforce_payment_refund_guard"()
RETURNS trigger AS $$
DECLARE
  payment_tenant_id text;
  payment_amount numeric;
  refunded_amount numeric;
BEGIN
  SELECT "tenantId", "amount"
    INTO payment_tenant_id, payment_amount
  FROM "Payment"
  WHERE "id" = NEW."paymentId";

  IF payment_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Refund payment does not exist';
  END IF;

  IF payment_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Refund payment is outside this tenant';
  END IF;

  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO refunded_amount
  FROM "PaymentRefund"
  WHERE "tenantId" = NEW."tenantId"
    AND "paymentId" = NEW."paymentId"
    AND "id" <> COALESCE(NEW."id", '');

  IF refunded_amount + NEW."amount" > payment_amount THEN
    RAISE EXCEPTION 'Refund amount exceeds payment amount';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payment_refund_guard" ON "PaymentRefund";

CREATE TRIGGER "payment_refund_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "paymentId", "amount"
ON "PaymentRefund"
FOR EACH ROW
EXECUTE FUNCTION "enforce_payment_refund_guard"();

CREATE OR REPLACE FUNCTION "enforce_receipt_reprint_history_guard"()
RETURNS trigger AS $$
DECLARE
  receipt_tenant_id text;
BEGIN
  SELECT "tenantId"
    INTO receipt_tenant_id
  FROM "Receipt"
  WHERE "id" = NEW."receiptId";

  IF receipt_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Receipt reprint receipt does not exist';
  END IF;

  IF receipt_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Receipt reprint is outside this tenant';
  END IF;

  IF COALESCE(TRIM(NEW."reason"), '') = '' THEN
    RAISE EXCEPTION 'Receipt reprint reason is required';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "receipt_reprint_history_guard" ON "ReceiptReprintHistory";

CREATE TRIGGER "receipt_reprint_history_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "receiptId", "reason"
ON "ReceiptReprintHistory"
FOR EACH ROW
EXECUTE FUNCTION "enforce_receipt_reprint_history_guard"();

-- Idempotency/report indexes. Partial unique indexes are used so legacy rows without keys remain valid.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenant_idempotency_key_uidx"
ON "Payment" ("tenantId", "idempotencyKey")
WHERE "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenant_reference_method_uidx"
ON "Payment" ("tenantId", "invoiceId", "method", "referenceNumber")
WHERE "referenceNumber" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Invoice_tenant_status_due_idx"
ON "Invoice" ("tenantId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "Invoice_tenant_student_status_idx"
ON "Invoice" ("tenantId", "studentId", "status");

CREATE INDEX IF NOT EXISTS "InvoiceLine_tenant_feehead_idx"
ON "InvoiceLine" ("tenantId", "feeHeadId");

CREATE INDEX IF NOT EXISTS "Payment_tenant_invoice_paid_idx"
ON "Payment" ("tenantId", "invoiceId", "paidAt");

CREATE INDEX IF NOT EXISTS "Payment_tenant_collector_paid_idx"
ON "Payment" ("tenantId", "collectedById", "paidAt");

CREATE INDEX IF NOT EXISTS "PaymentRefund_tenant_payment_idx"
ON "PaymentRefund" ("tenantId", "paymentId");

CREATE INDEX IF NOT EXISTS "Receipt_tenant_payment_idx"
ON "Receipt" ("tenantId", "paymentId");

CREATE INDEX IF NOT EXISTS "ReceiptReprintHistory_tenant_receipt_idx"
ON "ReceiptReprintHistory" ("tenantId", "receiptId", "reprintedAt");

CREATE INDEX IF NOT EXISTS "CashierClose_tenant_window_idx"
ON "CashierClose" ("tenantId", "openedAt", "closedAt");
