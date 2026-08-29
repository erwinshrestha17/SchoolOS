-- P0-5: every student may have at most one authoritative ACTIVE enrollment.
-- Preserve existing history and fail closed so duplicate rows are reviewed
-- rather than silently rewritten by the migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Enrollment"
    WHERE "status" = 'ACTIVE'
    GROUP BY "tenantId", "studentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one active enrollment per student: duplicate active enrollment rows exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "Enrollment_one_active_per_student_key"
  ON "Enrollment"("tenantId", "studentId")
  WHERE "status" = 'ACTIVE';
