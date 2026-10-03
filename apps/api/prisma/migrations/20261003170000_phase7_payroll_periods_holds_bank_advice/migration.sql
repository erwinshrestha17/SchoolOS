-- Phase 7.9: Nepali payroll periods, proration lineage, adjustments, holds and
-- bank payment advice.
--
--   1. refuses to run while payroll runs have an impossible period or two live
--      (non-VOID/CANCELLED) runs of one tenant overlap in time; it never edits
--      or deletes a posted run to make a constraint fit. The only data change
--      is filling a NULL periodStart/periodEnd with the Gregorian-calendar-month
--      bounds the generator itself used for that run (so no run is
--      re-interpreted),
--   2. PayrollRun.periodStart/periodEnd become NOT NULL. This also retires the
--      make_date(periodYear, periodMonth, 1) fallbacks in the attendance and
--      membership payroll-lock functions (which would be wrong for BS labels),
--   3. EXCLUDE: no two live runs of one tenant may cover overlapping dates;
--      CHECK: bounds are ordered and, for BS-labelled runs, are whole days
--      (00:00:00.000 .. 23:59:59.999) spanning 29-32 days,
--   4. fixes staff_attendance_payroll_locked to compare Nepal business DATES:
--      it used `periodEnd + 1 day` against a 23:59:59.999 end, which also
--      locked the first day of the following period,
--   5. PayrollRun.divisorDays/divisorBasis, PayrollLine.prorationBreakdown and
--      adjustment columns: persisted proration lineage,
--   6. PayrollAdjustment: one APPLIED consumption per 7.7 correction, released
--      when its run is voided/cancelled/regenerated, frozen once approved,
--   7. PayrollHold: reason-bound, append-only, independent release,
--   8. PayrollBankAdviceExport: append-only export log with snapshot identity,
--   9. a run cannot enter review/approval/finalization/posting/payment while
--      any of its lines has a negative net.
--
-- Manual rollback: drop the triggers/functions and constraints named below,
-- tables PayrollHold/PayrollAdjustment/PayrollBankAdviceExport, the new
-- columns and enums, and restore the previous staff_attendance_payroll_locked
-- body from 20261003110000. NULL-bound backfill is not reversed.

DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg("id", ', ') INTO bad FROM "PayrollRun"
   WHERE "periodMonth" NOT BETWEEN 1 AND 12 OR "periodYear" NOT BETWEEN 1 AND 9999
      OR ("periodStart" IS NOT NULL AND "periodEnd" IS NOT NULL AND "periodStart"::date > "periodEnd"::date);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 7.9 preflight: payroll runs with an impossible period (resolve before migrating): %', bad;
  END IF;

  UPDATE "PayrollRun"
     SET "periodStart" = COALESCE("periodStart", make_date("periodYear", "periodMonth", 1)::timestamp),
         "periodEnd" = COALESCE("periodEnd", (make_date("periodYear", "periodMonth", 1)::timestamp + interval '1 month' - interval '1 millisecond'))
   WHERE "periodStart" IS NULL OR "periodEnd" IS NULL;

  SELECT string_agg(a."id" || '/' || b."id", ', ') INTO bad
    FROM "PayrollRun" a
    JOIN "PayrollRun" b ON a."tenantId" = b."tenantId" AND a."id" < b."id"
     AND a."status" NOT IN ('VOID', 'CANCELLED') AND b."status" NOT IN ('VOID', 'CANCELLED')
     AND daterange(a."periodStart"::date, a."periodEnd"::date, '[]') && daterange(b."periodStart"::date, b."periodEnd"::date, '[]');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 7.9 preflight: overlapping live payroll runs (void or cancel one before migrating): %', bad;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "PayrollDivisorBasis" AS ENUM ('CALENDAR_DAYS_OF_PERIOD', 'OPERATOR_SUPPLIED');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentKind" AS ENUM ('ARREARS', 'RECOVERY');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentStatus" AS ENUM ('APPLIED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PayrollHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollExceptionCode" ADD VALUE 'INVALID_PAYROLL_PERIOD';
ALTER TYPE "PayrollExceptionCode" ADD VALUE 'PRORATION_INPUT_UNRESOLVED';
ALTER TYPE "PayrollExceptionCode" ADD VALUE 'PAYROLL_ADJUSTMENT_UNRESOLVED';
ALTER TYPE "PayrollExceptionCode" ADD VALUE 'PAYROLL_HOLD_ACTIVE';
ALTER TYPE "PayrollExceptionCode" ADD VALUE 'INVALID_BANK_DETAILS';

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "adjustmentDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "adjustmentEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "prorationBreakdown" JSONB;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "divisorBasis" "PayrollDivisorBasis",
ADD COLUMN     "divisorDays" INTEGER,
ALTER COLUMN "periodStart" SET NOT NULL,
ALTER COLUMN "periodEnd" SET NOT NULL;

-- CreateTable
CREATE TABLE "PayrollHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "PayrollHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "PayrollHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "correctionId" TEXT NOT NULL,
    "sourcePayrollRunId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "kind" "PayrollAdjustmentKind" NOT NULL,
    "status" "PayrollAdjustmentStatus" NOT NULL DEFAULT 'APPLIED',
    "deltaDays" DECIMAL(8,2) NOT NULL,
    "dailyRate" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "pricing" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollBankAdviceExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "exportedById" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lineCount" INTEGER NOT NULL,
    "heldLineCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "reExportReason" TEXT,

    CONSTRAINT "PayrollBankAdviceExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollHold_tenantId_payrollRunId_status_idx" ON "PayrollHold"("tenantId", "payrollRunId", "status");

-- CreateIndex
CREATE INDEX "PayrollHold_tenantId_staffId_idx" ON "PayrollHold"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_tenantId_payrollRunId_status_idx" ON "PayrollAdjustment"("tenantId", "payrollRunId", "status");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_tenantId_correctionId_idx" ON "PayrollAdjustment"("tenantId", "correctionId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollBankAdviceExport_tenantId_payrollRunId_sequence_key" ON "PayrollBankAdviceExport"("tenantId", "payrollRunId", "sequence");

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_sourcePayrollRunId_fkey" FOREIGN KEY ("sourcePayrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "StaffAttendanceCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollBankAdviceExport" ADD CONSTRAINT "PayrollBankAdviceExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollBankAdviceExport" ADD CONSTRAINT "PayrollBankAdviceExport_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollBankAdviceExport" ADD CONSTRAINT "PayrollBankAdviceExport_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Period integrity ───────────────────────────────────────────────────────
ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_no_overlapping_live_period"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    daterange("periodStart"::date, "periodEnd"::date, '[]') WITH &&
  )
  WHERE ("status" NOT IN ('VOID', 'CANCELLED')),
  ADD CONSTRAINT "PayrollRun_period_bounds" CHECK (
    "periodStart"::date <= "periodEnd"::date
    AND (
      "periodYear" < 2075
      OR (
        "periodMonth" BETWEEN 1 AND 12
        AND "periodStart" = "periodStart"::date::timestamp
        AND "periodEnd" = ("periodEnd"::date::timestamp + interval '1 day' - interval '1 millisecond')
        AND ("periodEnd"::date - "periodStart"::date) BETWEEN 28 AND 31
      )
    )
  ),
  ADD CONSTRAINT "PayrollRun_divisor" CHECK (
    ("divisorDays" IS NULL) = ("divisorBasis" IS NULL)
    AND ("divisorDays" IS NULL OR "divisorDays" BETWEEN 1 AND 32)
  );

ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_adjustments_non_negative"
  CHECK ("adjustmentEarnings" >= 0 AND "adjustmentDeductions" >= 0);

CREATE OR REPLACE FUNCTION staff_attendance_payroll_locked(text,timestamp) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."tenantId"=$1
 AND (r."finalizedAt" IS NOT NULL OR r.status IN ('APPROVED','FINALIZED','POSTED','PAID'))
 AND $2::date BETWEEN r."periodStart"::date AND r."periodEnd"::date);
$$;

-- ── A negative net can never advance a run ─────────────────────────────────
CREATE FUNCTION "guard_payroll_run_negative_net"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status"
     AND NEW."status" IN ('VALIDATED', 'UNDER_REVIEW', 'REVIEWED', 'APPROVED', 'FINALIZED', 'POSTED', 'PAID')
     AND EXISTS (SELECT 1 FROM "PayrollLine" l WHERE l."payrollRunId" = NEW."id" AND l."netSalary" < 0) THEN
    RAISE EXCEPTION 'PAYROLL_NEGATIVE_NET' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollRun_negative_net_guard"
  BEFORE UPDATE OF "status" ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_run_negative_net"();

-- ── Holds ──────────────────────────────────────────────────────────────────
ALTER TABLE "PayrollHold"
  ADD CONSTRAINT "PayrollHold_reason" CHECK (length(btrim("reason")) BETWEEN 1 AND 500 AND "reason" = btrim("reason")),
  ADD CONSTRAINT "PayrollHold_release_evidence" CHECK (
    ("status" = 'ACTIVE' AND "releasedById" IS NULL AND "releasedAt" IS NULL AND "releaseReason" IS NULL)
    OR ("status" = 'RELEASED' AND "releasedById" IS NOT NULL AND "releasedAt" IS NOT NULL
        AND "releaseReason" IS NOT NULL AND length(btrim("releaseReason")) BETWEEN 1 AND 500)
  ),
  ADD CONSTRAINT "PayrollHold_independent_release" CHECK ("releasedById" IS NULL OR "releasedById" <> "createdById");
CREATE UNIQUE INDEX "PayrollHold_one_active" ON "PayrollHold" ("tenantId", "payrollRunId", "staffId") WHERE "status" = 'ACTIVE';

CREATE FUNCTION "guard_payroll_hold"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_status "PayrollRunStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYROLL_HOLD_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."id" = NEW."payrollRunId" AND r."tenantId" = NEW."tenantId")
     OR NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."id" = NEW."staffId" AND s."tenantId" = NEW."tenantId")
     OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."createdById" AND u."tenantId" = NEW."tenantId")
     OR (NEW."releasedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."releasedById" AND u."tenantId" = NEW."tenantId")) THEN
    RAISE EXCEPTION 'PAYROLL_HOLD_TENANT_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- FOR SHARE serialises against a concurrent move of the run to PAID.
    SELECT r."status" INTO run_status FROM "PayrollRun" r WHERE r."id" = NEW."payrollRunId" FOR SHARE;
    IF run_status NOT IN ('GENERATED', 'VALIDATED', 'UNDER_REVIEW', 'REVIEWED', 'APPROVED', 'FINALIZED', 'POSTED')
       OR NEW."status" <> 'ACTIVE'
       OR NOT EXISTS (SELECT 1 FROM "PayrollLine" l WHERE l."payrollRunId" = NEW."payrollRunId" AND l."staffId" = NEW."staffId") THEN
      RAISE EXCEPTION 'PAYROLL_HOLD_NOT_ALLOWED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: the only change is ACTIVE -> RELEASED with release evidence.
  IF OLD."status" <> 'ACTIVE' OR NEW."status" <> 'RELEASED'
     OR (to_jsonb(NEW) - ARRAY['status', 'releasedById', 'releasedAt', 'releaseReason'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'releasedById', 'releasedAt', 'releaseReason']) THEN
    RAISE EXCEPTION 'PAYROLL_HOLD_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollHold_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollHold"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_hold"();

-- A run can never be marked paid while a payment hold is active on it.
CREATE FUNCTION "guard_payroll_run_active_hold"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'PAID' AND OLD."status" IS DISTINCT FROM 'PAID'
     AND EXISTS (SELECT 1 FROM "PayrollHold" h WHERE h."payrollRunId" = NEW."id" AND h."status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'PAYROLL_HOLD_ACTIVE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollRun_active_hold_guard"
  BEFORE UPDATE OF "status" ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_run_active_hold"();

-- ── Adjustments (consumption of 7.7 corrections) ───────────────────────────
ALTER TABLE "PayrollAdjustment"
  ADD CONSTRAINT "PayrollAdjustment_kind_sign" CHECK (
    "amount" > 0 AND (
      ("kind" = 'ARREARS' AND "deltaDays" > 0) OR ("kind" = 'RECOVERY' AND "deltaDays" < 0)
    )
  ),
  ADD CONSTRAINT "PayrollAdjustment_release_evidence" CHECK (
    ("status" = 'APPLIED' AND "releasedAt" IS NULL AND "releaseReason" IS NULL)
    OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "releaseReason" IS NOT NULL)
  ),
  ADD CONSTRAINT "PayrollAdjustment_pricing_object" CHECK (jsonb_typeof("pricing") = 'object'),
  ADD CONSTRAINT "PayrollAdjustment_distinct_runs" CHECK ("payrollRunId" <> "sourcePayrollRunId");
CREATE UNIQUE INDEX "PayrollAdjustment_one_applied" ON "PayrollAdjustment" ("tenantId", "correctionId") WHERE "status" = 'APPLIED';

CREATE FUNCTION "guard_payroll_adjustment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target "PayrollRun"%ROWTYPE;
  source "PayrollRun"%ROWTYPE;
  c "StaffAttendanceCorrection"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO target FROM "PayrollRun" WHERE "id" = NEW."payrollRunId";
  IF target."id" IS NULL OR target."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_TENANT_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO source FROM "PayrollRun" WHERE "id" = NEW."sourcePayrollRunId";
    SELECT * INTO c FROM "StaffAttendanceCorrection" WHERE "id" = NEW."correctionId";
    IF source."id" IS NULL OR source."tenantId" <> NEW."tenantId"
       OR c."id" IS NULL OR c."tenantId" <> NEW."tenantId" OR c."staffId" <> NEW."staffId"
       OR NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."id" = NEW."staffId" AND s."tenantId" = NEW."tenantId")
       OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."createdById" AND u."tenantId" = NEW."tenantId") THEN
      RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_TENANT_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" <> 'APPLIED'
       OR target."status" NOT IN ('DRAFT', 'GENERATED')
       OR c."status" <> 'PENDING_PAYROLL_ADJUSTMENT'
       OR c."attendanceDate"::date <> NEW."attendanceDate"
       OR NEW."attendanceDate" >= target."periodStart"::date
       OR NEW."attendanceDate" < source."periodStart"::date
       OR NEW."attendanceDate" > source."periodEnd"::date
       OR source."periodEnd" >= target."periodStart" THEN
      RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_NOT_ELIGIBLE' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: only APPLIED -> RELEASED, and never under an approved run.
  IF OLD."status" <> 'APPLIED' OR NEW."status" <> 'RELEASED'
     OR (to_jsonb(NEW) - ARRAY['status', 'releasedAt', 'releaseReason'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'releasedAt', 'releaseReason']) THEN
    RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF target."status" NOT IN ('DRAFT', 'GENERATED', 'VOID', 'CANCELLED') THEN
    RAISE EXCEPTION 'PAYROLL_ADJUSTMENT_RUN_LOCKED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollAdjustment_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollAdjustment"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_adjustment"();

-- A voided or cancelled run gives its corrections back so a replacement run
-- (or a later period) can consume them.
CREATE FUNCTION "release_payroll_adjustments_on_run_end"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "PayrollAdjustment"
     SET "status" = 'RELEASED', "releasedAt" = clock_timestamp(), "releaseReason" = 'RUN_' || NEW."status"::text
   WHERE "payrollRunId" = NEW."id" AND "status" = 'APPLIED';
  RETURN NULL;
END $$;
CREATE TRIGGER "PayrollRun_release_adjustments"
  AFTER UPDATE OF "status" ON "PayrollRun"
  FOR EACH ROW
  WHEN (NEW."status" IN ('VOID', 'CANCELLED') AND OLD."status" NOT IN ('VOID', 'CANCELLED'))
  EXECUTE FUNCTION "release_payroll_adjustments_on_run_end"();

-- ── Bank advice export log ─────────────────────────────────────────────────
ALTER TABLE "PayrollBankAdviceExport"
  ADD CONSTRAINT "PayrollBankAdviceExport_counts" CHECK ("sequence" >= 1 AND "lineCount" >= 0 AND "heldLineCount" >= 0 AND "totalAmount" >= 0),
  ADD CONSTRAINT "PayrollBankAdviceExport_re_export_reason" CHECK (
    ("sequence" = 1 AND "reExportReason" IS NULL)
    OR ("sequence" > 1 AND "reExportReason" IS NOT NULL AND length(btrim("reExportReason")) BETWEEN 1 AND 500)
  ),
  ADD CONSTRAINT "PayrollBankAdviceExport_hash" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$' AND "sourceFingerprint" ~ '^[0-9a-f]{64}$');

CREATE FUNCTION "guard_payroll_bank_advice_export"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_status "PayrollRunStatus"; previous INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'PAYROLL_BANK_ADVICE_EXPORT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  SELECT r."status" INTO run_status FROM "PayrollRun" r WHERE r."id" = NEW."payrollRunId" AND r."tenantId" = NEW."tenantId";
  IF run_status IS NULL OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."exportedById" AND u."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'PAYROLL_BANK_ADVICE_TENANT_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF run_status NOT IN ('FINALIZED', 'POSTED') THEN
    RAISE EXCEPTION 'PAYROLL_BANK_ADVICE_RUN_STATE' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(MAX(e."sequence"), 0) INTO previous FROM "PayrollBankAdviceExport" e WHERE e."payrollRunId" = NEW."payrollRunId";
  IF NEW."sequence" <> previous + 1 THEN
    RAISE EXCEPTION 'PAYROLL_BANK_ADVICE_SEQUENCE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PayrollBankAdviceExport_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PayrollBankAdviceExport"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_bank_advice_export"();
