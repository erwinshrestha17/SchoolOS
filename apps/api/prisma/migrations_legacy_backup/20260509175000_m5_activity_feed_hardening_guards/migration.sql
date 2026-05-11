-- M5 Activity Feed hardening guardrails.
-- Adds moderation/soft-delete columns and enforces activity media/file/visibility integrity.

ALTER TABLE "ActivityPost"
ADD COLUMN IF NOT EXISTS "moderationStatus" text NOT NULL DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS "moderationReason" text,
ADD COLUMN IF NOT EXISTS "moderatedAt" timestamp,
ADD COLUMN IF NOT EXISTS "moderatedById" text,
ADD COLUMN IF NOT EXISTS "softDeletedAt" timestamp,
ADD COLUMN IF NOT EXISTS "editedAt" timestamp,
ADD COLUMN IF NOT EXISTS "editedById" text;

ALTER TABLE "ActivityAttachment"
ADD COLUMN IF NOT EXISTS "processingStatus" text NOT NULL DEFAULT 'PENDING';

CREATE OR REPLACE FUNCTION "enforce_activity_post_guard"()
RETURNS trigger AS $$
DECLARE
  class_tenant_id text;
  section_tenant_id text;
  section_class_id text;
BEGIN
  SELECT "tenantId" INTO class_tenant_id FROM "Class" WHERE "id" = NEW."classId";

  IF class_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Activity post class does not exist';
  END IF;

  IF class_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Activity post class is outside this tenant';
  END IF;

  IF NEW."sectionId" IS NOT NULL THEN
    SELECT "tenantId", "classId" INTO section_tenant_id, section_class_id FROM "Section" WHERE "id" = NEW."sectionId";

    IF section_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Activity post section does not exist';
    END IF;

    IF section_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Activity post section is outside this tenant';
    END IF;

    IF section_class_id <> NEW."classId" THEN
      RAISE EXCEPTION 'Activity post section does not belong to class';
    END IF;
  END IF;

  IF NEW."moderationStatus" NOT IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED') THEN
    RAISE EXCEPTION 'Invalid activity post moderation status';
  END IF;

  IF NEW."moderationStatus" = 'REJECTED' AND COALESCE(TRIM(NEW."moderationReason"), '') = '' THEN
    RAISE EXCEPTION 'Rejected activity post requires a reason';
  END IF;

  IF NEW."softDeletedAt" IS NOT NULL AND NEW."moderationStatus" NOT IN ('REJECTED') THEN
    NEW."moderationStatus" := 'REJECTED';
    IF NEW."moderationReason" IS NULL THEN
      NEW."moderationReason" := 'Soft deleted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "activity_post_guard" ON "ActivityPost";

CREATE TRIGGER "activity_post_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "classId", "sectionId", "moderationStatus", "moderationReason", "softDeletedAt"
ON "ActivityPost"
FOR EACH ROW
EXECUTE FUNCTION "enforce_activity_post_guard"();

CREATE OR REPLACE FUNCTION "enforce_activity_attachment_guard"()
RETURNS trigger AS $$
DECLARE
  post_tenant_id text;
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  file_module text;
  file_entity_id text;
  attachment_count int;
BEGIN
  SELECT "tenantId" INTO post_tenant_id FROM "ActivityPost" WHERE "id" = NEW."activityPostId";

  IF post_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Activity attachment post does not exist';
  END IF;

  IF post_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Activity attachment post is outside this tenant';
  END IF;

  IF NEW."contentType" NOT LIKE 'image/%' THEN
    RAISE EXCEPTION 'Activity attachment must be an image';
  END IF;

  IF NEW."sizeBytes" <= 0 OR NEW."sizeBytes" > (10 * 1024 * 1024) THEN
    RAISE EXCEPTION 'Activity attachment size is invalid';
  END IF;

  IF NEW."publicUrl" IS NOT NULL THEN
    RAISE EXCEPTION 'Activity attachment must not store permanent public URLs';
  END IF;

  SELECT COUNT(*) INTO attachment_count
  FROM "ActivityAttachment"
  WHERE "tenantId" = NEW."tenantId"
    AND "activityPostId" = NEW."activityPostId"
    AND "id" <> COALESCE(NEW."id", '');

  IF attachment_count >= 5 THEN
    RAISE EXCEPTION 'Activity post cannot have more than 5 attachments';
  END IF;

  IF NEW."fileAssetId" IS NOT NULL THEN
    SELECT "tenantId", "status"::text, "softDeletedAt", "module", "entityId"
      INTO file_tenant_id, file_status, file_soft_deleted_at, file_module, file_entity_id
    FROM "FileAsset"
    WHERE "id" = NEW."fileAssetId";

    IF file_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Activity attachment file asset does not exist';
    END IF;

    IF file_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Activity attachment file asset is outside this tenant';
    END IF;

    IF file_status <> 'UPLOADED' THEN
      RAISE EXCEPTION 'Activity attachment file asset is not uploaded';
    END IF;

    IF file_soft_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Activity attachment file asset is deleted';
    END IF;

    IF file_module IS NOT NULL AND file_module <> 'activity' THEN
      RAISE EXCEPTION 'Activity attachment file asset module is invalid';
    END IF;

    IF file_entity_id IS NOT NULL AND file_entity_id <> NEW."activityPostId" THEN
      RAISE EXCEPTION 'Activity attachment file asset is not linked to this post';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "activity_attachment_guard" ON "ActivityAttachment";

CREATE TRIGGER "activity_attachment_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "activityPostId", "fileAssetId", "contentType", "sizeBytes", "publicUrl"
ON "ActivityAttachment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_activity_attachment_guard"();

CREATE OR REPLACE FUNCTION "enforce_activity_post_student_guard"()
RETURNS trigger AS $$
DECLARE
  post_tenant_id text;
  post_class_id text;
  post_section_id text;
  student_tenant_id text;
  student_class_id text;
  student_section_id text;
BEGIN
  SELECT "tenantId", "classId", "sectionId" INTO post_tenant_id, post_class_id, post_section_id
  FROM "ActivityPost" WHERE "id" = NEW."activityPostId";

  IF post_tenant_id IS NULL OR post_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Activity tag post is missing or outside tenant';
  END IF;

  SELECT "tenantId", "classId", "sectionId" INTO student_tenant_id, student_class_id, student_section_id
  FROM "Student" WHERE "id" = NEW."studentId";

  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Activity tagged student is missing or outside tenant';
  END IF;

  IF student_class_id <> post_class_id THEN
    RAISE EXCEPTION 'Activity tagged student does not belong to post class';
  END IF;

  IF post_section_id IS NOT NULL AND student_section_id <> post_section_id THEN
    RAISE EXCEPTION 'Activity tagged student does not belong to post section';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "activity_post_student_guard" ON "ActivityPostStudent";

CREATE TRIGGER "activity_post_student_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "activityPostId", "studentId"
ON "ActivityPostStudent"
FOR EACH ROW
EXECUTE FUNCTION "enforce_activity_post_student_guard"();

CREATE INDEX IF NOT EXISTS "ActivityPost_tenant_visibility_idx"
ON "ActivityPost" ("tenantId", "classId", "sectionId", "publishedAt");

CREATE INDEX IF NOT EXISTS "ActivityPost_tenant_moderation_idx"
ON "ActivityPost" ("tenantId", "moderationStatus", "softDeletedAt", "publishedAt");

CREATE INDEX IF NOT EXISTS "ActivityAttachment_tenant_post_idx"
ON "ActivityAttachment" ("tenantId", "activityPostId", "sortOrder");

CREATE INDEX IF NOT EXISTS "ActivityAttachment_tenant_file_idx"
ON "ActivityAttachment" ("tenantId", "fileAssetId");

CREATE INDEX IF NOT EXISTS "ActivityPostStudent_tenant_student_idx"
ON "ActivityPostStudent" ("tenantId", "studentId", "activityPostId");

CREATE INDEX IF NOT EXISTS "MoodLog_tenant_student_date_idx"
ON "MoodLog" ("tenantId", "studentId", "logDate");

CREATE INDEX IF NOT EXISTS "DevelopmentalMilestone_tenant_student_observed_idx"
ON "DevelopmentalMilestone" ("tenantId", "studentId", "observedAt");
