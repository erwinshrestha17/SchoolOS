-- Phase 6.3 — Marks lifecycle (MarkSheet) and mark integrity.
--
-- * Absent/excused/withheld/missing marks are NULL, never a numeric zero.
-- * Marks cannot exceed the component maximum; the maximum cannot change once
--   a sheet has left entry (SUBMITTED or later).
-- * Sheet lifecycle DRAFT -> SUBMITTED -> RETURNED -> RESUBMITTED -> REVIEWED
--   -> LOCKED with separation of duties and idempotent, audited transitions.
-- Existing data is never guessed at: invalid marks stop the migration with a
-- report instead of being rewritten.

-- Preflight: refuse to continue while existing marks are out of range.
DO $$
DECLARE
  bad_count integer;
  sample text;
BEGIN
  SELECT count(*), string_agg(m.id, ', ') FILTER (WHERE rn <= 20)
    INTO bad_count, sample
  FROM (
    SELECT m.id, row_number() OVER (ORDER BY m.id) AS rn
    FROM "MarkEntry" m
    JOIN "AssessmentComponent" c
      ON c.id = m."assessmentComponentId" AND c."tenantId" = m."tenantId"
    WHERE m."marksObtained" < 0 OR m."marksObtained" > c."maxMarks"
  ) m;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 marks preflight: % mark(s) are negative or above the component maximum. First ids: %', bad_count, sample
      USING HINT = 'Correct these marks (or the component maximum) through the academics correction workflow, then re-run the migration.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "MarkSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'RESUBMITTED', 'REVIEWED', 'LOCKED');

-- CreateEnum
CREATE TYPE "MarkSheetAction" AS ENUM ('SUBMIT', 'RETURN', 'RESUBMIT', 'REVIEW', 'LOCK', 'UNLOCK');

-- AlterTable
ALTER TABLE "AssessmentRetake" ALTER COLUMN "originalMarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MarkEntry" ALTER COLUMN "marksObtained" DROP NOT NULL;

-- Backfill: non-numeric outcomes carry no number. Their stored zero was a
-- placeholder, not a mark; the status is unchanged.
UPDATE "MarkEntry"
   SET "marksObtained" = NULL
 WHERE "status" IN ('ABSENT', 'EXCUSED', 'WITHHELD', 'MISSING');

UPDATE "AssessmentRetake"
   SET "originalMarks" = NULL
 WHERE "originalStatus" IN ('ABSENT', 'EXCUSED', 'WITHHELD', 'MISSING');

ALTER TABLE "MarkEntry"
  ADD CONSTRAINT "MarkEntry_marks_match_status_check" CHECK (
    ("status" IN ('ABSENT', 'EXCUSED', 'WITHHELD', 'MISSING') AND "marksObtained" IS NULL)
    OR ("status" IN ('PRESENT', 'SUBMITTED') AND "marksObtained" IS NOT NULL)
    OR "status" IN ('DRAFT', 'RETEST')
  );

ALTER TABLE "MarkEntry"
  ADD CONSTRAINT "MarkEntry_marks_non_negative_check"
  CHECK ("marksObtained" IS NULL OR "marksObtained" >= 0);

-- CreateTable
CREATE TABLE "MarkSheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "assessmentComponentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "status" "MarkSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkSheetTransition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "markSheetId" TEXT NOT NULL,
    "action" "MarkSheetAction" NOT NULL,
    "fromStatus" "MarkSheetStatus" NOT NULL,
    "toStatus" "MarkSheetStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "sheetVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarkSheetTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarkSheet_tenantId_examTermId_status_idx" ON "MarkSheet"("tenantId", "examTermId", "status");

-- CreateIndex
CREATE INDEX "MarkSheet_tenantId_classId_sectionId_idx" ON "MarkSheet"("tenantId", "classId", "sectionId");

-- CreateIndex (NULLS NOT DISTINCT: exactly one class-wide sheet per component)
CREATE UNIQUE INDEX "MarkSheet_tenantId_assessmentComponentId_sectionId_key" ON "MarkSheet"("tenantId", "assessmentComponentId", "sectionId") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "MarkSheetTransition_tenantId_markSheetId_createdAt_idx" ON "MarkSheetTransition"("tenantId", "markSheetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarkSheetTransition_tenantId_markSheetId_idempotencyKey_key" ON "MarkSheetTransition"("tenantId", "markSheetId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_assessmentComponentId_fkey" FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheet" ADD CONSTRAINT "MarkSheet_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetTransition" ADD CONSTRAINT "MarkSheetTransition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetTransition" ADD CONSTRAINT "MarkSheetTransition_markSheetId_fkey" FOREIGN KEY ("markSheetId") REFERENCES "MarkSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetTransition" ADD CONSTRAINT "MarkSheetTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lifecycle field consistency and separation of duties.
ALTER TABLE "MarkSheet"
  ADD CONSTRAINT "MarkSheet_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "MarkSheet_returned_has_reason_check" CHECK (
    "status" <> 'RETURNED'
    OR ("returnReason" IS NOT NULL AND length(btrim("returnReason")) > 0 AND "returnedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MarkSheet_submitted_has_submitter_check" CHECK (
    "status" NOT IN ('SUBMITTED', 'RESUBMITTED', 'REVIEWED')
    OR ("submittedById" IS NOT NULL AND "submittedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MarkSheet_reviewed_has_reviewer_check" CHECK (
    "status" <> 'REVIEWED' OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "MarkSheet_locked_has_time_check" CHECK (
    "status" <> 'LOCKED' OR "lockedAt" IS NOT NULL
  ),
  ADD CONSTRAINT "MarkSheet_reviewer_not_submitter_check" CHECK (
    "reviewedById" IS NULL OR "submittedById" IS NULL OR "reviewedById" <> "submittedById"
  ),
  ADD CONSTRAINT "MarkSheet_locker_not_submitter_check" CHECK (
    "lockedById" IS NULL OR "submittedById" IS NULL OR "lockedById" <> "submittedById"
  );

ALTER TABLE "MarkSheetTransition"
  ADD CONSTRAINT "MarkSheetTransition_idempotency_key_check"
  CHECK (length(btrim("idempotencyKey")) BETWEEN 8 AND 128);

-- A sheet's term/component/subject/class/section must be one coherent,
-- same-tenant scope.
CREATE OR REPLACE FUNCTION schoolos_mark_sheet_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "AssessmentComponent" c
    JOIN "Subject" s ON s.id = c."subjectId" AND s."tenantId" = c."tenantId"
    WHERE c.id = NEW."assessmentComponentId"
      AND c."tenantId" = NEW."tenantId"
      AND c."examTermId" = NEW."examTermId"
      AND c."subjectId" = NEW."subjectId"
      AND s."classId" = NEW."classId"
  ) THEN
    RAISE EXCEPTION 'MarkSheet scope mismatch for component %', NEW."assessmentComponentId"
      USING ERRCODE = '23514';
  END IF;
  IF NEW."sectionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Section" sec
    WHERE sec.id = NEW."sectionId"
      AND sec."tenantId" = NEW."tenantId"
      AND sec."classId" = NEW."classId"
  ) THEN
    RAISE EXCEPTION 'MarkSheet section % is not in class %', NEW."sectionId", NEW."classId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "MarkSheet_scope_guard"
  BEFORE INSERT OR UPDATE OF "tenantId", "examTermId", "assessmentComponentId", "subjectId", "classId", "sectionId"
  ON "MarkSheet"
  FOR EACH ROW EXECUTE FUNCTION schoolos_mark_sheet_scope_guard();

-- Marks never exceed the component maximum.
CREATE OR REPLACE FUNCTION schoolos_mark_entry_max_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  component_max numeric;
BEGIN
  IF NEW."marksObtained" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT c."maxMarks" INTO component_max
  FROM "AssessmentComponent" c
  WHERE c.id = NEW."assessmentComponentId" AND c."tenantId" = NEW."tenantId";
  IF component_max IS NULL OR NEW."marksObtained" > component_max THEN
    RAISE EXCEPTION 'MarkEntry_marks_exceed_max: % > %', NEW."marksObtained", component_max
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "MarkEntry_max_guard"
  BEFORE INSERT OR UPDATE OF "marksObtained", "assessmentComponentId"
  ON "MarkEntry"
  FOR EACH ROW EXECUTE FUNCTION schoolos_mark_entry_max_guard();

-- The maximum cannot drop below entered marks, and cannot change at all once
-- any sheet for the component has left entry.
CREATE OR REPLACE FUNCTION schoolos_component_max_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."maxMarks" IS DISTINCT FROM OLD."maxMarks" THEN
    IF EXISTS (
      SELECT 1 FROM "MarkSheet" ms
      WHERE ms."assessmentComponentId" = NEW.id
        AND ms."tenantId" = NEW."tenantId"
        AND ms."status" NOT IN ('DRAFT', 'RETURNED')
    ) THEN
      RAISE EXCEPTION 'AssessmentComponent_max_marks_frozen: marks for this component are already submitted'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "MarkEntry" m
      WHERE m."assessmentComponentId" = NEW.id
        AND m."tenantId" = NEW."tenantId"
        AND m."marksObtained" > NEW."maxMarks"
    ) THEN
      RAISE EXCEPTION 'AssessmentComponent_max_below_entered_marks'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "AssessmentComponent_max_guard"
  BEFORE UPDATE OF "maxMarks"
  ON "AssessmentComponent"
  FOR EACH ROW EXECUTE FUNCTION schoolos_component_max_guard();

-- Backfill one sheet per component/section that already has marks. Terms
-- already frozen by the existing term-lock workflow start LOCKED; everything
-- else starts as an editable DRAFT. No submit/review history is invented.
INSERT INTO "MarkSheet" (
  "id", "tenantId", "examTermId", "assessmentComponentId", "subjectId",
  "classId", "sectionId", "status", "lockedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  scope."tenantId",
  scope."examTermId",
  scope."assessmentComponentId",
  scope."subjectId",
  scope."classId",
  scope."sectionId",
  CASE WHEN t."isLocked" THEN 'LOCKED'::"MarkSheetStatus" ELSE 'DRAFT'::"MarkSheetStatus" END,
  CASE WHEN t."isLocked" THEN t."updatedAt" ELSE NULL END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    m."tenantId",
    m."examTermId",
    m."assessmentComponentId",
    m."subjectId",
    subj."classId",
    CASE WHEN sec.id IS NOT NULL THEN st."sectionId" ELSE NULL END AS "sectionId"
  FROM "MarkEntry" m
  JOIN "Student" st ON st.id = m."studentId" AND st."tenantId" = m."tenantId"
  JOIN "Subject" subj ON subj.id = m."subjectId" AND subj."tenantId" = m."tenantId"
  LEFT JOIN "Section" sec
    ON sec.id = st."sectionId" AND sec."tenantId" = m."tenantId" AND sec."classId" = subj."classId"
) scope
JOIN "ExamTerm" t ON t.id = scope."examTermId" AND t."tenantId" = scope."tenantId"
ON CONFLICT DO NOTHING;
