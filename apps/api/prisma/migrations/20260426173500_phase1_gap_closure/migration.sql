-- CreateEnum
CREATE TYPE "AttendanceSyncStatus" AS ENUM ('ACCEPTED', 'CONFLICTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityReactionType" AS ENUM ('HEART', 'CLAP', 'STAR');

-- CreateEnum
CREATE TYPE "DevelopmentalMilestoneStatus" AS ENUM ('EMERGING', 'PROGRESSING', 'ACHIEVED', 'NEEDS_SUPPORT');

-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "reportCardBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hallTicketBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AttendanceConflict"
ADD COLUMN "status" "AttendanceConflictStatus" NOT NULL DEFAULT 'FLAGGED',
ADD COLUMN "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "GeneratedStudentDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "GeneratedStudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSyncSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientSubmissionId" TEXT NOT NULL,
    "attendanceSessionId" TEXT,
    "conflictId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "deviceTimestamp" TIMESTAMP(3),
    "syncStatus" "AttendanceSyncStatus" NOT NULL DEFAULT 'ACCEPTED',
    "submittedById" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSyncSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityReaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activityPostId" TEXT NOT NULL,
    "guardianId" TEXT,
    "studentId" TEXT,
    "reaction" "ActivityReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentalMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "studentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "status" "DevelopmentalMilestoneStatus" NOT NULL,
    "observationNote" TEXT,
    "photoObjectKey" TEXT,
    "photoUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedStudentDocument_tenantId_studentId_kind_idx" ON "GeneratedStudentDocument"("tenantId", "studentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSyncSubmission_tenantId_clientSubmissionId_key" ON "AttendanceSyncSubmission"("tenantId", "clientSubmissionId");

-- CreateIndex
CREATE INDEX "AttendanceSyncSubmission_tenantId_syncStatus_attendanceDate_idx" ON "AttendanceSyncSubmission"("tenantId", "syncStatus", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_activityPostId_guardianId_reaction_key" ON "ActivityReaction"("activityPostId", "guardianId", "reaction");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_activityPostId_studentId_reaction_key" ON "ActivityReaction"("activityPostId", "studentId", "reaction");

-- CreateIndex
CREATE INDEX "ActivityReaction_tenantId_activityPostId_idx" ON "ActivityReaction"("tenantId", "activityPostId");

-- CreateIndex
CREATE INDEX "DevelopmentalMilestone_tenantId_studentId_observedAt_idx" ON "DevelopmentalMilestone"("tenantId", "studentId", "observedAt");

-- CreateIndex
CREATE INDEX "DevelopmentalMilestone_tenantId_classId_sectionId_idx" ON "DevelopmentalMilestone"("tenantId", "classId", "sectionId");

-- AddForeignKey
ALTER TABLE "GeneratedStudentDocument" ADD CONSTRAINT "GeneratedStudentDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedStudentDocument" ADD CONSTRAINT "GeneratedStudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSyncSubmission" ADD CONSTRAINT "AttendanceSyncSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_activityPostId_fkey" FOREIGN KEY ("activityPostId") REFERENCES "ActivityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
