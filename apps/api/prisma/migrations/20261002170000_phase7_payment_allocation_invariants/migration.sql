-- Phase 7.5 — Payment allocation invariants.
--
-- Money allocation was enforced only by service code that read invoice
-- balances outside its transaction, so two cashiers collecting against the
-- same invoice could over-allocate it. These guards make the database the
-- last line of defence, for every writer (counter collection, online
-- settlement, refunds, reversals, advance reallocation):
--
--   1. Sign/type CHECK: amounts are never zero; INVOICE/ADVANCE/UNALLOCATED
--      are positive, REFUND/REVERSAL are negative, REALLOCATION is either.
--   2. Per payment: Σ active (non-reversed) allocations is within
--      [0, Payment.amount].
--   3. Per invoice: Σ active allocations never exceeds Invoice.totalAmount
--      when a positive allocation is added, and an invoice total can never
--      be lowered below what has already been allocated to it.
--   4. One "all fee plans" billing run per tenant, academic year and month:
--      the existing unique key includes the nullable feePlanId, and NULLs are
--      distinct in PostgreSQL, so the same month could be billed twice.
--
-- Locks are always taken Payment -> Invoice so concurrent writers serialize
-- instead of deadlocking. Preflights FAIL (never edit or fabricate rows).

DO $$
DECLARE
  v_count integer;
  v_ids text;
BEGIN
  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "PaymentAllocation"
    WHERE "amount" = 0
       OR ("allocationType" IN ('INVOICE', 'ADVANCE', 'UNALLOCATED') AND "amount" < 0)
       OR ("allocationType" IN ('REFUND', 'REVERSAL') AND "amount" > 0)
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.5 preflight: % PaymentAllocation row(s) violate the amount sign rules (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("paymentId", ', ' ORDER BY "paymentId")
    INTO v_count, v_ids
  FROM (
    SELECT a."paymentId"
    FROM "PaymentAllocation" a
    JOIN "Payment" p ON p."id" = a."paymentId"
    WHERE a."reversedAt" IS NULL
    GROUP BY a."paymentId", p."amount"
    HAVING SUM(a."amount") > p."amount" OR SUM(a."amount") < 0
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.5 preflight: % Payment(s) have active allocations outside [0, payment amount] (first payment ids: %). Correct them through a reviewed finance adjustment before migrating.', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("invoiceId", ', ' ORDER BY "invoiceId")
    INTO v_count, v_ids
  FROM (
    SELECT a."invoiceId"
    FROM "PaymentAllocation" a
    JOIN "Invoice" i ON i."id" = a."invoiceId"
    WHERE a."reversedAt" IS NULL AND a."invoiceId" IS NOT NULL
    GROUP BY a."invoiceId", i."totalAmount"
    HAVING SUM(a."amount") > i."totalAmount"
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.5 preflight: % Invoice(s) have more allocated than their total (first invoice ids: %). Correct them through a reviewed finance adjustment before migrating.', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT a."id"
    FROM "PaymentAllocation" a
    JOIN "Payment" p ON p."id" = a."paymentId"
    LEFT JOIN "Invoice" i ON i."id" = a."invoiceId"
    WHERE a."tenantId" <> p."tenantId"
       OR (a."invoiceId" IS NOT NULL AND (i."id" IS NULL OR i."tenantId" <> a."tenantId"))
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.5 preflight: % PaymentAllocation row(s) cross tenants (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("runKey", '; ' ORDER BY "runKey")
    INTO v_count, v_ids
  FROM (
    SELECT "tenantId" || '/' || "academicYearId" || '/' || "runYear" || '-' || "runMonth" AS "runKey"
    FROM "FeeBillingRun"
    WHERE "feePlanId" IS NULL
    GROUP BY "tenantId", "academicYearId", "runYear", "runMonth"
    HAVING count(*) > 1
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.5 preflight: % month(s) were billed by more than one all-plans billing run (first keys tenant/year/month: %). Void or merge the duplicate runs through a reviewed finance adjustment before migrating.', v_count, v_ids;
  END IF;
END $$;

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_amount_sign" CHECK (
    "amount" <> 0
    AND ("allocationType" NOT IN ('INVOICE', 'ADVANCE', 'UNALLOCATED') OR "amount" > 0)
    AND ("allocationType" NOT IN ('REFUND', 'REVERSAL') OR "amount" < 0)
  );

CREATE OR REPLACE FUNCTION schoolos_guard_payment_allocation()
RETURNS trigger AS $$
DECLARE
  v_pay_amount numeric;
  v_pay_tenant text;
  v_inv_total numeric;
  v_inv_tenant text;
  v_sum numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
       OR NEW."paymentId" IS DISTINCT FROM OLD."paymentId"
       OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."allocationType" IS DISTINCT FROM OLD."allocationType" THEN
      RAISE EXCEPTION 'schoolos_allocation_guard: PaymentAllocation % is immutable; correct money through a REFUND, REVERSAL or REALLOCATION row.', OLD."id"
        USING ERRCODE = '23000';
    END IF;
  END IF;

  -- Lock order: Payment first, then Invoice.
  SELECT "amount", "tenantId" INTO v_pay_amount, v_pay_tenant
  FROM "Payment" WHERE "id" = NEW."paymentId" FOR UPDATE;
  IF NOT FOUND OR v_pay_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'schoolos_allocation_guard: allocation payment % is missing or belongs to another tenant.', NEW."paymentId"
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO v_sum
  FROM "PaymentAllocation"
  WHERE "paymentId" = NEW."paymentId"
    AND "reversedAt" IS NULL
    AND (TG_OP = 'INSERT' OR "id" <> NEW."id");
  IF NEW."reversedAt" IS NULL THEN
    v_sum := v_sum + NEW."amount";
  END IF;
  IF v_sum > v_pay_amount OR v_sum < 0 THEN
    RAISE EXCEPTION 'schoolos_allocation_guard: allocations for payment % would be % against a payment of %.', NEW."paymentId", v_sum, v_pay_amount
      USING ERRCODE = '23514';
  END IF;

  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "totalAmount", "tenantId" INTO v_inv_total, v_inv_tenant
    FROM "Invoice" WHERE "id" = NEW."invoiceId" FOR UPDATE;
    IF NOT FOUND OR v_inv_tenant <> NEW."tenantId" THEN
      RAISE EXCEPTION 'schoolos_allocation_guard: allocation invoice % is missing or belongs to another tenant.', NEW."invoiceId"
        USING ERRCODE = '23514';
    END IF;

    IF NEW."reversedAt" IS NULL AND NEW."amount" > 0 THEN
      SELECT COALESCE(SUM("amount"), 0) INTO v_sum
      FROM "PaymentAllocation"
      WHERE "invoiceId" = NEW."invoiceId"
        AND "reversedAt" IS NULL
        AND (TG_OP = 'INSERT' OR "id" <> NEW."id");
      v_sum := v_sum + NEW."amount";
      IF v_sum > v_inv_total THEN
        RAISE EXCEPTION 'schoolos_allocation_guard: allocations for invoice % would be % against an invoice total of %.', NEW."invoiceId", v_sum, v_inv_total
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentAllocation_guard"
  BEFORE INSERT OR UPDATE ON "PaymentAllocation"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_payment_allocation();

-- An invoice total may never be lowered below what is already allocated.
-- The UPDATE holds the invoice row lock, so a concurrent allocation insert
-- waits for it and re-reads the new total (READ COMMITTED), and vice versa.
CREATE OR REPLACE FUNCTION schoolos_guard_invoice_total()
RETURNS trigger AS $$
DECLARE
  v_sum numeric;
BEGIN
  IF NEW."totalAmount" < OLD."totalAmount" THEN
    SELECT COALESCE(SUM("amount"), 0) INTO v_sum
    FROM "PaymentAllocation"
    WHERE "invoiceId" = NEW."id" AND "reversedAt" IS NULL;
    IF v_sum > NEW."totalAmount" THEN
      RAISE EXCEPTION 'schoolos_allocation_guard: invoice % total % would drop below its allocated amount %.', NEW."id", NEW."totalAmount", v_sum
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_total_guard"
  BEFORE UPDATE OF "totalAmount" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_invoice_total();

CREATE UNIQUE INDEX "FeeBillingRun_all_plans_month_key"
  ON "FeeBillingRun"("tenantId", "academicYearId", "runYear", "runMonth")
  WHERE "feePlanId" IS NULL;
