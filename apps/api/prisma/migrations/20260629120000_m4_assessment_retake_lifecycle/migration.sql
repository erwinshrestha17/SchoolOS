CREATE TYPE "AssessmentRetakeType" AS ENUM ('RETEST', 'MAKE_UP');

CREATE TYPE "AssessmentRetakeStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
  'COMPLETED',
  'APPLIED',
  'CANCELLED'
);

CREATE TYPE "AssessmentRetakeResultDecision" AS ENUM (
  'PENDING',
  'KEEP_ORIGINAL',
  'USE_RETAKE'
);

CREATE TABLE "ReportCardSubjectResult" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reportCardId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "subjectCode" TEXT NOT NULL,
  "marksObtained" DECIMAL(10, 2) NOT NULL,
  "maxMarks" DECIMAL(10, 2) NOT NULL,
  "percentage" DECIMAL(5, 2) NOT NULL,
  "grade" TEXT NOT NULL,
  "gpa" DECIMAL(3, 2) NOT NULL,
  "resultStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportCardSubjectResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentRetake" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "markEntryId" TEXT NOT NULL,
  "examTermId" TEXT NOT NULL,
  "assessmentComponentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "type" "AssessmentRetakeType" NOT NULL,
  "status" "AssessmentRetakeStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT NOT NULL,
  "originalMarks" DECIMAL(8, 2) NOT NULL,
  "originalStatus" "MarkEntryStatus" NOT NULL,
  "scheduledStartsAt" TIMESTAMP(3),
  "scheduledEndsAt" TIMESTAMP(3),
  "room" TEXT,
  "attemptMarks" DECIMAL(8, 2),
  "attemptRemarks" TEXT,
  "resultDecision" "AssessmentRetakeResultDecision" NOT NULL DEFAULT 'PENDING',
  "resultDecisionReason" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "scheduledById" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "appliedById" TEXT,
  "appliedAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AssessmentRetake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportCardSubjectResult_tenantId_reportCardId_version_subjectId_key"
  ON "ReportCardSubjectResult"("tenantId", "reportCardId", "version", "subjectId");

CREATE INDEX "ReportCardSubjectResult_tenantId_reportCardId_version_idx"
  ON "ReportCardSubjectResult"("tenantId", "reportCardId", "version");

CREATE INDEX "AssessmentRetake_tenantId_status_createdAt_idx"
  ON "AssessmentRetake"("tenantId", "status", "createdAt");

CREATE INDEX "AssessmentRetake_tenantId_examTermId_classId_sectionId_idx"
  ON "AssessmentRetake"("tenantId", "examTermId", "classId", "sectionId");

CREATE INDEX "AssessmentRetake_tenantId_studentId_createdAt_idx"
  ON "AssessmentRetake"("tenantId", "studentId", "createdAt");

CREATE INDEX "AssessmentRetake_tenantId_markEntryId_status_idx"
  ON "AssessmentRetake"("tenantId", "markEntryId", "status");

CREATE UNIQUE INDEX "AssessmentRetake_one_active_per_mark"
  ON "AssessmentRetake"("tenantId", "markEntryId")
  WHERE "status" IN ('REQUESTED', 'APPROVED', 'SCHEDULED', 'COMPLETED');

ALTER TABLE "ReportCardSubjectResult"
  ADD CONSTRAINT "ReportCardSubjectResult_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportCardSubjectResult"
  ADD CONSTRAINT "ReportCardSubjectResult_reportCardId_fkey"
  FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportCardSubjectResult"
  ADD CONSTRAINT "ReportCardSubjectResult_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_markEntryId_fkey"
  FOREIGN KEY ("markEntryId") REFERENCES "MarkEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_examTermId_fkey"
  FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_assessmentComponentId_fkey"
  FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_scheduledById_fkey"
  FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_appliedById_fkey"
  FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssessmentRetake"
  ADD CONSTRAINT "AssessmentRetake_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
