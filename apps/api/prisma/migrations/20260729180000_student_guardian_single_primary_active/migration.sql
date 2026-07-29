-- P1-05: at most one ACTIVE primary guardian per student within a tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGuardian_one_primary_active_per_student_key"
  ON "StudentGuardian"("tenantId", "studentId")
  WHERE "isPrimary" = true AND "status" = 'ACTIVE';
