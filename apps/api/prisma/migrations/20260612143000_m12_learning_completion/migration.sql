-- M12 Learning completion: resource lifecycle and additional question types.

ALTER TYPE "LearningQuestionType" ADD VALUE IF NOT EXISTS 'MATCHING';
ALTER TYPE "LearningQuestionType" ADD VALUE IF NOT EXISTS 'ORDERING';

DO $$
BEGIN
  CREATE TYPE "LearningResourceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LearningResource"
  ADD COLUMN IF NOT EXISTS "status" "LearningResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;

ALTER TABLE "LearningResource"
  ADD CONSTRAINT "LearningResource_archivedBy_fkey"
  FOREIGN KEY ("archivedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "LearningResource_tenantId_status_idx"
  ON "LearningResource"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "LearningResource_tenantId_activityId_status_idx"
  ON "LearningResource"("tenantId", "activityId", "status");

CREATE INDEX IF NOT EXISTS "LearningResource_tenantId_subjectId_status_idx"
  ON "LearningResource"("tenantId", "subjectId", "status");

CREATE INDEX IF NOT EXISTS "LearningResource_tenantId_topicId_status_idx"
  ON "LearningResource"("tenantId", "topicId", "status");
