-- Phase 2B.2 Homework and Timetable hardening
-- This migration adds description/studentRemarks fields and the SubjectWeeklyRequirement table.
-- It is intentionally guarded because some local/dev baselines may already contain
-- parts of this schema from earlier stabilization work.

-- AlterEnum
ALTER TYPE "AudienceType" ADD VALUE IF NOT EXISTS 'STUDENT';

-- AlterTable
ALTER TABLE "HomeworkAssignment" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "HomeworkAssignment" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HomeworkSubmission" ADD COLUMN IF NOT EXISTS "studentRemarks" TEXT;

-- AlterTable
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "failedReason" TEXT;
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "reminderType" TEXT NOT NULL DEFAULT 'HOMEWORK_DUE_SOON';
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkReminderBatch_tenantId_idempotencyKey_key" ON "HomeworkReminderBatch"("tenantId", "idempotencyKey");

-- CreateTable
CREATE TABLE IF NOT EXISTS "SubjectWeeklyRequirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "requiredPeriodsPerWeek" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectWeeklyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectionId_idx" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubjectWeeklyRequirement_tenantId_subjectId_idx" ON "SubjectWeeklyRequirement"("tenantId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectionId_subjectId_key" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId", "subjectId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectWeeklyRequirement_tenantId_fkey'
  ) THEN
    ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectWeeklyRequirement_academicYearId_fkey'
  ) THEN
    ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectWeeklyRequirement_classId_fkey'
  ) THEN
    ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectWeeklyRequirement_sectionId_fkey'
  ) THEN
    ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubjectWeeklyRequirement_subjectId_fkey'
  ) THEN
    ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
