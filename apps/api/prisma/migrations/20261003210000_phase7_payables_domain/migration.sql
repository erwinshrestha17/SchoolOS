-- Phase 7.11c: payables domain on the existing P0 tables.
-- No application code ever wrote these tables, so new NOT NULL columns are
-- safe; the preflight refuses to run if that assumption is wrong.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FinanceExpense") OR EXISTS (SELECT 1 FROM "FinancePayableSettlement") THEN
    RAISE EXCEPTION 'Phase 7.11c preflight: FinanceExpense or FinancePayableSettlement already has rows; add expenseAccountId/paymentAccountId under a reviewed backfill first';
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "AccountingReportMappingType" ADD VALUE 'ACCOUNTS_PAYABLE';

-- AlterTable
ALTER TABLE "FinanceExpense" ADD COLUMN     "approvedSourceFingerprint" TEXT,
ADD COLUMN     "expenseAccountId" TEXT NOT NULL,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "vendorBillNumber" TEXT;

-- AlterTable
ALTER TABLE "FinancePayable" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AlterTable
ALTER TABLE "FinancePayableSettlement" ADD COLUMN     "cashAmount" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "paymentAccountId" TEXT NOT NULL,
ADD COLUMN     "withheldTaxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayableSettlement" ADD CONSTRAINT "FinancePayableSettlement_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayableSettlement" ADD CONSTRAINT "FinancePayableSettlement_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant consistency for the new single-column references (the dynamic
-- triggers from 20260927101000 only covered references that existed then).
CREATE TRIGGER "tenant_ref_expenseAccountId" BEFORE INSERT OR UPDATE OF "expenseAccountId", "tenantId" ON "FinanceExpense"
  FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference('expenseAccountId', 'ChartAccount');
CREATE TRIGGER "tenant_ref_fiscalYearId" BEFORE INSERT OR UPDATE OF "fiscalYearId", "tenantId" ON "FinanceExpense"
  FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference('fiscalYearId', 'FiscalYear');
CREATE TRIGGER "tenant_ref_fiscalPeriodId" BEFORE INSERT OR UPDATE OF "fiscalPeriodId", "tenantId" ON "FinanceExpense"
  FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference('fiscalPeriodId', 'FiscalPeriod');
CREATE TRIGGER "tenant_ref_paymentAccountId" BEFORE INSERT OR UPDATE OF "paymentAccountId", "tenantId" ON "FinancePayableSettlement"
  FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference('paymentAccountId', 'ChartAccount');
CREATE TRIGGER "tenant_ref_journalEntryId" BEFORE INSERT OR UPDATE OF "journalEntryId", "tenantId" ON "FinancePayableSettlement"
  FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference('journalEntryId', 'JournalEntry');

-- Vendors
ALTER TABLE "FinanceVendor"
  ADD CONSTRAINT "FinanceVendor_pan_format" CHECK ("panNumber" IS NULL OR "panNumber" ~ '^[0-9]{9}$'),
  ADD CONSTRAINT "FinanceVendor_names_present" CHECK (length(btrim("legalName")) > 0 AND length(btrim("displayName")) > 0);
CREATE UNIQUE INDEX "FinanceVendor_active_duplicate_key" ON "FinanceVendor" ("tenantId", "duplicateKey")
  WHERE "status" = 'ACTIVE' AND "duplicateKey" IS NOT NULL;

-- Expenses
ALTER TABLE "FinanceExpense"
  ADD CONSTRAINT "FinanceExpense_amounts" CHECK (
    "amount" > 0 AND "taxAmount" >= 0 AND "totalAmount" = "amount" + "taxAmount"
  ),
  ADD CONSTRAINT "FinanceExpense_posted_evidence" CHECK (
    "status" NOT IN ('POSTED', 'REVERSED')
    OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL AND "postedAt" IS NOT NULL AND "submittedById" IS NOT NULL)
  ),
  ADD CONSTRAINT "FinanceExpense_independent_approver" CHECK (
    "approvedById" IS NULL
    OR ("approvedById" IS DISTINCT FROM "createdById" AND "approvedById" IS DISTINCT FROM "submittedById")
  ),
  ADD CONSTRAINT "FinanceExpense_rejection_reason" CHECK (
    "rejectedAt" IS NULL OR length(btrim(coalesce("rejectionReason", ''))) > 0
  ),
  ADD CONSTRAINT "FinanceExpense_reversal_evidence" CHECK (
    "status" <> 'REVERSED' OR ("reversedAt" IS NOT NULL AND "reversedById" IS NOT NULL AND length(btrim(coalesce("correctionReason", ''))) > 0)
  );
CREATE UNIQUE INDEX "FinanceExpense_vendor_bill_key" ON "FinanceExpense" ("tenantId", "vendorId", lower(btrim("vendorBillNumber")))
  WHERE "vendorBillNumber" IS NOT NULL AND "vendorId" IS NOT NULL AND "status" <> 'REVERSED';

CREATE FUNCTION schoolos_guard_finance_expense() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'FinanceExpense_guard: Only draft expenses can be deleted' USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'FinanceExpense_guard: Expenses start as drafts' USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT (
    NEW."status" = OLD."status" AND OLD."status" = 'DRAFT'
    OR (OLD."status" = 'DRAFT' AND NEW."status" = 'SUBMITTED')
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('DRAFT', 'POSTED'))
    OR (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED')
  ) THEN
    RAISE EXCEPTION 'FinanceExpense_guard: Expense cannot move from % to %', OLD."status", NEW."status"
      USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
  END IF;
  IF OLD."status" <> 'DRAFT' AND (
    NEW."vendorId" IS DISTINCT FROM OLD."vendorId"
    OR NEW."expenseNumber" IS DISTINCT FROM OLD."expenseNumber"
    OR NEW."expenseDate" IS DISTINCT FROM OLD."expenseDate"
    OR NEW."dueDate" IS DISTINCT FROM OLD."dueDate"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."vendorBillNumber" IS DISTINCT FROM OLD."vendorBillNumber"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."taxAmount" IS DISTINCT FROM OLD."taxAmount"
    OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
    OR NEW."expenseAccountId" IS DISTINCT FROM OLD."expenseAccountId"
    OR NEW."fiscalYearId" IS DISTINCT FROM OLD."fiscalYearId"
    OR NEW."fiscalPeriodId" IS DISTINCT FROM OLD."fiscalPeriodId"
    OR NEW."supportingFileAssetId" IS DISTINCT FROM OLD."supportingFileAssetId"
    OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
  ) THEN
    RAISE EXCEPTION 'FinanceExpense_guard: A submitted, posted or reversed expense cannot be edited'
      USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
  END IF;
  IF OLD."status" IN ('POSTED', 'REVERSED') AND (
    NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
    OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    OR NEW."postedAt" IS DISTINCT FROM OLD."postedAt"
    OR NEW."approvedSourceFingerprint" IS DISTINCT FROM OLD."approvedSourceFingerprint"
    OR NEW."postingBatchId" IS DISTINCT FROM OLD."postingBatchId"
    OR NEW."submittedById" IS DISTINCT FROM OLD."submittedById"
  ) THEN
    RAISE EXCEPTION 'FinanceExpense_guard: Posted expense approval evidence is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
  END IF;
  -- A bill can be reversed only while nothing has been paid against it.
  IF OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED' AND EXISTS (
    SELECT 1 FROM "FinancePayable" p
     WHERE p."expenseId" = NEW."id" AND p."outstandingAmount" <> p."originalAmount"
  ) THEN
    RAISE EXCEPTION 'FinanceExpense_guard: A bill with payments cannot be reversed; reverse the payments first'
      USING ERRCODE = '23514', CONSTRAINT = 'FinanceExpense_guard';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "FinanceExpense_guard" BEFORE INSERT OR UPDATE OR DELETE ON "FinanceExpense"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_finance_expense();

-- Payables
ALTER TABLE "FinancePayable"
  ADD CONSTRAINT "FinancePayable_amounts" CHECK (
    "originalAmount" > 0 AND "outstandingAmount" >= 0 AND "outstandingAmount" <= "originalAmount"
  ),
  ADD CONSTRAINT "FinancePayable_status_amounts" CHECK (
    ("status" = 'OPEN' AND "outstandingAmount" = "originalAmount")
    OR ("status" = 'PARTIALLY_PAID' AND "outstandingAmount" > 0 AND "outstandingAmount" < "originalAmount")
    OR ("status" = 'PAID' AND "outstandingAmount" = 0)
    OR ("status" = 'VOID' AND "outstandingAmount" = "originalAmount" AND "voidedAt" IS NOT NULL AND length(btrim(coalesce("voidReason", ''))) > 0)
  );

CREATE FUNCTION schoolos_guard_finance_payable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_expense record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'FinancePayable_guard: Payables cannot be deleted' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT "tenantId", "status", "totalAmount", "vendorId" INTO v_expense
      FROM "FinanceExpense" WHERE "id" = NEW."expenseId" FOR KEY SHARE;
    IF NOT FOUND OR v_expense."tenantId" <> NEW."tenantId" OR v_expense."status" <> 'POSTED'
       OR v_expense."totalAmount" <> NEW."originalAmount"
       OR v_expense."vendorId" IS DISTINCT FROM NEW."vendorId" THEN
      RAISE EXCEPTION 'FinancePayable_guard: A payable must match its posted expense' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
    END IF;
    IF NEW."status" <> 'OPEN' THEN
      RAISE EXCEPTION 'FinancePayable_guard: Payables start open' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."originalAmount" IS DISTINCT FROM OLD."originalAmount"
     OR NEW."expenseId" IS DISTINCT FROM OLD."expenseId"
     OR NEW."vendorId" IS DISTINCT FROM OLD."vendorId"
     OR NEW."payableNumber" IS DISTINCT FROM OLD."payableNumber"
     OR NEW."dueDate" IS DISTINCT FROM OLD."dueDate" THEN
    RAISE EXCEPTION 'FinancePayable_guard: Payable terms are immutable' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
  END IF;
  IF OLD."status" = 'VOID' THEN
    RAISE EXCEPTION 'FinancePayable_guard: A void payable cannot change' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
  END IF;
  IF NEW."status" = 'VOID' AND NOT EXISTS (
    SELECT 1 FROM "FinanceExpense" e WHERE e."id" = NEW."expenseId" AND e."status" = 'REVERSED'
  ) THEN
    RAISE EXCEPTION 'FinancePayable_guard: A payable is voided only by reversing its bill' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
  END IF;
  -- Only the settlement guard moves the balance.
  IF NEW."outstandingAmount" IS DISTINCT FROM OLD."outstandingAmount"
     AND coalesce(current_setting('schoolos.payable_settlement', true), '') <> NEW."id" THEN
    RAISE EXCEPTION 'FinancePayable_guard: Payable balances change only through settlements' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayable_guard';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "FinancePayable_guard" BEFORE INSERT OR UPDATE OR DELETE ON "FinancePayable"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_finance_payable();

-- Settlements
ALTER TABLE "FinancePayableSettlement"
  ADD CONSTRAINT "FinancePayableSettlement_amounts" CHECK (
    "cashAmount" = "amount" - "withheldTaxAmount"
    AND (
      ("reversalOfId" IS NULL AND "amount" > 0 AND "withheldTaxAmount" >= 0 AND "withheldTaxAmount" <= "amount")
      OR ("reversalOfId" IS NOT NULL AND "amount" < 0 AND "withheldTaxAmount" <= 0 AND "withheldTaxAmount" >= "amount"
          AND length(btrim(coalesce("reversalReason", ''))) > 0)
    )
  );
CREATE UNIQUE INDEX "FinancePayableSettlement_one_reversal" ON "FinancePayableSettlement" ("reversalOfId")
  WHERE "reversalOfId" IS NOT NULL;

CREATE FUNCTION schoolos_guard_payable_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_payable record; v_original record; v_paid numeric; v_outstanding numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'FinancePayableSettlement_guard: Settlements are append-only' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
  END IF;
  SELECT "id", "tenantId", "status", "originalAmount" INTO v_payable
    FROM "FinancePayable" WHERE "id" = NEW."payableId" FOR UPDATE;
  IF NOT FOUND OR v_payable."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'FinancePayableSettlement_guard: Tenant-owned reference is not available' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
  END IF;
  IF v_payable."status" = 'VOID' THEN
    RAISE EXCEPTION 'FinancePayableSettlement_guard: A void payable cannot be settled' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
  END IF;
  -- Payer independence (defence in depth for the service rule).
  IF NEW."reversalOfId" IS NULL AND (NEW."createdById" IS NULL OR EXISTS (
    SELECT 1 FROM "FinancePayable" p JOIN "FinanceExpense" e ON e."id" = p."expenseId"
     WHERE p."id" = NEW."payableId"
       AND NEW."createdById" IN (coalesce(e."createdById", ''), coalesce(e."submittedById", ''), coalesce(e."approvedById", ''))
  )) THEN
    RAISE EXCEPTION 'FinancePayableSettlement_guard: The payer must differ from the preparer and the approver' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
  END IF;
  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT "payableId", "amount", "withheldTaxAmount", "reversalOfId" INTO v_original
      FROM "FinancePayableSettlement" WHERE "id" = NEW."reversalOfId";
    IF NOT FOUND OR v_original."payableId" <> NEW."payableId" OR v_original."reversalOfId" IS NOT NULL
       OR NEW."amount" <> -v_original."amount" OR NEW."withheldTaxAmount" <> -v_original."withheldTaxAmount" THEN
      RAISE EXCEPTION 'FinancePayableSettlement_guard: A settlement reversal must exactly offset one settlement of the same payable'
        USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
    END IF;
  END IF;
  SELECT coalesce(sum("amount"), 0) INTO v_paid FROM "FinancePayableSettlement" WHERE "payableId" = NEW."payableId";
  v_paid := v_paid + NEW."amount";
  IF v_paid < 0 OR v_paid > v_payable."originalAmount" THEN
    RAISE EXCEPTION 'FinancePayableSettlement_guard: Settlement would exceed the payable balance' USING ERRCODE = '23514', CONSTRAINT = 'FinancePayableSettlement_guard';
  END IF;
  v_outstanding := v_payable."originalAmount" - v_paid;
  PERFORM set_config('schoolos.payable_settlement', NEW."payableId", true);
  UPDATE "FinancePayable" SET
    "outstandingAmount" = v_outstanding,
    "status" = CASE
      WHEN v_outstanding = 0 THEN 'PAID'::"FinancePayableStatus"
      WHEN v_outstanding = v_payable."originalAmount" THEN 'OPEN'::"FinancePayableStatus"
      ELSE 'PARTIALLY_PAID'::"FinancePayableStatus" END,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."payableId";
  PERFORM set_config('schoolos.payable_settlement', '', true);
  RETURN NEW;
END $$;
CREATE TRIGGER "FinancePayableSettlement_guard" BEFORE INSERT OR UPDATE OR DELETE ON "FinancePayableSettlement"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_payable_settlement();
