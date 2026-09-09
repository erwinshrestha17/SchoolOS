-- Ordinary PostgreSQL unique indexes treat NULL values as distinct. Both
-- teacher-assignment tables contain nullable scope members, so identical
-- class-wide or all-component assignments could be inserted concurrently.
-- Fail closed if historical duplicates exist; do not guess which authority
-- row should survive or destructively rewrite assignment history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TeacherAssignment"
    GROUP BY
      "tenantId",
      "academicYearId",
      "staffId",
      "assignmentType",
      "classId",
      "sectionId",
      "subjectId",
      "componentScope"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce canonical teacher-assignment uniqueness: duplicate scopes exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectTeacherAssignment"
    GROUP BY
      "tenantId",
      "academicYearId",
      "subjectId",
      "staffId",
      "classId",
      "sectionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce legacy subject-teacher uniqueness: duplicate scopes exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "TeacherAssignment_scope_nnd_key"
  ON "TeacherAssignment"(
    "tenantId",
    "academicYearId",
    "staffId",
    "assignmentType",
    "classId",
    "sectionId",
    "subjectId",
    "componentScope"
  ) NULLS NOT DISTINCT;
DROP INDEX "TeacherAssignment_tenantId_academicYearId_staffId_assignmen_key";
ALTER INDEX "TeacherAssignment_scope_nnd_key"
  RENAME TO "TeacherAssignment_tenantId_academicYearId_staffId_assignmen_key";

CREATE UNIQUE INDEX "SubjectTeacherAssignment_scope_nnd_key"
  ON "SubjectTeacherAssignment"(
    "tenantId",
    "academicYearId",
    "subjectId",
    "staffId",
    "classId",
    "sectionId"
  ) NULLS NOT DISTINCT;
DROP INDEX "SubjectTeacherAssignment_tenantId_academicYearId_subjectId__key";
ALTER INDEX "SubjectTeacherAssignment_scope_nnd_key"
  RENAME TO "SubjectTeacherAssignment_tenantId_academicYearId_subjectId__key";
