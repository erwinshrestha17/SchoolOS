-- Phase 2B.2 Homework and Timetable hardening
-- This migration adds description/studentRemarks fields and the SubjectWeeklyRequirement table.

-- AlterEnum
ALTER TYPE "AudienceType" ADD VALUE 'STUDENT';

-- AlterTable
ALTER TABLE "HomeworkAssignment" ADD COLUMN "description" TEXT,
ADD COLUMN "dueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HomeworkSubmission" ADD COLUMN "studentRemarks" TEXT;

-- AlterTable
ALTER TABLE "HomeworkReminderBatch" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "failedReason" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "reminderType" TEXT NOT NULL DEFAULT 'HOMEWORK_DUE_SOON',
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkReminderBatch_tenantId_idempotencyKey_key" ON "HomeworkReminderBatch"("tenantId", "idempotencyKey");

-- CreateTable
CREATE TABLE "SubjectWeeklyRequirement" (
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
CREATE INDEX "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectionId_idx" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "SubjectWeeklyRequirement_tenantId_subjectId_idx" ON "SubjectWeeklyRequirement"("tenantId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectionId_subjectId_key" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId", "subjectId");

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeeklyRequirement" ADD CONSTRAINT "SubjectWeeklyRequirement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
