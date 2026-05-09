-- M4 Academics hardening guardrails.
-- Enforces tenant integrity, locked mark protection, report card publishing safety,
-- and promotion uniqueness at the database boundary.

CREATE OR REPLACE FUNCTION "enforce_mark_entry_guard"()
RETURNS trigger AS $$
DECLARE
  term_tenant_id text;
  term_locked boolean;
  component_tenant_id text;
  component_term_id text;
  component_subject_id text;
  component_max_marks numeric;
  student_tenant_id text;
BEGIN
  SELECT "tenantId", "isLocked"
    INTO term_tenant_id, term_locked
  FROM "ExamTerm"
  WHERE "id" = NEW."examTermId";

  IF term_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Mark entry exam term does not exist';
  END IF;

  IF term_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Mark entry exam term is outside this tenant';
  END IF;

  IF TG_OP = 'UPDATE' AND term_locked AND OLD."isLocked" = true THEN
    RAISE EXCEPTION 'Locked mark entry cannot be edited without unlock workflow';
  END IF;

  SELECT "tenantId", "examTermId", "subjectId", "maxMarks"
    INTO component_tenant_id, component_term_id, component_subject_id, component_max_marks
  FROM "AssessmentComponent"
  WHERE "id" = NEW."assessmentComponentId";

  IF component_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Mark entry assessment component does not exist';
  END IF;

  IF component_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Mark entry assessment component is outside this tenant';
  END IF;

  IF component_term_id <> NEW."examTermId" THEN
    RAISE EXCEPTION 'Mark entry component does not belong to exam term';
  END IF;

  IF component_subject_id <> NEW."subjectId" THEN
    RAISE EXCEPTION 'Mark entry subject does not match assessment component subject';
  END IF;

  SELECT "tenantId"
    INTO student_tenant_id
  FROM "Student"
  WHERE "id" = NEW."studentId";

  IF student_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Mark entry student does not exist';
  END IF;

  IF student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Mark entry student is outside this tenant';
  END IF;

  IF NEW."marksObtained" < 0 THEN
    RAISE EXCEPTION 'Marks cannot be negative';
  END IF;

  IF NEW."marksObtained" > component_max_marks THEN
    RAISE EXCEPTION 'Marks cannot exceed component max marks';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "mark_entry_guard" ON "MarkEntry";

CREATE TRIGGER "mark_entry_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "examTermId", "assessmentComponentId", "subjectId", "studentId", "marksObtained", "isLocked"
ON "MarkEntry"
FOR EACH ROW
EXECUTE FUNCTION "enforce_mark_entry_guard"();

CREATE OR REPLACE FUNCTION "enforce_cas_record_guard"()
RETURNS trigger AS $$
DECLARE
  academic_year_tenant_id text;
  class_tenant_id text;
  section_tenant_id text;
  subject_tenant_id text;
  subject_class_id text;
  student_tenant_id text;
  student_class_id text;
  student_section_id text;
BEGIN
  SELECT "tenantId" INTO academic_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."academicYearId";
  IF academic_year_tenant_id IS NULL OR academic_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'CAS academic year is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO class_tenant_id FROM "Class" WHERE "id" = NEW."classId";
  IF class_tenant_id IS NULL OR class_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'CAS class is missing or outside tenant';
  END IF;

  IF NEW."sectionId" IS NOT NULL THEN
    SELECT "tenantId" INTO section_tenant_id FROM "Section" WHERE "id" = NEW."sectionId";
    IF section_tenant_id IS NULL OR section_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'CAS section is missing or outside tenant';
    END IF;
  END IF;

  SELECT "tenantId", "classId" INTO subject_tenant_id, subject_class_id FROM "Subject" WHERE "id" = NEW."subjectId";
  IF subject_tenant_id IS NULL OR subject_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'CAS subject is missing or outside tenant';
  END IF;
  IF subject_class_id <> NEW."classId" THEN
    RAISE EXCEPTION 'CAS subject does not belong to class';
  END IF;

  SELECT "tenantId", "classId", "sectionId" INTO student_tenant_id, student_class_id, student_section_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'CAS student is missing or outside tenant';
  END IF;
  IF student_class_id <> NEW."classId" THEN
    RAISE EXCEPTION 'CAS student does not belong to class';
  END IF;
  IF NEW."sectionId" IS NOT NULL AND student_section_id <> NEW."sectionId" THEN
    RAISE EXCEPTION 'CAS student does not belong to section';
  END IF;

  IF NEW."score" < 0 OR NEW."maxScore" <= 0 OR NEW."score" > NEW."maxScore" THEN
    RAISE EXCEPTION 'CAS score must be between 0 and maxScore';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "cas_record_guard" ON "CasRecord";

CREATE TRIGGER "cas_record_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "academicYearId", "classId", "sectionId", "subjectId", "studentId", "score", "maxScore"
ON "CasRecord"
FOR EACH ROW
EXECUTE FUNCTION "enforce_cas_record_guard"();

CREATE OR REPLACE FUNCTION "enforce_mark_lock_request_guard"()
RETURNS trigger AS $$
DECLARE
  term_tenant_id text;
BEGIN
  SELECT "tenantId" INTO term_tenant_id FROM "ExamTerm" WHERE "id" = NEW."examTermId";

  IF term_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Mark lock exam term does not exist';
  END IF;

  IF term_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Mark lock exam term is outside tenant';
  END IF;

  IF COALESCE(TRIM(NEW."reason"), '') = '' THEN
    RAISE EXCEPTION 'Mark lock reason is required';
  END IF;

  IF NEW."status" IN ('APPROVED', 'REJECTED', 'UNLOCKED') AND NEW."reviewedById" IS NULL THEN
    RAISE EXCEPTION 'Reviewed mark lock transition requires reviewedById';
  END IF;

  IF NEW."status" IN ('APPROVED', 'REJECTED', 'UNLOCKED') AND NEW."reviewedAt" IS NULL THEN
    RAISE EXCEPTION 'Reviewed mark lock transition requires reviewedAt';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "mark_lock_request_guard" ON "MarkLockRequest";

CREATE TRIGGER "mark_lock_request_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "examTermId", "reason", "status", "reviewedById", "reviewedAt"
ON "MarkLockRequest"
FOR EACH ROW
EXECUTE FUNCTION "enforce_mark_lock_request_guard"();

CREATE OR REPLACE FUNCTION "enforce_report_card_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  term_tenant_id text;
  academic_year_tenant_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Report card student is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO term_tenant_id FROM "ExamTerm" WHERE "id" = NEW."examTermId";
  IF term_tenant_id IS NULL OR term_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Report card exam term is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO academic_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."academicYearId";
  IF academic_year_tenant_id IS NULL OR academic_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Report card academic year is missing or outside tenant';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'Published report card publish timestamp cannot be silently edited';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "report_card_guard" ON "ReportCard";

CREATE TRIGGER "report_card_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "studentId", "academicYearId", "examTermId", "publishedAt"
ON "ReportCard"
FOR EACH ROW
EXECUTE FUNCTION "enforce_report_card_guard"();

CREATE OR REPLACE FUNCTION "enforce_promotion_record_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  from_year_tenant_id text;
  to_year_tenant_id text;
  from_class_tenant_id text;
  to_class_tenant_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Promotion student is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO from_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."fromAcademicYearId";
  SELECT "tenantId" INTO to_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."toAcademicYearId";
  IF from_year_tenant_id IS NULL OR from_year_tenant_id <> NEW."tenantId" OR to_year_tenant_id IS NULL OR to_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Promotion academic years must belong to tenant';
  END IF;

  SELECT "tenantId" INTO from_class_tenant_id FROM "Class" WHERE "id" = NEW."fromClassId";
  SELECT "tenantId" INTO to_class_tenant_id FROM "Class" WHERE "id" = NEW."toClassId";
  IF from_class_tenant_id IS NULL OR from_class_tenant_id <> NEW."tenantId" OR to_class_tenant_id IS NULL OR to_class_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Promotion classes must belong to tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "promotion_record_guard" ON "PromotionRecord";

CREATE TRIGGER "promotion_record_guard"
BEFORE INSERT OR UPDATE
ON "PromotionRecord"
FOR EACH ROW
EXECUTE FUNCTION "enforce_promotion_record_guard"();

CREATE INDEX IF NOT EXISTS "MarkEntry_tenant_term_component_student_idx"
ON "MarkEntry" ("tenantId", "examTermId", "assessmentComponentId", "studentId");

CREATE INDEX IF NOT EXISTS "MarkEntry_tenant_subject_student_idx"
ON "MarkEntry" ("tenantId", "subjectId", "studentId");

CREATE INDEX IF NOT EXISTS "CasRecord_tenant_year_class_section_subject_idx"
ON "CasRecord" ("tenantId", "academicYearId", "classId", "sectionId", "subjectId");

CREATE INDEX IF NOT EXISTS "CasRecord_tenant_student_subject_idx"
ON "CasRecord" ("tenantId", "studentId", "subjectId");

CREATE INDEX IF NOT EXISTS "MarkLockRequest_tenant_term_status_idx"
ON "MarkLockRequest" ("tenantId", "examTermId", "status");

CREATE INDEX IF NOT EXISTS "ReportCard_tenant_student_term_idx"
ON "ReportCard" ("tenantId", "studentId", "examTermId");

CREATE INDEX IF NOT EXISTS "ReportCard_tenant_published_idx"
ON "ReportCard" ("tenantId", "publishedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRecord_tenant_student_from_to_uidx"
ON "PromotionRecord" ("tenantId", "studentId", "fromAcademicYearId", "toAcademicYearId");
