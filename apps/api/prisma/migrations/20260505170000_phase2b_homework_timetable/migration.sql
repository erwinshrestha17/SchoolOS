-- CreateEnum
CREATE TYPE "HomeworkAssignmentStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'LATE', 'REVIEWED', 'NEEDS_CORRECTION', 'EXCUSED');

-- CreateEnum
CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeacherAvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TimetableSubstitutionStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'CANCELLED', 'COMPLETED');

-- Homework lifecycle
ALTER TABLE "HomeworkAssignment"
  ADD COLUMN "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "status" "HomeworkAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN "attachmentMetadata" JSONB;

UPDATE "HomeworkAssignment" SET "dueDate" = "dueAt" WHERE "dueDate" IS NULL;

ALTER TABLE "HomeworkAssignment"
  ALTER COLUMN "dueDate" SET NOT NULL;

ALTER TABLE "HomeworkSubmission"
  ADD COLUMN "newStatus" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "submissionText" TEXT,
  ADD COLUMN "teacherRemarks" TEXT,
  ADD COLUMN "correctionRemarks" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "attachmentMetadata" JSONB;

UPDATE "HomeworkSubmission"
SET
  "newStatus" = CASE
    WHEN "status"::TEXT = 'SUBMITTED' THEN 'SUBMITTED'::"HomeworkSubmissionStatus"
    WHEN "status"::TEXT = 'REVIEWED' THEN 'REVIEWED'::"HomeworkSubmissionStatus"
    WHEN "status"::TEXT = 'LATE' THEN 'LATE'::"HomeworkSubmissionStatus"
    ELSE 'NOT_SUBMITTED'::"HomeworkSubmissionStatus"
  END,
  "submissionText" = "submissionContent",
  "teacherRemarks" = "feedback";

ALTER TABLE "HomeworkSubmission" DROP COLUMN "status";
ALTER TABLE "HomeworkSubmission" RENAME COLUMN "newStatus" TO "status";
DROP TYPE "HomeworkStatus";

-- Timetable setup/versioning
CREATE TABLE "TimetablePeriod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dayOfWeek" INTEGER,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetablePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "capacity" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT,
  "sectionId" TEXT,
  "versionName" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" "TimetableVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "lockedAt" TIMESTAMP(3),
  "lockedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimetableSlot"
  ADD COLUMN "versionId" TEXT,
  ADD COLUMN "periodId" TEXT,
  ADD COLUMN "roomId" TEXT;

CREATE TABLE "TeacherAvailability" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "staffId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "type" "TeacherAvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherWorkloadLimit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "staffId" TEXT NOT NULL,
  "maxPeriodsPerDay" INTEGER,
  "maxPeriodsPerWeek" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherWorkloadLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableSubstitution" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "timetableSlotId" TEXT NOT NULL,
  "absentTeacherId" TEXT NOT NULL,
  "substituteTeacherId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "TimetableSubstitutionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "assignedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableSubstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeworkReminderBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "homeworkId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "deliveryCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "dueSoonCount" INTEGER NOT NULL DEFAULT 0,
  "overdueCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeworkReminderBatch_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy rooms and versions.
INSERT INTO "Room" ("id", "tenantId", "name", "code", "createdAt", "updatedAt")
SELECT lower(concat(substr(md5(random()::text || clock_timestamp()::text), 1, 8), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 12))), "tenantId", trim("room"), trim("room"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenantId", "room"
  FROM "TimetableSlot"
  WHERE "room" IS NOT NULL AND trim("room") <> ''
) rooms
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "TimetableSlot" slot
SET "roomId" = room."id"
FROM "Room" room
WHERE slot."tenantId" = room."tenantId"
  AND slot."room" IS NOT NULL
  AND trim(slot."room") = room."name";

INSERT INTO "TimetableVersion" (
  "id", "tenantId", "academicYearId", "classId", "sectionId", "versionName",
  "effectiveFrom", "status", "publishedAt", "createdAt", "updatedAt"
)
SELECT
  lower(concat(substr(md5(random()::text || clock_timestamp()::text), 1, 8), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 4), '-', substr(md5(random()::text || clock_timestamp()::text), 1, 12))),
  slot."tenantId",
  slot."academicYearId",
  slot."classId",
  slot."sectionId",
  'Legacy timetable',
  COALESCE(year."startsOn", CURRENT_TIMESTAMP),
  'PUBLISHED'::"TimetableVersionStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TimetableSlot" slot
LEFT JOIN "AcademicYear" year ON year."id" = slot."academicYearId"
GROUP BY slot."tenantId", slot."academicYearId", slot."classId", slot."sectionId", year."startsOn";

UPDATE "TimetableSlot" slot
SET "versionId" = version."id"
FROM "TimetableVersion" version
WHERE slot."tenantId" = version."tenantId"
  AND slot."academicYearId" = version."academicYearId"
  AND slot."classId" = version."classId"
  AND COALESCE(slot."sectionId", '') = COALESCE(version."sectionId", '')
  AND version."versionName" = 'Legacy timetable';

-- Indexes
CREATE UNIQUE INDEX "TimetablePeriod_tenantId_academicYearId_name_key" ON "TimetablePeriod"("tenantId", "academicYearId", "name");
CREATE INDEX "TimetablePeriod_tenantId_academicYearId_dayOfWeek_sortOrder_idx" ON "TimetablePeriod"("tenantId", "academicYearId", "dayOfWeek", "sortOrder");
CREATE UNIQUE INDEX "Room_tenantId_name_key" ON "Room"("tenantId", "name");
CREATE INDEX "Room_tenantId_isActive_idx" ON "Room"("tenantId", "isActive");
CREATE INDEX "TimetableVersion_tenantId_academicYearId_classId_sectionId_status_idx" ON "TimetableVersion"("tenantId", "academicYearId", "classId", "sectionId", "status");
CREATE INDEX "TimetableVersion_tenantId_status_effectiveFrom_effectiveTo_idx" ON "TimetableVersion"("tenantId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "TimetableSlot_tenantId_roomId_dayOfWeek_idx" ON "TimetableSlot"("tenantId", "roomId", "dayOfWeek");
CREATE INDEX "TimetableSlot_tenantId_versionId_idx" ON "TimetableSlot"("tenantId", "versionId");
CREATE INDEX "TeacherAvailability_tenantId_staffId_dayOfWeek_idx" ON "TeacherAvailability"("tenantId", "staffId", "dayOfWeek");
CREATE INDEX "TeacherAvailability_tenantId_academicYearId_staffId_idx" ON "TeacherAvailability"("tenantId", "academicYearId", "staffId");
CREATE UNIQUE INDEX "TeacherWorkloadLimit_tenantId_academicYearId_staffId_key" ON "TeacherWorkloadLimit"("tenantId", "academicYearId", "staffId");
CREATE INDEX "TeacherWorkloadLimit_tenantId_staffId_idx" ON "TeacherWorkloadLimit"("tenantId", "staffId");
CREATE INDEX "TimetableSubstitution_tenantId_date_status_idx" ON "TimetableSubstitution"("tenantId", "date", "status");
CREATE INDEX "TimetableSubstitution_tenantId_absentTeacherId_date_idx" ON "TimetableSubstitution"("tenantId", "absentTeacherId", "date");
CREATE INDEX "TimetableSubstitution_tenantId_substituteTeacherId_date_idx" ON "TimetableSubstitution"("tenantId", "substituteTeacherId", "date");
CREATE INDEX "HomeworkReminderBatch_tenantId_homeworkId_createdAt_idx" ON "HomeworkReminderBatch"("tenantId", "homeworkId", "createdAt");
CREATE INDEX "HomeworkAssignment_tenantId_academicYearId_classId_sectionId_status_idx" ON "HomeworkAssignment"("tenantId", "academicYearId", "classId", "sectionId", "status");
CREATE INDEX "HomeworkAssignment_tenantId_subjectId_assignedByStaffId_status_idx" ON "HomeworkAssignment"("tenantId", "subjectId", "assignedByStaffId", "status");
CREATE INDEX "HomeworkAssignment_tenantId_dueDate_status_idx" ON "HomeworkAssignment"("tenantId", "dueDate", "status");
CREATE INDEX "HomeworkSubmission_tenantId_homeworkId_status_idx" ON "HomeworkSubmission"("tenantId", "homeworkId", "status");

-- Foreign keys
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimetablePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherWorkloadLimit" ADD CONSTRAINT "TeacherWorkloadLimit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherWorkloadLimit" ADD CONSTRAINT "TeacherWorkloadLimit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_absentTeacherId_fkey" FOREIGN KEY ("absentTeacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeworkReminderBatch" ADD CONSTRAINT "HomeworkReminderBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeworkReminderBatch" ADD CONSTRAINT "HomeworkReminderBatch_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
