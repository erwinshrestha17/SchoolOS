-- PostgreSQL treats NULL values as distinct in ordinary unique indexes. An
-- unsectioned class therefore needs NULLS NOT DISTINCT so concurrent offline
-- submissions and server drafts cannot create duplicate class/date scopes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AttendanceSession"
    GROUP BY "tenantId", "attendanceDate", "classId", "sectionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce attendance session scope uniqueness: duplicate class/date scopes exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "AttendanceDraft"
    GROUP BY "tenantId", "userId", "classId", "sectionId", "attendanceDate"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce attendance draft scope uniqueness: duplicate user/class/date scopes exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "AttendanceSession_scope_nnd_key"
  ON "AttendanceSession"("tenantId", "attendanceDate", "classId", "sectionId")
  NULLS NOT DISTINCT;
DROP INDEX "AttendanceSession_tenantId_attendanceDate_classId_sectionId_key";
ALTER INDEX "AttendanceSession_scope_nnd_key"
  RENAME TO "AttendanceSession_tenantId_attendanceDate_classId_sectionId_key";

CREATE UNIQUE INDEX "AttendanceDraft_scope_nnd_key"
  ON "AttendanceDraft"("tenantId", "userId", "classId", "sectionId", "attendanceDate")
  NULLS NOT DISTINCT;
DROP INDEX "AttendanceDraft_tenantId_userId_classId_sectionId_attendanc_key";
ALTER INDEX "AttendanceDraft_scope_nnd_key"
  RENAME TO "AttendanceDraft_tenantId_userId_classId_sectionId_attendanc_key";
