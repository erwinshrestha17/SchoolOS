-- Phase 7.3 — Ledger & numbering invariants.
--
-- 1. DocumentSequence: atomic numbering replacing count()+1 for invoices,
--    refunds, cashier closes and employee ids (seeded from existing maxima).
-- 2. Journal backstops: line CHECK, balanced-at-commit, posted immutability,
--    closed/locked-period guard, required period, system source key.
-- 3. Payment / Receipt immutability.
--
-- Preflights FAIL (never edit or fabricate ledger rows). Resolve the listed
-- ids, then re-run the migration.

-- ---------------------------------------------------------------------------
-- Preflight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
  v_ids text;
BEGIN
  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "JournalLine"
    WHERE NOT (
      "debit" >= 0 AND "credit" >= 0 AND "amount" > 0 AND (
        ("side" = 'DEBIT' AND "debit" = "amount" AND "credit" = 0) OR
        ("side" = 'CREDIT' AND "credit" = "amount" AND "debit" = 0)
      )
    )
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.3 preflight: % JournalLine row(s) violate the debit/credit/side/amount rule (first ids: %). Correct them through an approved adjustment before migrating.', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT e."id"
    FROM "JournalEntry" e
    LEFT JOIN "JournalLine" l ON l."journalEntryId" = e."id"
    WHERE e."status" IN ('POSTED', 'REVERSED')
    GROUP BY e."id"
    HAVING count(l."id") < 2
        OR COALESCE(sum(l."debit"), 0) <> COALESCE(sum(l."credit"), 0)
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.3 preflight: % posted/reversed journal(s) are unbalanced or have fewer than two lines (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "JournalEntry"
    WHERE "status" IN ('POSTED', 'REVERSED') AND "fiscalPeriodId" IS NULL
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.3 preflight: % posted/reversed journal(s) have no fiscal period (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "JournalEntry"
    WHERE "sourceType" <> 'MANUAL' AND "sourceId" IS NULL
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.3 preflight: % system journal(s) have no source key (first ids: %).', v_count, v_ids;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. DocumentSequence
-- ---------------------------------------------------------------------------
CREATE TABLE "DocumentSequence" (
  "tenantId" TEXT NOT NULL,
  "sequenceKey" TEXT NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("tenantId", "sequenceKey"),
  CONSTRAINT "DocumentSequence_lastValue_nonnegative" CHECK ("lastValue" >= 0)
);

ALTER TABLE "DocumentSequence"
  ADD CONSTRAINT "DocumentSequence_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed from the highest number already issued, so the next allocation can
-- never collide with an existing row. Rows that do not match the generated
-- format (e.g. a hand-typed employee id) are ignored.
INSERT INTO "DocumentSequence" ("tenantId", "sequenceKey", "lastValue", "updatedAt")
SELECT "tenantId",
       'INVOICE:' || substring("invoiceNumber" from '^INV-(.+)-\d{1,9}$'),
       max(substring("invoiceNumber" from '-(\d{1,9})$')::integer),
       CURRENT_TIMESTAMP
FROM "Invoice"
WHERE "invoiceNumber" ~ '^INV-.+-\d{1,9}$'
GROUP BY "tenantId", substring("invoiceNumber" from '^INV-(.+)-\d{1,9}$');

INSERT INTO "DocumentSequence" ("tenantId", "sequenceKey", "lastValue", "updatedAt")
SELECT "tenantId", 'REFUND',
       max(substring("refundNumber" from '-(\d{1,9})$')::integer),
       CURRENT_TIMESTAMP
FROM "PaymentRefund"
WHERE "refundNumber" ~ '^RFD-\d{4}-\d{1,9}$'
GROUP BY "tenantId";

INSERT INTO "DocumentSequence" ("tenantId", "sequenceKey", "lastValue", "updatedAt")
SELECT "tenantId", 'CASHIER_CLOSE',
       max(substring("closeNumber" from '-(\d{1,9})$')::integer),
       CURRENT_TIMESTAMP
FROM "CashierClose"
WHERE "closeNumber" ~ '^CLS-\d{4}-\d{1,9}$'
GROUP BY "tenantId";

INSERT INTO "DocumentSequence" ("tenantId", "sequenceKey", "lastValue", "updatedAt")
SELECT "tenantId", 'EMPLOYEE',
       max(substring("employeeId" from '-EMP-(\d{1,9})$')::integer),
       CURRENT_TIMESTAMP
FROM "Staff"
WHERE "employeeId" ~ '-EMP-\d{1,9}$'
GROUP BY "tenantId";

-- ---------------------------------------------------------------------------
-- 2. Journal backstops
-- ---------------------------------------------------------------------------
ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_amount_side_check" CHECK (
    "debit" >= 0 AND "credit" >= 0 AND "amount" > 0 AND (
      ("side" = 'DEBIT' AND "debit" = "amount" AND "credit" = 0) OR
      ("side" = 'CREDIT' AND "credit" = "amount" AND "debit" = 0)
    )
  );

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_posted_has_period" CHECK (
    "status" NOT IN ('POSTED', 'REVERSED') OR "fiscalPeriodId" IS NOT NULL
  ),
  ADD CONSTRAINT "JournalEntry_system_source_key" CHECK (
    "sourceType" = 'MANUAL' OR "sourceId" IS NOT NULL
  );

ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_fiscalPeriodId_fkey";
ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey"
  FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Balanced at commit: a POSTED/REVERSED journal needs >= 2 lines and
-- sum(debit) = sum(credit). Deferred so the entry and its lines may be
-- inserted in any order inside one transaction.
CREATE FUNCTION schoolos_assert_journal_balanced(p_entry_id text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_status "JournalEntryStatus";
  v_lines integer;
  v_debit numeric;
  v_credit numeric;
BEGIN
  SELECT "status" INTO v_status FROM "JournalEntry" WHERE "id" = p_entry_id;
  IF NOT FOUND OR v_status NOT IN ('POSTED', 'REVERSED') THEN
    RETURN;
  END IF;
  SELECT count(*), COALESCE(sum("debit"), 0), COALESCE(sum("credit"), 0)
    INTO v_lines, v_debit, v_credit
  FROM "JournalLine" WHERE "journalEntryId" = p_entry_id;
  IF v_lines < 2 THEN
    RAISE EXCEPTION 'A posted journal needs at least two lines (journal %)', p_entry_id
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_balanced';
  END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'A posted journal must balance: debit % <> credit % (journal %)', v_debit, v_credit, p_entry_id
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_balanced';
  END IF;
END $$;

CREATE FUNCTION schoolos_journal_entry_balanced_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM schoolos_assert_journal_balanced(NEW."id");
  RETURN NULL;
END $$;

CREATE FUNCTION schoolos_journal_line_balanced_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM schoolos_assert_journal_balanced(OLD."journalEntryId");
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM schoolos_assert_journal_balanced(NEW."journalEntryId");
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "JournalEntry_posted_balanced"
  AFTER INSERT OR UPDATE OF "status" ON "JournalEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION schoolos_journal_entry_balanced_trigger();

CREATE CONSTRAINT TRIGGER "JournalLine_posted_balanced"
  AFTER INSERT OR UPDATE OR DELETE ON "JournalLine"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION schoolos_journal_line_balanced_trigger();

-- Posted journals are immutable. Only linkage/reversal columns may be set,
-- once, from NULL; POSTED -> REVERSED is the only status move.
CREATE FUNCTION schoolos_guard_journal_entry_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_linkage text[] := ARRAY[
    'status', 'reversedAt', 'reversedById', 'reversalReason',
    'reversalOfId', 'correctionOfId', 'correctionReason'
  ];
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := to_jsonb(OLD);
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('POSTED', 'REVERSED') THEN
      RAISE EXCEPTION 'Posted journal entries cannot be deleted (journal %)', OLD."id"
        USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" IN ('POSTED', 'REVERSED') THEN
    IF (v_new - v_linkage) IS DISTINCT FROM (v_old - v_linkage) THEN
      RAISE EXCEPTION 'Posted journal entries are immutable (journal %)', OLD."id"
        USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_immutable';
    END IF;
    IF NEW."status" <> OLD."status"
       AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
      RAISE EXCEPTION 'Illegal posted journal status change % -> % (journal %)', OLD."status", NEW."status", OLD."id"
        USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_immutable';
    END IF;
    FOREACH v_key IN ARRAY v_linkage LOOP
      IF v_key <> 'status'
         AND v_old -> v_key <> 'null'::jsonb
         AND (v_new -> v_key) IS DISTINCT FROM (v_old -> v_key) THEN
        RAISE EXCEPTION 'Journal linkage column % is write-once (journal %)', v_key, OLD."id"
          USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_immutable';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "JournalEntry_posted_immutable"
  BEFORE UPDATE OR DELETE ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_journal_entry_immutable();

-- Lines of a posted journal never change. A journal inserted already POSTED
-- may receive its lines in the same transaction (tracked by a local setting).
CREATE FUNCTION schoolos_track_new_posted_journal() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IN ('POSTED', 'REVERSED') THEN
    PERFORM set_config(
      'schoolos.journal_inserted_posted',
      COALESCE(current_setting('schoolos.journal_inserted_posted', true), '') || ',' || NEW."id",
      true
    );
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER "JournalEntry_track_inserted_posted"
  AFTER INSERT ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION schoolos_track_new_posted_journal();

CREATE FUNCTION schoolos_guard_journal_line_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status "JournalEntryStatus";
  v_entry text;
BEGIN
  FOREACH v_entry IN ARRAY (
    CASE TG_OP
      WHEN 'INSERT' THEN ARRAY[NEW."journalEntryId"]
      WHEN 'DELETE' THEN ARRAY[OLD."journalEntryId"]
      ELSE ARRAY[OLD."journalEntryId", NEW."journalEntryId"]
    END
  ) LOOP
    SELECT "status" INTO v_status FROM "JournalEntry" WHERE "id" = v_entry;
    IF FOUND AND v_status IN ('POSTED', 'REVERSED') THEN
      IF TG_OP = 'INSERT'
         AND position(',' || v_entry in COALESCE(current_setting('schoolos.journal_inserted_posted', true), '')) > 0 THEN
        CONTINUE;
      END IF;
      RAISE EXCEPTION 'Lines of a posted journal are immutable (journal %)', v_entry
        USING ERRCODE = '23514', CONSTRAINT = 'JournalLine_posted_immutable';
    END IF;
  END LOOP;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER "JournalLine_posted_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_journal_line_immutable();

-- A journal entering POSTED must sit in an OPEN period/year covering its date.
-- The fiscal-year closing entry is the one entry allowed into a CLOSED period.
CREATE FUNCTION schoolos_guard_journal_posting_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_period record;
  v_day timestamp;
BEGIN
  IF NEW."status" <> 'POSTED' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'POSTED' THEN
    RETURN NEW;
  END IF;
  IF NEW."fiscalPeriodId" IS NULL THEN
    RAISE EXCEPTION 'A posted journal requires a fiscal period (journal %)', NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posted_has_period';
  END IF;
  SELECT p."id", p."tenantId", p."status", p."label", p."startDate", p."endDate", y."status" AS "yearStatus"
    INTO v_period
  FROM "FiscalPeriod" p JOIN "FiscalYear" y ON y."id" = p."fiscalYearId"
  WHERE p."id" = NEW."fiscalPeriodId";
  IF NOT FOUND OR v_period."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Journal fiscal period does not belong to the tenant (journal %)', NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posting_period';
  END IF;
  v_day := date_trunc('day', NEW."entryDate");
  IF v_day < v_period."startDate" OR v_day > v_period."endDate" THEN
    RAISE EXCEPTION 'Journal entry date is outside fiscal period "%" (journal %)', v_period."label", NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posting_period';
  END IF;
  IF NEW."sourceType" = 'CLOSING_ENTRY' AND v_period."status" = 'CLOSED' THEN
    RETURN NEW;
  END IF;
  IF v_period."status" <> 'OPEN' THEN
    RAISE EXCEPTION 'Cannot post into % fiscal period "%" (journal %)', lower(v_period."status"::text), v_period."label", NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posting_period';
  END IF;
  IF v_period."yearStatus" = 'CLOSED' THEN
    RAISE EXCEPTION 'Cannot post into a closed fiscal year (journal %)', NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'JournalEntry_posting_period';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "JournalEntry_posting_period"
  BEFORE INSERT OR UPDATE OF "status" ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_journal_posting_period();

-- ---------------------------------------------------------------------------
-- 3. Payment / Receipt immutability
-- ---------------------------------------------------------------------------
CREATE FUNCTION schoolos_guard_payment_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_mutable text[] := ARRAY[
    'status', 'reversedAt', 'reversedById', 'reversalReason',
    'reversalIdempotencyKey', 'recognizedAt', 'metadata', 'narration'
  ];
  v_new jsonb;
  v_old jsonb;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payments cannot be deleted; reverse them instead (payment %)', OLD."id"
      USING ERRCODE = '23514', CONSTRAINT = 'Payment_immutable';
  END IF;
  v_new := to_jsonb(NEW) - v_mutable;
  v_old := to_jsonb(OLD) - v_mutable;
  IF current_setting('schoolos.allow_payment_student_reassign', true) = 'on' THEN
    v_new := v_new - 'studentId';
    v_old := v_old - 'studentId';
  END IF;
  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'Payment amount, method, student, allocation and timing are immutable (payment %)', OLD."id"
      USING ERRCODE = '23514', CONSTRAINT = 'Payment_immutable';
  END IF;
  IF OLD."status" = 'REVERSED' AND NEW."status" <> 'REVERSED' THEN
    RAISE EXCEPTION 'A reversed payment cannot be reinstated (payment %)', OLD."id"
      USING ERRCODE = '23514', CONSTRAINT = 'Payment_immutable';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['reversedAt', 'reversedById', 'reversalReason', 'reversalIdempotencyKey'] LOOP
    IF to_jsonb(OLD) -> v_key <> 'null'::jsonb
       AND (to_jsonb(NEW) -> v_key) IS DISTINCT FROM (to_jsonb(OLD) -> v_key) THEN
      RAISE EXCEPTION 'Payment reversal column % is write-once (payment %)', v_key, OLD."id"
        USING ERRCODE = '23514', CONSTRAINT = 'Payment_immutable';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER "Payment_immutable"
  BEFORE UPDATE OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_payment_immutable();

CREATE FUNCTION schoolos_guard_receipt_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_mutable text[] := ARRAY[
    'metadata', 'pdfUrl', 'fileAssetId', 'fileStatus', 'fileGeneratedAt'
  ];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Receipts cannot be deleted (receipt %)', OLD."id"
      USING ERRCODE = '23514', CONSTRAINT = 'Receipt_immutable';
  END IF;
  IF (to_jsonb(NEW) - v_mutable) IS DISTINCT FROM (to_jsonb(OLD) - v_mutable) THEN
    RAISE EXCEPTION 'Receipt number, payment, tax and issue data are immutable (receipt %)', OLD."id"
      USING ERRCODE = '23514', CONSTRAINT = 'Receipt_immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Receipt_immutable"
  BEFORE UPDATE OR DELETE ON "Receipt"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_receipt_immutable();
