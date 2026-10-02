-- Phase 7.6 — Leave integrity and durable academic coverage.
--
--   1. StaffLeaveRequest.dayPart (D5): FULL_DAY or one half of a single day.
--   2. CHECKs: endsOn >= startsOn; days > 0; a half-day request covers one
--      calendar day and counts 0.5 days.
--   3. EXCLUDE: a staff member never has two PENDING/APPROVED requests whose
--      day (or half-day) intervals overlap. Every create path already refused
--      this in application code, outside any transaction.
--   4. TimetableSubstitution.leaveRequestId: cover created for an approved
--      leave is linked to it (written in the approval transaction, cancelled
--      with the leave). Existing drafts whose reason names their leave request
--      are linked when the leave and absent teacher match. (One open
--      substitution per slot and day is already enforced by Phase 6's
--      TimetableSubstitution_one_active_per_slot_day.)
--
-- Preflights FAIL (never edit or fabricate rows).

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  v_count integer;
  v_ids text;
BEGIN
  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "StaffLeaveRequest"
    WHERE "endsOn" < "startsOn" OR "days" <= 0
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.6 preflight: % StaffLeaveRequest row(s) end before they start or have no days (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg(pair, '; ' ORDER BY pair)
    INTO v_count, v_ids
  FROM (
    SELECT a."id" || ' & ' || b."id" AS pair
    FROM "StaffLeaveRequest" a
    JOIN "StaffLeaveRequest" b
      ON a."tenantId" = b."tenantId"
     AND a."staffId" = b."staffId"
     AND a."id" < b."id"
    WHERE a."status" IN ('PENDING', 'APPROVED')
      AND b."status" IN ('PENDING', 'APPROVED')
      AND date_trunc('day', a."startsOn") <= date_trunc('day', b."endsOn")
      AND date_trunc('day', b."startsOn") <= date_trunc('day', a."endsOn")
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.6 preflight: % pair(s) of pending/approved leave requests overlap for the same staff member (first pairs: %). Cancel or reject one of each pair before migrating.', v_count, v_ids;
  END IF;

END $$;

-- CreateEnum
CREATE TYPE "LeaveDayPart" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- AlterTable
ALTER TABLE "StaffLeaveRequest" ADD COLUMN "dayPart" "LeaveDayPart" NOT NULL DEFAULT 'FULL_DAY';

ALTER TABLE "StaffLeaveRequest"
  ADD CONSTRAINT "StaffLeaveRequest_dates_ordered" CHECK ("endsOn" >= "startsOn"),
  ADD CONSTRAINT "StaffLeaveRequest_days_positive" CHECK ("days" > 0),
  ADD CONSTRAINT "StaffLeaveRequest_half_day_single_day" CHECK (
    "dayPart" = 'FULL_DAY'
    OR (date_trunc('day', "startsOn") = date_trunc('day', "endsOn") AND "days" = 0.5)
  );

-- Half-open interval on the school calendar: a full day is [day, day + 1),
-- the first half [day, day + 12h), the second half [day + 12h, day + 1).
ALTER TABLE "StaffLeaveRequest"
  ADD CONSTRAINT "StaffLeaveRequest_no_active_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "staffId" WITH =,
    tsrange(
      date_trunc('day', "startsOn")
        + CASE WHEN "dayPart" = 'SECOND_HALF' THEN interval '12 hours' ELSE interval '0 hours' END,
      date_trunc('day', "endsOn")
        + CASE WHEN "dayPart" = 'FIRST_HALF' THEN interval '12 hours' ELSE interval '1 day' END,
      '[)'
    ) WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED'));

-- AlterTable
ALTER TABLE "TimetableSubstitution" ADD COLUMN "leaveRequestId" TEXT;

-- Link existing leave-created drafts to their leave (evidence: the reason
-- written by the former post-commit handler, same tenant and teacher).
UPDATE "TimetableSubstitution" s
SET "leaveRequestId" = l."id"
FROM "StaffLeaveRequest" l
WHERE s."leaveRequestId" IS NULL
  AND s."reason" = 'Approved leave request ' || l."id"
  AND l."tenantId" = s."tenantId"
  AND l."staffId" = s."absentTeacherId";

-- CreateIndex
CREATE INDEX "TimetableSubstitution_tenantId_leaveRequestId_idx" ON "TimetableSubstitution"("tenantId", "leaveRequestId");

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
