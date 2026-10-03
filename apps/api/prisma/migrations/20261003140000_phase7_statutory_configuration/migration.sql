-- Phase 7.8: compensation & statutory configuration.
--
--   1. refuses to run while ACTIVE salary structures overlap for one staff
--      member or an approved statutory policy would violate the new rules
--      (it never edits or deletes data to make a constraint fit),
--   2. EXCLUDE: at most one ACTIVE salary structure per staff at any date,
--   3. StaffStatutoryMembership: effective-dated scheme + identifier per
--      staff, one scheme at a time, history immutable, tenant-consistent,
--      and not changeable underneath an approved payroll run,
--   4. statutory policy versions reuse NepalHrPolicyVersion (kind
--      STATUTORY_SCHEME_TAX): an APPROVED one must be national, carry a
--      source checksum and a schemes payload,
--   5. PayrollRun.statutoryPolicyVersionId (+ PayrollLine.statutoryBreakdown):
--      the version used, validated against the run period and frozen once the
--      run is approved,
--   6. fills Staff bank details from the latest ACTIVE structure only where the
--      Staff row has none (Staff becomes the single bank-details source).
--
-- Manual rollback: drop the triggers/functions below, constraints
-- SalaryStructure_no_active_overlap and NepalHrPolicyVersion_statutory_approved,
-- table StaffStatutoryMembership, column PayrollRun.statutoryPolicyVersionId,
-- column PayrollLine.statutoryBreakdown and type StatutoryScheme. The bank
-- backfill is not reversed (it only filled empty Staff fields).

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE overlap_ids TEXT;
BEGIN
  SELECT string_agg(a."id" || '/' || b."id", ', ') INTO overlap_ids
    FROM "SalaryStructure" a
    JOIN "SalaryStructure" b
      ON a."tenantId" = b."tenantId" AND a."staffId" = b."staffId" AND a."id" < b."id"
     AND a."status" = 'ACTIVE' AND b."status" = 'ACTIVE'
     AND daterange(a."effectiveFrom"::date, COALESCE(a."effectiveTo"::date, 'infinity'::date), '[]')
      && daterange(b."effectiveFrom"::date, COALESCE(b."effectiveTo"::date, 'infinity'::date), '[]');
  IF overlap_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 7.8 preflight: overlapping ACTIVE salary structures (resolve before migrating): %', overlap_ids;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion"
    WHERE "kind" = 'STATUTORY_SCHEME_TAX' AND "reviewStatus" = 'APPROVED'
      AND ("scope" <> 'NATIONAL' OR "sourceChecksumSha256" IS NULL OR "payloadSchemaVersion" <> 1
           OR jsonb_typeof("payload" -> 'schemes') IS DISTINCT FROM 'array'
           OR jsonb_array_length("payload" -> 'schemes') = 0)
  ) THEN
    RAISE EXCEPTION 'Phase 7.8 preflight: an approved statutory policy version does not meet the statutory payload rules';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "StatutoryScheme" AS ENUM ('SSF', 'PF');

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "statutoryPolicyVersionId" TEXT;

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "statutoryBreakdown" JSONB;

-- CreateTable
CREATE TABLE "StaffStatutoryMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "scheme" "StatutoryScheme" NOT NULL,
    "memberIdentifier" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" TEXT NOT NULL,
    "endedById" TEXT,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffStatutoryMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffStatutoryMembership_tenantId_staffId_effectiveFrom_idx" ON "StaffStatutoryMembership"("tenantId", "staffId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollRun_statutoryPolicyVersionId_idx" ON "PayrollRun"("statutoryPolicyVersionId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_statutoryPolicyVersionId_fkey" FOREIGN KEY ("statutoryPolicyVersionId") REFERENCES "NepalHrPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStatutoryMembership" ADD CONSTRAINT "StaffStatutoryMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStatutoryMembership" ADD CONSTRAINT "StaffStatutoryMembership_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStatutoryMembership" ADD CONSTRAINT "StaffStatutoryMembership_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffStatutoryMembership" ADD CONSTRAINT "StaffStatutoryMembership_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── One ACTIVE salary structure per staff at any date ──────────────────────
ALTER TABLE "SalaryStructure"
  ADD CONSTRAINT "SalaryStructure_no_active_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "staffId" WITH =,
    daterange("effectiveFrom"::date, COALESCE("effectiveTo"::date, 'infinity'::date), '[]') WITH &&
  )
  WHERE ("status" = 'ACTIVE');

-- ── Memberships: one scheme at a time, immutable history ───────────────────
ALTER TABLE "StaffStatutoryMembership"
  ADD CONSTRAINT "StaffStatutoryMembership_dates"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "StaffStatutoryMembership_identifier"
    CHECK ("memberIdentifier" IS NULL OR (length(btrim("memberIdentifier")) BETWEEN 1 AND 64 AND "memberIdentifier" = btrim("memberIdentifier"))),
  ADD CONSTRAINT "StaffStatutoryMembership_end_evidence"
    CHECK (("endedById" IS NULL) = ("endReason" IS NULL) AND ("endReason" IS NULL OR (length(btrim("endReason")) BETWEEN 1 AND 500 AND "effectiveTo" IS NOT NULL))),
  ADD CONSTRAINT "StaffStatutoryMembership_one_scheme_at_a_time"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "staffId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[)') WITH &&
  );

-- A payroll run that is approved (or later) is evidence. Statutory membership
-- cannot be created, back-dated or ended underneath it for a staff member who
-- has a line in that run.
CREATE FUNCTION "staff_membership_payroll_locked"(p_tenant TEXT, p_staff TEXT, p_from DATE, p_to DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "PayrollRun" r
    JOIN "PayrollLine" l ON l."payrollRunId" = r."id" AND l."staffId" = p_staff
    WHERE r."tenantId" = p_tenant
      AND (r."finalizedAt" IS NOT NULL OR r."status" IN ('APPROVED', 'FINALIZED', 'POSTED', 'PAID'))
      AND COALESCE(r."periodEnd"::date, (make_date(r."periodYear", r."periodMonth", 1) + interval '1 month - 1 day')::date) >= p_from
      AND COALESCE(r."periodEnd"::date, (make_date(r."periodYear", r."periodMonth", 1) + interval '1 month - 1 day')::date) < COALESCE(p_to, 'infinity'::date)
  );
$$;

CREATE FUNCTION "guard_staff_statutory_membership"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."id" = NEW."staffId" AND s."tenantId" = NEW."tenantId")
     OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."createdById" AND u."tenantId" = NEW."tenantId")
     OR (NEW."endedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."endedById" AND u."tenantId" = NEW."tenantId")) THEN
    RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_TENANT_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF "staff_membership_payroll_locked"(NEW."tenantId", NEW."staffId", NEW."effectiveFrom", NEW."effectiveTo") THEN
      RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_PAYROLL_LOCKED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: identity, scheme, identifier and start are fixed; the only change
  -- allowed is ending an open membership with a reason.
  IF (NEW."id", NEW."tenantId", NEW."staffId", NEW."scheme", NEW."memberIdentifier", NEW."effectiveFrom", NEW."createdById", NEW."createdAt")
     IS DISTINCT FROM
     (OLD."id", OLD."tenantId", OLD."staffId", OLD."scheme", OLD."memberIdentifier", OLD."effectiveFrom", OLD."createdById", OLD."createdAt") THEN
    RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo"
     OR NEW."endedById" IS DISTINCT FROM OLD."endedById"
     OR NEW."endReason" IS DISTINCT FROM OLD."endReason" THEN
    IF OLD."effectiveTo" IS NOT NULL OR NEW."effectiveTo" IS NULL OR NEW."endedById" IS NULL THEN
      RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF "staff_membership_payroll_locked"(OLD."tenantId", OLD."staffId", NEW."effectiveTo", NULL) THEN
      RAISE EXCEPTION 'STATUTORY_MEMBERSHIP_PAYROLL_LOCKED' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END $$;

CREATE TRIGGER "StaffStatutoryMembership_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "StaffStatutoryMembership"
  FOR EACH ROW EXECUTE FUNCTION "guard_staff_statutory_membership"();

-- ── Statutory policy versions (reuse NepalHrPolicyVersion) ─────────────────
-- Statutory schemes are national law: no school/district override. An approved
-- version must carry a source checksum and at least one scheme.
ALTER TABLE "NepalHrPolicyVersion"
  ADD CONSTRAINT "NepalHrPolicyVersion_statutory_approved"
  CHECK (
    "kind" <> 'STATUTORY_SCHEME_TAX' OR "reviewStatus" <> 'APPROVED'
    OR (
      "scope" = 'NATIONAL'
      AND "sourceChecksumSha256" IS NOT NULL
      AND "payloadSchemaVersion" = 1
      AND jsonb_typeof("payload" -> 'schemes') = 'array'
      AND jsonb_array_length("payload" -> 'schemes') > 0
    )
  );

-- ── The policy version a payroll run used ─────────────────────────────────
CREATE FUNCTION "guard_payroll_run_statutory_policy"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  period_end DATE;
  v "NepalHrPolicyVersion"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."statutoryPolicyVersionId" IS DISTINCT FROM OLD."statutoryPolicyVersionId"
     AND (OLD."finalizedAt" IS NOT NULL OR OLD."status" IN ('APPROVED', 'FINALIZED', 'POSTED', 'PAID')) THEN
    RAISE EXCEPTION 'PAYROLL_STATUTORY_POLICY_FROZEN' USING ERRCODE = '23514';
  END IF;
  IF NEW."statutoryPolicyVersionId" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."statutoryPolicyVersionId" IS DISTINCT FROM OLD."statutoryPolicyVersionId") THEN
    period_end := COALESCE(NEW."periodEnd"::date, (make_date(NEW."periodYear", NEW."periodMonth", 1) + interval '1 month - 1 day')::date);
    SELECT * INTO v FROM "NepalHrPolicyVersion" WHERE "id" = NEW."statutoryPolicyVersionId";
    IF NOT FOUND OR v."kind" <> 'STATUTORY_SCHEME_TAX' OR v."reviewStatus" <> 'APPROVED'
       OR v."effectiveFrom"::date > period_end
       OR (v."effectiveTo" IS NOT NULL AND v."effectiveTo"::date <= period_end) THEN
      RAISE EXCEPTION 'PAYROLL_STATUTORY_POLICY_NOT_APPLICABLE' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PayrollRun_statutory_policy_guard"
  BEFORE INSERT OR UPDATE ON "PayrollRun"
  FOR EACH ROW EXECUTE FUNCTION "guard_payroll_run_statutory_policy"();

-- ── Staff is the single bank-details source ────────────────────────────────
-- Fill empty Staff bank details from the latest ACTIVE structure so payroll
-- readiness (which now reads Staff only) keeps working. Existing Staff values
-- are never overwritten.
UPDATE "Staff" s
   SET "bankAccount" = src."bankAccount",
       "bankName" = COALESCE(NULLIF(btrim(s."bankName"), ''), src."bankName")
  FROM (
    SELECT DISTINCT ON ("staffId") "staffId", "bankAccount", "bankName"
      FROM "SalaryStructure"
     WHERE "status" = 'ACTIVE' AND NULLIF(btrim("bankAccount"), '') IS NOT NULL
     ORDER BY "staffId", "effectiveFrom" DESC
  ) src
 WHERE src."staffId" = s."id" AND NULLIF(btrim(s."bankAccount"), '') IS NULL;
