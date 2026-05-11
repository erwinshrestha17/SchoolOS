-- Phase 2E: Parent-Class Teacher Chat for M10 Notices & Communication.

CREATE TYPE "ParentTeacherThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'ESCALATED');
CREATE TYPE "ParentTeacherSenderRole" AS ENUM ('PARENT', 'TEACHER', 'ADMIN');
CREATE TYPE "ParentTeacherMessagePriority" AS ENUM ('NORMAL', 'IMPORTANT', 'EMERGENCY');
CREATE TYPE "ChatAvailabilityAppliesToRole" AS ENUM ('TEACHER', 'PARENT', 'BOTH');
CREATE TYPE "ChatEscalationStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "ChatAbuseReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');

ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

CREATE TABLE "ParentTeacherThread" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "classTeacherId" TEXT NOT NULL,
  "status" "ParentTeacherThreadStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "closedByUserId" TEXT,
  "closeReason" TEXT,
  CONSTRAINT "ParentTeacherThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentTeacherThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherThread_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherThread_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherThread_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherThread_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherThread_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ParentTeacherMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderRole" "ParentTeacherSenderRole" NOT NULL,
  "message" TEXT NOT NULL,
  "priority" "ParentTeacherMessagePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParentTeacherMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentTeacherMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentTeacherMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ChatAvailabilityRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "appliesToRole" "ChatAvailabilityAppliesToRole" NOT NULL DEFAULT 'BOTH',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatAvailabilityRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatAvailabilityRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ChatEscalation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "escalatedByUserId" TEXT NOT NULL,
  "escalatedToUserId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "ChatEscalationStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  CONSTRAINT "ChatEscalation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatEscalation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatEscalation_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatEscalation_escalatedByUserId_fkey" FOREIGN KEY ("escalatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatEscalation_escalatedToUserId_fkey" FOREIGN KEY ("escalatedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ChatEscalation_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ChatAbuseReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageId" TEXT,
  "reportedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ChatAbuseReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatAbuseReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatAbuseReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatAbuseReport_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatAbuseReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ParentTeacherMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ChatAbuseReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatAbuseReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ParentTeacherThread_tenantId_studentId_academicYearId_idx" ON "ParentTeacherThread"("tenantId", "studentId", "academicYearId");
CREATE INDEX "ParentTeacherThread_tenantId_guardianId_idx" ON "ParentTeacherThread"("tenantId", "guardianId");
CREATE INDEX "ParentTeacherThread_tenantId_classTeacherId_idx" ON "ParentTeacherThread"("tenantId", "classTeacherId");
CREATE INDEX "ParentTeacherThread_tenantId_status_updatedAt_idx" ON "ParentTeacherThread"("tenantId", "status", "updatedAt");
CREATE UNIQUE INDEX "ParentTeacherThread_one_open_thread_idx" ON "ParentTeacherThread"("tenantId", "academicYearId", "studentId", "guardianId", "classTeacherId") WHERE "status" = 'OPEN';

CREATE INDEX "ParentTeacherMessage_tenantId_threadId_createdAt_idx" ON "ParentTeacherMessage"("tenantId", "threadId", "createdAt");
CREATE INDEX "ParentTeacherMessage_tenantId_status_updatedAt_idx" ON "ParentTeacherMessage"("tenantId", "status", "updatedAt");

CREATE UNIQUE INDEX "ChatAvailabilityRule_tenantId_dayOfWeek_appliesToRole_key" ON "ChatAvailabilityRule"("tenantId", "dayOfWeek", "appliesToRole");
CREATE INDEX "ChatAvailabilityRule_tenantId_dayOfWeek_idx" ON "ChatAvailabilityRule"("tenantId", "dayOfWeek");

CREATE INDEX "ChatEscalation_tenantId_threadId_createdAt_idx" ON "ChatEscalation"("tenantId", "threadId", "createdAt");
CREATE INDEX "ChatEscalation_tenantId_status_createdAt_idx" ON "ChatEscalation"("tenantId", "status", "createdAt");

CREATE INDEX "ChatAbuseReport_tenantId_threadId_createdAt_idx" ON "ChatAbuseReport"("tenantId", "threadId", "createdAt");
CREATE INDEX "ChatAbuseReport_tenantId_status_createdAt_idx" ON "ChatAbuseReport"("tenantId", "status", "createdAt");
