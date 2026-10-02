-- Phase 7.1 — StaffEmployment is the single authority for "employed on date X".
--
-- Until now only the guard trigger compared a new VERIFIED employment with
-- other VERIFIED rows. Once a period was ENDED it dropped out of that check,
-- so a later VERIFIED row could silently overlap historical employment, and
-- the check was a read-then-write inside a trigger rather than a declarative
-- constraint. This migration:
--
--   1. refuses to run while authoritative employment history already
--      overlaps (it never edits or deletes history to make the constraint fit),
--   2. adds an EXCLUDE constraint over every verified (VERIFIED or ENDED)
--      employment window per staff member,
--   3. adds StaffResponsibility: effective-dated positions inside a verified
--      employment, with at most one PRIMARY responsibility at any instant and
--      any number of SECONDARY ones (replaces the free-text
--      Staff.department / Staff.designation as the authority for position),
--   4. records the employment window a payroll line was computed against, and
--   5. adds the MISSING_VERIFIED_EMPLOYMENT payroll readiness exception.
--
-- Legacy StaffContract rows without a verified employment are NOT given
-- fabricated employment history. They are reported below as a warning and
-- surfaced to operators as a BLOCKING payroll readiness exception until a
-- verified employment is recorded through the maker-checker flow.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Preflight 1: authoritative (verified) employment windows must not overlap.
DO $$
DECLARE
  overlap_count integer;
  sample text;
BEGIN
  WITH pairs AS (
    SELECT a."id" AS a_id, b."id" AS b_id, a."staffId" AS staff_id
    FROM "StaffEmployment" a
    JOIN "StaffEmployment" b
      ON a."staffId" = b."staffId"
     AND a."id" < b."id"
     AND a."verifiedAt" IS NOT NULL AND b."verifiedAt" IS NOT NULL
     AND a."status" IN ('VERIFIED', 'ENDED') AND b."status" IN ('VERIFIED', 'ENDED')
     AND a."effectiveFrom" < COALESCE(b."effectiveTo", 'infinity'::timestamp)
     AND b."effectiveFrom" < COALESCE(a."effectiveTo", 'infinity'::timestamp)
  )
  SELECT count(*),
         string_agg(staff_id || ':' || a_id || '/' || b_id, ', ') FILTER (WHERE rn <= 20)
    INTO overlap_count, sample
  FROM (SELECT *, row_number() OVER (ORDER BY staff_id, a_id, b_id) AS rn FROM pairs) p;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Phase 7 employment preflight: % overlapping verified employment pair(s). First (staff:a/b): %', overlap_count, sample
      USING HINT = 'Employment history is never edited automatically. Resolve with the school (data fix signed off by the owner), then re-run the migration.';
  END IF;
END $$;

-- Preflight 2 (report only): contracts with no matching verified employment.
DO $$
DECLARE
  unmatched integer;
  sample text;
BEGIN
  SELECT count(*), string_agg(c."id", ', ') FILTER (WHERE rn <= 20)
    INTO unmatched, sample
  FROM (
    SELECT c."id", row_number() OVER (ORDER BY c."id") AS rn
    FROM "StaffContract" c
    WHERE c."status" = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM "StaffEmployment" e
        WHERE e."staffId" = c."staffId" AND e."verifiedAt" IS NOT NULL
          AND e."status" IN ('VERIFIED', 'ENDED')
          AND e."effectiveFrom" < COALESCE(c."endDate", 'infinity'::timestamp) + interval '1 day'
          AND c."startDate" < COALESCE(e."effectiveTo", 'infinity'::timestamp)
      )
  ) c;
  IF unmatched > 0 THEN
    RAISE WARNING 'Phase 7 employment preflight: % active contract(s) have no verified employment (payroll readiness will report MISSING_VERIFIED_EMPLOYMENT). First ids: %', unmatched, sample;
  END IF;
END $$;

ALTER TABLE "StaffEmployment"
  ADD CONSTRAINT "StaffEmployment_no_authoritative_overlap"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("verifiedAt" IS NOT NULL AND "status" IN ('VERIFIED', 'ENDED'));

-- ── Responsibilities (positions) inside a verified employment ──────────────
CREATE TYPE "StaffResponsibilityKind" AS ENUM ('PRIMARY', 'SECONDARY');

CREATE TABLE "StaffResponsibility" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "kind" "StaffResponsibilityKind" NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffResponsibility_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffResponsibility_tenantId_staffId_effectiveFrom_idx" ON "StaffResponsibility"("tenantId", "staffId", "effectiveFrom");
CREATE INDEX "StaffResponsibility_employmentId_idx" ON "StaffResponsibility"("employmentId");
CREATE INDEX "StaffResponsibility_createdById_idx" ON "StaffResponsibility"("createdById");

ALTER TABLE "StaffResponsibility" ADD CONSTRAINT "StaffResponsibility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffResponsibility" ADD CONSTRAINT "StaffResponsibility_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffResponsibility" ADD CONSTRAINT "StaffResponsibility_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "StaffEmployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffResponsibility" ADD CONSTRAINT "StaffResponsibility_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffResponsibility"
  -- A zero-length window is only valid as a voided marker: a future-dated
  -- responsibility whose employment ended before it began is closed with
  -- effectiveTo = effectiveFrom (an empty range that can never overlap).
  ADD CONSTRAINT "StaffResponsibility_dates" CHECK (
    "effectiveTo" IS NULL
    OR "effectiveTo" > "effectiveFrom"
    OR ("endedAt" IS NOT NULL AND "effectiveTo" = "effectiveFrom")
  ),
  ADD CONSTRAINT "StaffResponsibility_title" CHECK (NULLIF(btrim("title"), '') IS NOT NULL),
  ADD CONSTRAINT "StaffResponsibility_end_pair" CHECK (
    ("endedAt" IS NULL AND "endReason" IS NULL)
    OR ("endedAt" IS NOT NULL AND "effectiveTo" IS NOT NULL AND NULLIF(btrim("endReason"), '') IS NOT NULL)
  );

-- Exactly one PRIMARY responsibility at any instant per staff member.
-- (A plain unique index cannot express "no overlapping ranges".)
ALTER TABLE "StaffResponsibility"
  ADD CONSTRAINT "StaffResponsibility_one_primary_per_range"
  EXCLUDE USING gist (
    "staffId" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("kind" = 'PRIMARY');

CREATE FUNCTION "guard_staff_responsibility"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  emp "StaffEmployment"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Responsibility history cannot be deleted';
  END IF;
  SELECT * INTO emp FROM "StaffEmployment" WHERE "id" = NEW."employmentId";
  IF NOT FOUND
    OR emp."tenantId" IS DISTINCT FROM NEW."tenantId"
    OR emp."staffId" IS DISTINCT FROM NEW."staffId"
    OR (SELECT "tenantId" FROM "Staff" WHERE "id" = NEW."staffId") IS DISTINCT FROM NEW."tenantId"
    OR (NEW."createdById" IS NOT NULL AND
      (SELECT "tenantId" FROM "User" WHERE "id" = NEW."createdById") IS DISTINCT FROM NEW."tenantId") THEN
    RAISE EXCEPTION 'Responsibility references must match the tenant, staff and employment';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF emp."verifiedAt" IS NULL OR emp."status" <> 'VERIFIED' THEN
      RAISE EXCEPTION 'A responsibility requires a verified, current employment';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - 'effectiveTo' - 'endedAt' - 'endReason')
       IS DISTINCT FROM (to_jsonb(OLD) - 'effectiveTo' - 'endedAt' - 'endReason') THEN
      RAISE EXCEPTION 'Responsibility content is immutable; end it with a reason';
    END IF;
    IF OLD."endedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'An ended responsibility cannot be changed';
    END IF;
    IF NEW."endedAt" IS NULL THEN
      RAISE EXCEPTION 'A responsibility can only be changed by ending it with a reason';
    END IF;
    IF NEW."effectiveTo" IS NOT NULL AND OLD."effectiveTo" IS NOT NULL AND NEW."effectiveTo" > OLD."effectiveTo" THEN
      RAISE EXCEPTION 'Ending cannot extend a responsibility';
    END IF;
  END IF;
  -- Containment is checked when the row is created; later updates can only
  -- shorten or void it, which cannot leave the employment window.
  IF TG_OP = 'INSERT' AND (
    NEW."effectiveFrom" < emp."effectiveFrom"
    OR (emp."effectiveTo" IS NOT NULL AND (NEW."effectiveTo" IS NULL OR NEW."effectiveTo" > emp."effectiveTo"))
  ) THEN
    RAISE EXCEPTION 'Responsibility window must lie inside the employment window';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StaffResponsibility_guard" BEFORE INSERT OR UPDATE OR DELETE ON "StaffResponsibility"
  FOR EACH ROW EXECUTE FUNCTION "guard_staff_responsibility"();

-- Ending/shortening an employment must not leave responsibilities beyond it.
CREATE FUNCTION "guard_staff_employment_responsibilities"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."effectiveTo" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "StaffResponsibility" r
    WHERE r."employmentId" = NEW."id"
      AND (r."effectiveTo" IS NULL OR r."effectiveTo" > NEW."effectiveTo")
      AND NOT (r."endedAt" IS NOT NULL AND r."effectiveTo" = r."effectiveFrom")
  ) THEN
    RAISE EXCEPTION 'End or shorten the employment''s responsibilities before ending the employment';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StaffEmployment_responsibility_window" BEFORE UPDATE OF "effectiveTo" ON "StaffEmployment"
  FOR EACH ROW EXECUTE FUNCTION "guard_staff_employment_responsibilities"();

-- ── Payroll lineage: the employment window each line was computed against ──
ALTER TABLE "PayrollLine"
  ADD COLUMN "employmentId" TEXT,
  ADD COLUMN "employmentFrom" TIMESTAMP(3),
  ADD COLUMN "employmentTo" TIMESTAMP(3);

CREATE INDEX "PayrollLine_employmentId_idx" ON "PayrollLine"("employmentId");
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "StaffEmployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_employment_window" CHECK (
    ("employmentId" IS NULL AND "employmentFrom" IS NULL AND "employmentTo" IS NULL)
    OR ("employmentId" IS NOT NULL AND "employmentFrom" IS NOT NULL
        AND ("employmentTo" IS NULL OR "employmentTo" > "employmentFrom"))
  );

ALTER TYPE "PayrollExceptionCode" ADD VALUE IF NOT EXISTS 'MISSING_VERIFIED_EMPLOYMENT';
