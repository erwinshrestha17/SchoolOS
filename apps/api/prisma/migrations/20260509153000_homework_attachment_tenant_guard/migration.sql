-- Guardrail for Homework attachments.
-- A HomeworkAttachment must point to a tenant-owned, uploaded, non-deleted FileAsset
-- and to a HomeworkSubmission from the same tenant.

CREATE OR REPLACE FUNCTION "enforce_homework_attachment_tenant_guard"()
RETURNS trigger AS $$
DECLARE
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  submission_tenant_id text;
BEGIN
  SELECT "tenantId", "status"::text, "softDeletedAt"
    INTO file_tenant_id, file_status, file_soft_deleted_at
  FROM "FileAsset"
  WHERE "id" = NEW."fileAssetId";

  IF file_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset does not exist';
  END IF;

  IF file_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework attachment file asset is outside this tenant';
  END IF;

  IF file_status <> 'UPLOADED' THEN
    RAISE EXCEPTION 'Homework attachment file asset is not uploaded';
  END IF;

  IF file_soft_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset is deleted';
  END IF;

  SELECT "tenantId"
    INTO submission_tenant_id
  FROM "HomeworkSubmission"
  WHERE "id" = NEW."submissionId";

  IF submission_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homework attachment submission does not exist';
  END IF;

  IF submission_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework attachment submission is outside this tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "homework_attachment_tenant_guard" ON "HomeworkAttachment";

CREATE TRIGGER "homework_attachment_tenant_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "submissionId", "fileAssetId"
ON "HomeworkAttachment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_homework_attachment_tenant_guard"();

CREATE INDEX IF NOT EXISTS "HomeworkAttachment_tenantId_fileAssetId_idx"
ON "HomeworkAttachment" ("tenantId", "fileAssetId");
