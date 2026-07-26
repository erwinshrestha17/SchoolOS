CREATE TYPE "TeacherObservationStatus" AS ENUM (
  'DRAFT',
  'COMPLETED',
  'ACKNOWLEDGED',
  'FOLLOW_UP_DUE',
  'CLOSED'
);

CREATE TYPE "TeacherDevelopmentGoalStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "TeacherTrainingStatus" AS ENUM (
  'PLANNED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "SchoolImprovementPlanStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "SchoolImprovementActionStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "TeacherClassroomObservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "teacherStaffId" TEXT NOT NULL,
  "observerUserId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT,
  "sectionId" TEXT,
  "subjectId" TEXT,
  "timetableSlotId" TEXT,
  "observedOn" DATE NOT NULL,
  "strengths" TEXT NOT NULL,
  "developmentFocus" TEXT NOT NULL,
  "agreedAction" TEXT,
  "teacherResponse" TEXT,
  "followUpOn" DATE,
  "status" "TeacherObservationStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherClassroomObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherDevelopmentGoal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "teacherStaffId" TEXT NOT NULL,
  "mentorStaffId" TEXT,
  "academicYearId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "baseline" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "actionPlan" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "dueOn" DATE NOT NULL,
  "status" "TeacherDevelopmentGoalStatus" NOT NULL DEFAULT 'DRAFT',
  "progressNote" TEXT,
  "completedOn" DATE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherDevelopmentGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherTrainingRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "teacherStaffId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "providerName" TEXT,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE,
  "status" "TeacherTrainingStatus" NOT NULL DEFAULT 'PLANNED',
  "learningSummary" TEXT,
  "certificateFileAssetId" TEXT,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherTrainingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolImprovementPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "baselineSummary" TEXT NOT NULL,
  "targetSummary" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "status" "SchoolImprovementPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolImprovementPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolImprovementKpi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "baselineValue" DECIMAL(14,2) NOT NULL,
  "targetValue" DECIMAL(14,2) NOT NULL,
  "latestValue" DECIMAL(14,2),
  "dueOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolImprovementKpi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolImprovementAction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "dueOn" DATE NOT NULL,
  "status" "SchoolImprovementActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "progressNote" TEXT,
  "evidenceFileAssetId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolImprovementAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolImprovementReview" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "reviewedByUserId" TEXT NOT NULL,
  "reviewedOn" DATE NOT NULL,
  "summary" TEXT NOT NULL,
  "nextActions" TEXT NOT NULL,
  "kpiSnapshot" JSONB NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolImprovementReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherClassroomObservation_tenantId_observerUserId_clientRequestId_key"
  ON "TeacherClassroomObservation"("tenantId", "observerUserId", "clientRequestId");
CREATE INDEX "TeacherClassroomObservation_tenantId_academicYearId_status_followUpOn_idx"
  ON "TeacherClassroomObservation"("tenantId", "academicYearId", "status", "followUpOn");
CREATE INDEX "TeacherClassroomObservation_tenantId_teacherStaffId_observedOn_idx"
  ON "TeacherClassroomObservation"("tenantId", "teacherStaffId", "observedOn");

CREATE UNIQUE INDEX "TeacherDevelopmentGoal_tenantId_createdByUserId_clientRequestId_key"
  ON "TeacherDevelopmentGoal"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "TeacherDevelopmentGoal_tenantId_academicYearId_status_dueOn_idx"
  ON "TeacherDevelopmentGoal"("tenantId", "academicYearId", "status", "dueOn");
CREATE INDEX "TeacherDevelopmentGoal_tenantId_teacherStaffId_status_idx"
  ON "TeacherDevelopmentGoal"("tenantId", "teacherStaffId", "status");
CREATE INDEX "TeacherDevelopmentGoal_tenantId_mentorStaffId_status_idx"
  ON "TeacherDevelopmentGoal"("tenantId", "mentorStaffId", "status");

CREATE UNIQUE INDEX "TeacherTrainingRecord_tenantId_createdByUserId_clientRequestId_key"
  ON "TeacherTrainingRecord"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "TeacherTrainingRecord_tenantId_teacherStaffId_startsOn_idx"
  ON "TeacherTrainingRecord"("tenantId", "teacherStaffId", "startsOn");
CREATE INDEX "TeacherTrainingRecord_tenantId_status_startsOn_idx"
  ON "TeacherTrainingRecord"("tenantId", "status", "startsOn");
CREATE INDEX "TeacherTrainingRecord_tenantId_certificateFileAssetId_idx"
  ON "TeacherTrainingRecord"("tenantId", "certificateFileAssetId");

CREATE UNIQUE INDEX "SchoolImprovementPlan_tenantId_createdByUserId_clientRequestId_key"
  ON "SchoolImprovementPlan"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "SchoolImprovementPlan_tenantId_academicYearId_status_idx"
  ON "SchoolImprovementPlan"("tenantId", "academicYearId", "status");
CREATE INDEX "SchoolImprovementPlan_tenantId_ownerUserId_status_idx"
  ON "SchoolImprovementPlan"("tenantId", "ownerUserId", "status");

CREATE INDEX "SchoolImprovementKpi_tenantId_planId_dueOn_idx"
  ON "SchoolImprovementKpi"("tenantId", "planId", "dueOn");
CREATE INDEX "SchoolImprovementKpi_tenantId_ownerUserId_dueOn_idx"
  ON "SchoolImprovementKpi"("tenantId", "ownerUserId", "dueOn");

CREATE INDEX "SchoolImprovementAction_tenantId_planId_status_dueOn_idx"
  ON "SchoolImprovementAction"("tenantId", "planId", "status", "dueOn");
CREATE INDEX "SchoolImprovementAction_tenantId_ownerUserId_status_idx"
  ON "SchoolImprovementAction"("tenantId", "ownerUserId", "status");
CREATE INDEX "SchoolImprovementAction_tenantId_evidenceFileAssetId_idx"
  ON "SchoolImprovementAction"("tenantId", "evidenceFileAssetId");

CREATE UNIQUE INDEX "SchoolImprovementReview_tenantId_reviewedByUserId_clientRequestId_key"
  ON "SchoolImprovementReview"("tenantId", "reviewedByUserId", "clientRequestId");
CREATE INDEX "SchoolImprovementReview_tenantId_planId_reviewedOn_idx"
  ON "SchoolImprovementReview"("tenantId", "planId", "reviewedOn");

ALTER TABLE "TeacherClassroomObservation"
  ADD CONSTRAINT "TeacherClassroomObservation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherClassroomObservation_teacherStaffId_fkey"
  FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherDevelopmentGoal"
  ADD CONSTRAINT "TeacherDevelopmentGoal_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherDevelopmentGoal_teacherStaffId_fkey"
  FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherDevelopmentGoal_mentorStaffId_fkey"
  FOREIGN KEY ("mentorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherTrainingRecord"
  ADD CONSTRAINT "TeacherTrainingRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherTrainingRecord_teacherStaffId_fkey"
  FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolImprovementPlan"
  ADD CONSTRAINT "SchoolImprovementPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolImprovementKpi"
  ADD CONSTRAINT "SchoolImprovementKpi_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SchoolImprovementKpi_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SchoolImprovementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolImprovementAction"
  ADD CONSTRAINT "SchoolImprovementAction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SchoolImprovementAction_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SchoolImprovementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolImprovementReview"
  ADD CONSTRAINT "SchoolImprovementReview_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SchoolImprovementReview_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SchoolImprovementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
