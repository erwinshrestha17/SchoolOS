-- M2 Attendance hardening guardrails.
-- Enforces tenant/session/student integrity for correction requests and offline sync submissions.

CREATE OR REPLACE FUNCTION "enforce_attendance_correction_guard"()
RETURNS trigger AS $$
DECLARE
  session_tenant_id text;
  session_class_id text;
  session_section_id text;
  session_date date;
  record_tenant_id text;
  record_session_id text;
  record_student_id text;
  student_tenant_id text;
BEGIN
  IF NEW."attendanceSessionId" IS NOT NULL THEN
    SELECT "tenantId", "classId", "sectionId", "attendanceDate"
      INTO session_tenant_id, session_class_id, session_section_id, session_date
    FROM "AttendanceSession"
    WHERE "id" = NEW."attendanceSessionId";

    IF session_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Attendance correction session does not exist';
    END IF;

    IF session_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Attendance correction session is outside this tenant';
    END IF;

    IF session_date <> NEW."attendanceDate"::date THEN
      RAISE EXCEPTION 'Attendance correction date does not match session date';
    END IF;
  END IF;

  IF NEW."attendanceRecordId" IS NOT NULL THEN
    SELECT "tenantId", "attendanceSessionId", "studentId"
      INTO record_tenant_id, record_session_id, record_student_id
    FROM "AttendanceRecord"
    WHERE "id" = NEW."attendanceRecordId";

    IF record_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Attendance correction record does not exist';
    END IF;

    IF record_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Attendance correction record is outside this tenant';
    END IF;

    IF record_student_id <> NEW."studentId" THEN
      RAISE EXCEPTION 'Attendance correction record does not belong to this student';
    END IF;

    IF NEW."attendanceSessionId" IS NOT NULL AND record_session_id <> NEW."attendanceSessionId" THEN
      RAISE EXCEPTION 'Attendance correction record does not belong to this session';
    END IF;
  END IF;

  SELECT "tenantId"
    INTO student_tenant_id
  FROM "Student"
  WHERE "id" = NEW."studentId";

  IF student_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Attendance correction student does not exist';
  END IF;

  IF student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Attendance correction student is outside this tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attendance_correction_guard" ON "AttendanceCorrectionRequest";

CREATE TRIGGER "attendance_correction_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "attendanceRecordId", "attendanceSessionId", "studentId", "attendanceDate"
ON "AttendanceCorrectionRequest"
FOR EACH ROW
EXECUTE FUNCTION "enforce_attendance_correction_guard"();

CREATE OR REPLACE FUNCTION "enforce_attendance_sync_submission_guard"()
RETURNS trigger AS $$
DECLARE
  session_tenant_id text;
  conflict_tenant_id text;
  class_tenant_id text;
  section_tenant_id text;
  academic_year_tenant_id text;
BEGIN
  SELECT "tenantId"
    INTO academic_year_tenant_id
  FROM "AcademicYear"
  WHERE "id" = NEW."academicYearId";

  IF academic_year_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Attendance sync academic year does not exist';
  END IF;

  IF academic_year_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Attendance sync academic year is outside this tenant';
  END IF;

  SELECT "tenantId"
    INTO class_tenant_id
  FROM "Class"
  WHERE "id" = NEW."classId";

  IF class_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Attendance sync class does not exist';
  END IF;

  IF class_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Attendance sync class is outside this tenant';
  END IF;

  IF NEW."sectionId" IS NOT NULL THEN
    SELECT "tenantId"
      INTO section_tenant_id
    FROM "Section"
    WHERE "id" = NEW."sectionId";

    IF section_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Attendance sync section does not exist';
    END IF;

    IF section_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Attendance sync section is outside this tenant';
    END IF;
  END IF;

  IF NEW."attendanceSessionId" IS NOT NULL THEN
    SELECT "tenantId"
      INTO session_tenant_id
    FROM "AttendanceSession"
    WHERE "id" = NEW."attendanceSessionId";

    IF session_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Attendance sync session does not exist';
    END IF;

    IF session_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Attendance sync session is outside this tenant';
    END IF;
  END IF;

  IF NEW."conflictId" IS NOT NULL THEN
    SELECT "tenantId"
      INTO conflict_tenant_id
    FROM "AttendanceConflict"
    WHERE "id" = NEW."conflictId";

    IF conflict_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Attendance sync conflict does not exist';
    END IF;

    IF conflict_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Attendance sync conflict is outside this tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attendance_sync_submission_guard" ON "AttendanceSyncSubmission";

CREATE TRIGGER "attendance_sync_submission_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "academicYearId", "classId", "sectionId", "attendanceSessionId", "conflictId"
ON "AttendanceSyncSubmission"
FOR EACH ROW
EXECUTE FUNCTION "enforce_attendance_sync_submission_guard"();

CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_tenant_student_date_status_idx"
ON "AttendanceCorrectionRequest" ("tenantId", "studentId", "attendanceDate", "status");

CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_tenant_session_status_idx"
ON "AttendanceCorrectionRequest" ("tenantId", "attendanceSessionId", "status");

CREATE INDEX IF NOT EXISTS "AttendanceSyncSubmission_tenant_client_idx"
ON "AttendanceSyncSubmission" ("tenantId", "clientSubmissionId");

CREATE INDEX IF NOT EXISTS "AttendanceSyncSubmission_tenant_submitted_date_idx"
ON "AttendanceSyncSubmission" ("tenantId", "submittedById", "attendanceDate");

CREATE INDEX IF NOT EXISTS "AttendanceRecord_tenant_student_session_idx"
ON "AttendanceRecord" ("tenantId", "studentId", "attendanceSessionId");

CREATE INDEX IF NOT EXISTS "AttendanceSession_tenant_class_section_date_idx"
ON "AttendanceSession" ("tenantId", "classId", "sectionId", "attendanceDate");
