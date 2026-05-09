-- M6 Homework & Timetable hardening guardrails.
-- Enforces homework lifecycle/file ownership and timetable version/slot/substitution integrity.

CREATE OR REPLACE FUNCTION "enforce_homework_assignment_guard"()
RETURNS trigger AS $$
DECLARE
  academic_year_tenant_id text;
  class_tenant_id text;
  section_tenant_id text;
  section_class_id text;
  subject_tenant_id text;
  subject_class_id text;
  staff_tenant_id text;
BEGIN
  SELECT "tenantId" INTO academic_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."academicYearId";
  IF academic_year_tenant_id IS NULL OR academic_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework academic year is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO class_tenant_id FROM "Class" WHERE "id" = NEW."classId";
  IF class_tenant_id IS NULL OR class_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework class is missing or outside tenant';
  END IF;

  IF NEW."sectionId" IS NOT NULL THEN
    SELECT "tenantId", "classId" INTO section_tenant_id, section_class_id FROM "Section" WHERE "id" = NEW."sectionId";
    IF section_tenant_id IS NULL OR section_tenant_id <> NEW."tenantId" OR section_class_id <> NEW."classId" THEN
      RAISE EXCEPTION 'Homework section is missing, outside tenant, or outside class';
    END IF;
  END IF;

  SELECT "tenantId", "classId" INTO subject_tenant_id, subject_class_id FROM "Subject" WHERE "id" = NEW."subjectId";
  IF subject_tenant_id IS NULL OR subject_tenant_id <> NEW."tenantId" OR subject_class_id <> NEW."classId" THEN
    RAISE EXCEPTION 'Homework subject is missing, outside tenant, or outside class';
  END IF;

  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."assignedByStaffId";
  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework assigned staff is missing or outside tenant';
  END IF;

  IF NEW."status" NOT IN ('DRAFT', 'ASSIGNED', 'CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid homework assignment status';
  END IF;

  IF NEW."dueDate" < NEW."assignedDate" THEN
    RAISE EXCEPTION 'Homework due date cannot be before assigned date';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('CLOSED', 'CANCELLED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Closed or cancelled homework cannot transition silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "homework_assignment_guard" ON "HomeworkAssignment";
CREATE TRIGGER "homework_assignment_guard"
BEFORE INSERT OR UPDATE
ON "HomeworkAssignment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_homework_assignment_guard"();

CREATE OR REPLACE FUNCTION "enforce_homework_submission_guard"()
RETURNS trigger AS $$
DECLARE
  homework_tenant_id text;
  homework_class_id text;
  homework_section_id text;
  homework_due_date timestamp;
  homework_status text;
  student_tenant_id text;
  student_class_id text;
  student_section_id text;
BEGIN
  SELECT "tenantId", "classId", "sectionId", "dueDate", "status"::text
    INTO homework_tenant_id, homework_class_id, homework_section_id, homework_due_date, homework_status
  FROM "HomeworkAssignment" WHERE "id" = NEW."homeworkId";

  IF homework_tenant_id IS NULL OR homework_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework submission assignment is missing or outside tenant';
  END IF;

  IF homework_status IN ('CLOSED', 'CANCELLED') AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Cannot create submission for closed or cancelled homework';
  END IF;

  SELECT "tenantId", "classId", "sectionId" INTO student_tenant_id, student_class_id, student_section_id
  FROM "Student" WHERE "id" = NEW."studentId";

  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework submission student is missing or outside tenant';
  END IF;

  IF student_class_id <> homework_class_id THEN
    RAISE EXCEPTION 'Homework submission student does not belong to assignment class';
  END IF;

  IF homework_section_id IS NOT NULL AND student_section_id <> homework_section_id THEN
    RAISE EXCEPTION 'Homework submission student does not belong to assignment section';
  END IF;

  IF NEW."status" NOT IN ('NOT_SUBMITTED', 'SUBMITTED', 'LATE', 'REVIEWED', 'NEEDS_CORRECTION', 'EXCUSED') THEN
    RAISE EXCEPTION 'Invalid homework submission status';
  END IF;

  IF NEW."submittedAt" IS NOT NULL AND NEW."submittedAt" > homework_due_date AND NEW."status" = 'SUBMITTED' THEN
    NEW."status" := 'LATE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "homework_submission_guard" ON "HomeworkSubmission";
CREATE TRIGGER "homework_submission_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "homeworkId", "studentId", "status", "submittedAt"
ON "HomeworkSubmission"
FOR EACH ROW
EXECUTE FUNCTION "enforce_homework_submission_guard"();

CREATE OR REPLACE FUNCTION "enforce_homework_attachment_guard"()
RETURNS trigger AS $$
DECLARE
  submission_tenant_id text;
  assignment_tenant_id text;
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  file_module text;
  file_entity_id text;
BEGIN
  IF NEW."submissionId" IS NOT NULL THEN
    SELECT "tenantId" INTO submission_tenant_id FROM "HomeworkSubmission" WHERE "id" = NEW."submissionId";
    IF submission_tenant_id IS NULL OR submission_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Homework attachment submission is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."assignmentId" IS NOT NULL THEN
    SELECT "tenantId" INTO assignment_tenant_id FROM "HomeworkAssignment" WHERE "id" = NEW."assignmentId";
    IF assignment_tenant_id IS NULL OR assignment_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Homework attachment assignment is missing or outside tenant';
    END IF;
  END IF;

  SELECT "tenantId", "status"::text, "softDeletedAt", "module", "entityId"
    INTO file_tenant_id, file_status, file_soft_deleted_at, file_module, file_entity_id
  FROM "FileAsset" WHERE "id" = NEW."fileAssetId";

  IF file_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset does not exist';
  END IF;

  IF file_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework attachment file asset is outside tenant';
  END IF;

  IF file_status <> 'UPLOADED' THEN
    RAISE EXCEPTION 'Homework attachment file asset is not uploaded';
  END IF;

  IF file_soft_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset is deleted';
  END IF;

  IF file_module IS NOT NULL AND file_module <> 'homework' THEN
    RAISE EXCEPTION 'Homework attachment file asset module is invalid';
  END IF;

  IF file_entity_id IS NOT NULL AND NEW."submissionId" IS NOT NULL AND file_entity_id <> NEW."submissionId" THEN
    RAISE EXCEPTION 'Homework attachment file asset is not linked to this submission';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "homework_attachment_guard" ON "HomeworkAttachment";
CREATE TRIGGER "homework_attachment_guard"
BEFORE INSERT OR UPDATE
ON "HomeworkAttachment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_homework_attachment_guard"();

CREATE OR REPLACE FUNCTION "enforce_timetable_version_guard"()
RETURNS trigger AS $$
DECLARE
  academic_year_tenant_id text;
  class_tenant_id text;
  section_tenant_id text;
  section_class_id text;
BEGIN
  SELECT "tenantId" INTO academic_year_tenant_id FROM "AcademicYear" WHERE "id" = NEW."academicYearId";
  IF academic_year_tenant_id IS NULL OR academic_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Timetable version academic year is missing or outside tenant';
  END IF;

  IF NEW."classId" IS NOT NULL THEN
    SELECT "tenantId" INTO class_tenant_id FROM "Class" WHERE "id" = NEW."classId";
    IF class_tenant_id IS NULL OR class_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Timetable version class is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."sectionId" IS NOT NULL THEN
    SELECT "tenantId", "classId" INTO section_tenant_id, section_class_id FROM "Section" WHERE "id" = NEW."sectionId";
    IF section_tenant_id IS NULL OR section_tenant_id <> NEW."tenantId" OR section_class_id <> NEW."classId" THEN
      RAISE EXCEPTION 'Timetable version section is missing, outside tenant, or outside class';
    END IF;
  END IF;

  IF NEW."effectiveTo" IS NOT NULL AND NEW."effectiveTo" < NEW."effectiveFrom" THEN
    RAISE EXCEPTION 'Timetable version effectiveTo cannot be before effectiveFrom';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('LOCKED', 'ARCHIVED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Locked or archived timetable version cannot transition silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "timetable_version_guard" ON "TimetableVersion";
CREATE TRIGGER "timetable_version_guard"
BEFORE INSERT OR UPDATE
ON "TimetableVersion"
FOR EACH ROW
EXECUTE FUNCTION "enforce_timetable_version_guard"();

CREATE OR REPLACE FUNCTION "enforce_timetable_slot_guard"()
RETURNS trigger AS $$
DECLARE
  version_tenant_id text;
  version_status text;
  subject_tenant_id text;
  subject_class_id text;
  staff_tenant_id text;
  room_tenant_id text;
  conflict_id text;
BEGIN
  SELECT "tenantId", "status"::text INTO version_tenant_id, version_status FROM "TimetableVersion" WHERE "id" = NEW."versionId";
  IF version_tenant_id IS NULL OR version_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Timetable slot version is missing or outside tenant';
  END IF;

  IF version_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft timetable versions can be edited';
  END IF;

  SELECT "tenantId", "classId" INTO subject_tenant_id, subject_class_id FROM "Subject" WHERE "id" = NEW."subjectId";
  IF subject_tenant_id IS NULL OR subject_tenant_id <> NEW."tenantId" OR subject_class_id <> NEW."classId" THEN
    RAISE EXCEPTION 'Timetable slot subject is missing, outside tenant, or outside class';
  END IF;

  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";
  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Timetable slot teacher is missing or outside tenant';
  END IF;

  IF NEW."roomId" IS NOT NULL THEN
    SELECT "tenantId" INTO room_tenant_id FROM "Room" WHERE "id" = NEW."roomId";
    IF room_tenant_id IS NULL OR room_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Timetable slot room is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."endsAt" <= NEW."startsAt" THEN
    RAISE EXCEPTION 'Timetable slot end time must be after start time';
  END IF;

  SELECT "id" INTO conflict_id
  FROM "TimetableSlot"
  WHERE "tenantId" = NEW."tenantId"
    AND "versionId" = NEW."versionId"
    AND "id" <> COALESCE(NEW."id", '')
    AND "dayOfWeek" = NEW."dayOfWeek"
    AND "staffId" = NEW."staffId"
    AND "startsAt" < NEW."endsAt"
    AND "endsAt" > NEW."startsAt"
  LIMIT 1;
  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Teacher is double-booked in timetable slot';
  END IF;

  IF NEW."roomId" IS NOT NULL THEN
    SELECT "id" INTO conflict_id
    FROM "TimetableSlot"
    WHERE "tenantId" = NEW."tenantId"
      AND "versionId" = NEW."versionId"
      AND "id" <> COALESCE(NEW."id", '')
      AND "dayOfWeek" = NEW."dayOfWeek"
      AND "roomId" = NEW."roomId"
      AND "startsAt" < NEW."endsAt"
      AND "endsAt" > NEW."startsAt"
    LIMIT 1;
    IF conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Room is double-booked in timetable slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "timetable_slot_guard" ON "TimetableSlot";
CREATE TRIGGER "timetable_slot_guard"
BEFORE INSERT OR UPDATE
ON "TimetableSlot"
FOR EACH ROW
EXECUTE FUNCTION "enforce_timetable_slot_guard"();

CREATE INDEX IF NOT EXISTS "HomeworkAssignment_tenant_scope_status_idx" ON "HomeworkAssignment" ("tenantId", "academicYearId", "classId", "sectionId", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_tenant_assignment_student_idx" ON "HomeworkSubmission" ("tenantId", "homeworkId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "HomeworkAttachment_tenant_file_idx" ON "HomeworkAttachment" ("tenantId", "fileAssetId");
CREATE INDEX IF NOT EXISTS "TimetableVersion_tenant_scope_status_idx" ON "TimetableVersion" ("tenantId", "academicYearId", "classId", "sectionId", "status");
CREATE INDEX IF NOT EXISTS "TimetableSlot_tenant_version_teacher_time_idx" ON "TimetableSlot" ("tenantId", "versionId", "staffId", "dayOfWeek", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "TimetableSlot_tenant_version_room_time_idx" ON "TimetableSlot" ("tenantId", "versionId", "roomId", "dayOfWeek", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "TimetableSubstitution_tenant_slot_date_idx" ON "TimetableSubstitution" ("tenantId", "timetableSlotId", "date", "status");
