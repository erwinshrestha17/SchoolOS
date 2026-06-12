-- M12 Learning Layer backend foundation.

CREATE TYPE "LearningActivityType" AS ENUM ('PRACTICE', 'QUIZ', 'EXPLANATION', 'REVISION', 'OBSERVATION');
CREATE TYPE "LearningDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "LearningMode" AS ENUM ('SMART_BOARD', 'GROUP', 'COMPUTER_LAB', 'WORKSHEET', 'HYBRID');
CREATE TYPE "LearningAccessType" AS ENUM ('SCHOOL_ONLY', 'CLASS_ONLY');
CREATE TYPE "LearningLanguageMode" AS ENUM ('ENGLISH', 'NEPALI', 'MIXED');
CREATE TYPE "LearningActivityStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');
CREATE TYPE "LearningSessionStatus" AS ENUM ('LIVE', 'PAUSED', 'ENDED', 'EXPIRED');
CREATE TYPE "LearningParticipantStatus" AS ENUM ('JOINED', 'LEFT', 'REMOVED');
CREATE TYPE "LearningAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
CREATE TYPE "LearningQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');
CREATE TYPE "LearningProgressLabel" AS ENUM ('NEEDS_PRACTICE', 'IMPROVING', 'READY', 'STRONG');
CREATE TYPE "LearningResourceType" AS ENUM ('FILE', 'LINK', 'NOTE');

CREATE TABLE "LearningActivity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "chapterId" TEXT,
  "topicId" TEXT,
  "teacherId" TEXT NOT NULL,
  "activityType" "LearningActivityType" NOT NULL,
  "difficulty" "LearningDifficulty" NOT NULL,
  "mode" "LearningMode" NOT NULL,
  "accessType" "LearningAccessType" NOT NULL DEFAULT 'SCHOOL_ONLY',
  "languageMode" "LearningLanguageMode" NOT NULL DEFAULT 'ENGLISH',
  "estimatedMinutes" INTEGER,
  "status" "LearningActivityStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningQuestion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "type" "LearningQuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB,
  "correctAnswer" JSONB,
  "explanation" TEXT,
  "points" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "mode" "LearningMode" NOT NULL,
  "sessionCode" TEXT NOT NULL,
  "qrTokenHash" TEXT,
  "status" "LearningSessionStatus" NOT NULL DEFAULT 'LIVE',
  "schoolOnly" BOOLEAN NOT NULL DEFAULT true,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "teacherHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningParticipant" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "LearningParticipantStatus" NOT NULL DEFAULT 'JOINED',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "score" DECIMAL(8,2),
  "accuracy" DECIMAL(5,2),
  "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
  "hintsUsed" INTEGER NOT NULL DEFAULT 0,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "LearningAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningAnswer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB,
  "isCorrect" BOOLEAN,
  "score" DECIMAL(8,2),
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningProgress" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "progressKey" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "topicId" TEXT,
  "activityId" TEXT,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  "totalScore" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalPossibleScore" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "averageAccuracy" DECIMAL(5,2),
  "label" "LearningProgressLabel" NOT NULL DEFAULT 'NEEDS_PRACTICE',
  "lastAttemptId" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningResource" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "activityId" TEXT,
  "subjectId" TEXT,
  "topicId" TEXT,
  "fileAssetId" TEXT,
  "type" "LearningResourceType" NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "metadata" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningActivity_tenantId_idx" ON "LearningActivity"("tenantId");
CREATE INDEX "LearningActivity_tenantId_classId_idx" ON "LearningActivity"("tenantId", "classId");
CREATE INDEX "LearningActivity_tenantId_sectionId_idx" ON "LearningActivity"("tenantId", "sectionId");
CREATE INDEX "LearningActivity_tenantId_subjectId_idx" ON "LearningActivity"("tenantId", "subjectId");
CREATE INDEX "LearningActivity_tenantId_teacherId_idx" ON "LearningActivity"("tenantId", "teacherId");
CREATE INDEX "LearningActivity_tenantId_status_updatedAt_idx" ON "LearningActivity"("tenantId", "status", "updatedAt");

CREATE INDEX "LearningQuestion_tenantId_activityId_idx" ON "LearningQuestion"("tenantId", "activityId");

CREATE UNIQUE INDEX "LearningSession_tenantId_sessionCode_key" ON "LearningSession"("tenantId", "sessionCode");
CREATE INDEX "LearningSession_tenantId_idx" ON "LearningSession"("tenantId");
CREATE INDEX "LearningSession_tenantId_classId_idx" ON "LearningSession"("tenantId", "classId");
CREATE INDEX "LearningSession_tenantId_sectionId_idx" ON "LearningSession"("tenantId", "sectionId");
CREATE INDEX "LearningSession_tenantId_subjectId_idx" ON "LearningSession"("tenantId", "subjectId");
CREATE INDEX "LearningSession_tenantId_teacherId_idx" ON "LearningSession"("tenantId", "teacherId");
CREATE INDEX "LearningSession_tenantId_activityId_idx" ON "LearningSession"("tenantId", "activityId");
CREATE INDEX "LearningSession_tenantId_status_expiresAt_idx" ON "LearningSession"("tenantId", "status", "expiresAt");
CREATE INDEX "LearningSession_tenantId_qrTokenHash_idx" ON "LearningSession"("tenantId", "qrTokenHash");

CREATE UNIQUE INDEX "LearningParticipant_tenantId_sessionId_studentId_key" ON "LearningParticipant"("tenantId", "sessionId", "studentId");
CREATE INDEX "LearningParticipant_tenantId_sessionId_idx" ON "LearningParticipant"("tenantId", "sessionId");
CREATE INDEX "LearningParticipant_tenantId_studentId_idx" ON "LearningParticipant"("tenantId", "studentId");

CREATE INDEX "LearningAttempt_tenantId_idx" ON "LearningAttempt"("tenantId");
CREATE INDEX "LearningAttempt_tenantId_sessionId_idx" ON "LearningAttempt"("tenantId", "sessionId");
CREATE INDEX "LearningAttempt_tenantId_activityId_idx" ON "LearningAttempt"("tenantId", "activityId");
CREATE INDEX "LearningAttempt_tenantId_studentId_idx" ON "LearningAttempt"("tenantId", "studentId");
CREATE INDEX "LearningAttempt_tenantId_studentId_activityId_idx" ON "LearningAttempt"("tenantId", "studentId", "activityId");

CREATE UNIQUE INDEX "LearningAnswer_tenantId_attemptId_questionId_key" ON "LearningAnswer"("tenantId", "attemptId", "questionId");
CREATE INDEX "LearningAnswer_tenantId_attemptId_idx" ON "LearningAnswer"("tenantId", "attemptId");
CREATE INDEX "LearningAnswer_tenantId_questionId_idx" ON "LearningAnswer"("tenantId", "questionId");

CREATE UNIQUE INDEX "LearningProgress_tenantId_studentId_progressKey_key" ON "LearningProgress"("tenantId", "studentId", "progressKey");
CREATE INDEX "LearningProgress_tenantId_idx" ON "LearningProgress"("tenantId");
CREATE INDEX "LearningProgress_tenantId_studentId_idx" ON "LearningProgress"("tenantId", "studentId");
CREATE INDEX "LearningProgress_tenantId_subjectId_idx" ON "LearningProgress"("tenantId", "subjectId");
CREATE INDEX "LearningProgress_tenantId_activityId_idx" ON "LearningProgress"("tenantId", "activityId");
CREATE INDEX "LearningProgress_tenantId_studentId_subjectId_idx" ON "LearningProgress"("tenantId", "studentId", "subjectId");

CREATE INDEX "LearningResource_tenantId_idx" ON "LearningResource"("tenantId");
CREATE INDEX "LearningResource_tenantId_activityId_idx" ON "LearningResource"("tenantId", "activityId");
CREATE INDEX "LearningResource_tenantId_subjectId_idx" ON "LearningResource"("tenantId", "subjectId");
CREATE INDEX "LearningResource_tenantId_topicId_idx" ON "LearningResource"("tenantId", "topicId");
CREATE INDEX "LearningResource_tenantId_fileAssetId_idx" ON "LearningResource"("tenantId", "fileAssetId");

ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_archivedBy_fkey" FOREIGN KEY ("archivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningQuestion" ADD CONSTRAINT "LearningQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningQuestion" ADD CONSTRAINT "LearningQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LearningParticipant" ADD CONSTRAINT "LearningParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningParticipant" ADD CONSTRAINT "LearningParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningParticipant" ADD CONSTRAINT "LearningParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningAttempt" ADD CONSTRAINT "LearningAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningAttempt" ADD CONSTRAINT "LearningAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningAttempt" ADD CONSTRAINT "LearningAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningAttempt" ADD CONSTRAINT "LearningAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "LearningAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LearningQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_lastAttemptId_fkey" FOREIGN KEY ("lastAttemptId") REFERENCES "LearningAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
