-- Phase 6.1 — Timetable conflict integrity at the database layer.
--
-- The earlier unique indexes only rejected slots with an IDENTICAL
-- (startsAt, endsAt) pair, so 08:00–08:45 and 08:30–09:15 for the same
-- teacher, room or class/section could both be saved, and the service-level
-- check-then-insert was racy. These EXCLUDE constraints reject any
-- overlapping half-open interval [startsAt, endsAt) within a version.
--
-- Cross-version clashes (a teacher in two sections' published timetables)
-- cannot be expressed as a row constraint because version status lives in
-- another table; that is enforced at publish time under an advisory lock.
--
-- SAFETY: EXCLUDE constraints cannot be added NOT VALID. This migration
-- therefore refuses to run while invalid times or overlaps exist and lists
-- them. Existing data is never modified or deleted automatically: resolve the
-- reported slots in the timetable builder, then re-run the migration.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION schoolos_hhmm_minutes(value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT split_part(value, ':', 1)::integer * 60 + split_part(value, ':', 2)::integer
$$;

-- Preflight 1: every slot time must be a valid 24h HH:MM and start < end.
DO $$
DECLARE
  invalid_count integer;
  sample text;
BEGIN
  SELECT count(*), string_agg(id, ', ' ORDER BY id) FILTER (WHERE rn <= 20)
    INTO invalid_count, sample
  FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM "TimetableSlot"
    WHERE "startsAt" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR "endsAt" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR "startsAt" >= "endsAt"
  ) bad;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 timetable preflight: % slot(s) have invalid times. First ids: %', invalid_count, sample
      USING HINT = 'Fix startsAt/endsAt to HH:MM with start before end, then re-run the migration.';
  END IF;
END $$;

-- Preflight 2: no overlapping slots within a version for the same teacher,
-- room or class/section.
DO $$
DECLARE
  overlap_count integer;
  sample text;
BEGIN
  WITH pairs AS (
    SELECT a.id AS a_id, b.id AS b_id,
           CASE
             WHEN a."staffId" = b."staffId" THEN 'teacher'
             WHEN a."roomId" IS NOT NULL AND a."roomId" = b."roomId" THEN 'room'
             ELSE 'class/section'
           END AS kind
    FROM "TimetableSlot" a
    JOIN "TimetableSlot" b
      ON a."tenantId" = b."tenantId"
     AND a."versionId" = b."versionId"
     AND a."dayOfWeek" = b."dayOfWeek"
     AND a.id < b.id
     AND schoolos_hhmm_minutes(a."startsAt") < schoolos_hhmm_minutes(b."endsAt")
     AND schoolos_hhmm_minutes(b."startsAt") < schoolos_hhmm_minutes(a."endsAt")
    WHERE a."versionId" IS NOT NULL
      AND (
        a."staffId" = b."staffId"
        OR (a."roomId" IS NOT NULL AND a."roomId" = b."roomId")
        OR (a."classId" = b."classId" AND COALESCE(a."sectionId", '') = COALESCE(b."sectionId", ''))
      )
  )
  SELECT count(*),
         string_agg(kind || ':' || a_id || '/' || b_id, ', ') FILTER (WHERE rn <= 20)
    INTO overlap_count, sample
  FROM (SELECT *, row_number() OVER (ORDER BY a_id, b_id) AS rn FROM pairs) p;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 timetable preflight: % overlapping slot pair(s) within a version. First pairs: %', overlap_count, sample
      USING HINT = 'Resolve the overlaps in the timetable builder (move or delete one slot of each pair), then re-run the migration.';
  END IF;
END $$;

ALTER TABLE "TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_time_range_check"
  CHECK (
    "startsAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "endsAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "startsAt" < "endsAt"
  );

ALTER TABLE "TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_no_teacher_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "versionId" WITH =,
    "staffId" WITH =,
    "dayOfWeek" WITH =,
    int4range(schoolos_hhmm_minutes("startsAt"), schoolos_hhmm_minutes("endsAt"), '[)') WITH &&
  )
  WHERE ("versionId" IS NOT NULL);

ALTER TABLE "TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_no_room_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "versionId" WITH =,
    "roomId" WITH =,
    "dayOfWeek" WITH =,
    int4range(schoolos_hhmm_minutes("startsAt"), schoolos_hhmm_minutes("endsAt"), '[)') WITH &&
  )
  WHERE ("versionId" IS NOT NULL AND "roomId" IS NOT NULL);

ALTER TABLE "TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_no_class_section_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "versionId" WITH =,
    "classId" WITH =,
    (COALESCE("sectionId", '')) WITH =,
    "dayOfWeek" WITH =,
    int4range(schoolos_hhmm_minutes("startsAt"), schoolos_hhmm_minutes("endsAt"), '[)') WITH &&
  )
  WHERE ("versionId" IS NOT NULL);

-- The exact-match unique indexes are strictly weaker than the EXCLUDE
-- constraints above (identical intervals overlap), so they are superseded.
DROP INDEX IF EXISTS "TimetableSlot_unique_version_class_section_day_time";
DROP INDEX IF EXISTS "TimetableSlot_unique_version_teacher_day_time";
DROP INDEX IF EXISTS "TimetableSlot_unique_version_room_day_time";

-- One active (DRAFT/ASSIGNED) substitution per slot and school day. The
-- service check-then-create could otherwise race into two active rows.
DO $$
DECLARE
  dup_count integer;
  sample text;
BEGIN
  SELECT count(*), string_agg("timetableSlotId" || '@' || "date"::date, ', ') FILTER (WHERE rn <= 20)
    INTO dup_count, sample
  FROM (
    SELECT "timetableSlotId", "date", row_number() OVER (ORDER BY "timetableSlotId", "date") AS rn
    FROM "TimetableSubstitution"
    WHERE "status" IN ('DRAFT', 'ASSIGNED')
    GROUP BY "tenantId", "timetableSlotId", "date"
    HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 substitution preflight: % slot/day(s) have more than one active substitution. First: %', dup_count, sample
      USING HINT = 'Cancel the duplicate substitutions, then re-run the migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "TimetableSubstitution_one_active_per_slot_day"
  ON "TimetableSubstitution" ("tenantId", "timetableSlotId", "date")
  WHERE "status" IN ('DRAFT', 'ASSIGNED');
