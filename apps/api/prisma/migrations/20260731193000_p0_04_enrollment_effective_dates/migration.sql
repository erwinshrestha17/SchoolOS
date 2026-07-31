-- P0-04: Effective-dated enrollment membership for mid-term class/section changes.

ALTER TABLE "Enrollment" ADD COLUMN "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN "effectiveUntil" TIMESTAMP(3);

UPDATE "Enrollment"
SET "effectiveFrom" = COALESCE("admissionDate", "createdAt")
WHERE "effectiveFrom" IS NULL;

ALTER TABLE "Enrollment" ALTER COLUMN "effectiveFrom" SET NOT NULL;

DROP INDEX IF EXISTS "Enrollment_tenantId_academicYearId_studentId_key";

CREATE INDEX "Enrollment_tenantId_academicYearId_studentId_status_idx"
  ON "Enrollment"("tenantId", "academicYearId", "studentId", "status");

CREATE INDEX "Enrollment_tenantId_academicYearId_studentId_effectiveFrom_idx"
  ON "Enrollment"("tenantId", "academicYearId", "studentId", "effectiveFrom");

CREATE INDEX "Enrollment_tenantId_classId_sectionId_status_effectiveUntil_idx"
  ON "Enrollment"("tenantId", "classId", "sectionId", "status", "effectiveUntil");
