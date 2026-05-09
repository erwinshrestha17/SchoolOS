-- Guardrail for private student photos.
-- Student.photoFileId must reference a tenant-owned, uploaded, non-deleted FileAsset
-- that is linked to the same student through the students File Registry boundary.

CREATE OR REPLACE FUNCTION "enforce_student_photo_file_guard"()
RETURNS trigger AS $$
DECLARE
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  file_module text;
  file_entity_id text;
  file_mime_type text;
BEGIN
  IF NEW."photoFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "tenantId", "status"::text, "softDeletedAt", "module", "entityId", "mimeType"
    INTO file_tenant_id, file_status, file_soft_deleted_at, file_module, file_entity_id, file_mime_type
  FROM "FileAsset"
  WHERE "id" = NEW."photoFileId";

  IF file_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Student photo file asset does not exist';
  END IF;

  IF file_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Student photo file asset is outside this tenant';
  END IF;

  IF file_status <> 'UPLOADED' THEN
    RAISE EXCEPTION 'Student photo file asset is not uploaded';
  END IF;

  IF file_soft_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Student photo file asset is deleted';
  END IF;

  IF file_module <> 'students' OR file_entity_id <> NEW."id" THEN
    RAISE EXCEPTION 'Student photo file asset is not linked to this student';
  END IF;

  IF file_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'Student photo file asset MIME type is invalid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "student_photo_file_guard" ON "Student";

CREATE TRIGGER "student_photo_file_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "photoFileId"
ON "Student"
FOR EACH ROW
EXECUTE FUNCTION "enforce_student_photo_file_guard"();

CREATE INDEX IF NOT EXISTS "Student_tenant_photo_file_idx"
ON "Student" ("tenantId", "photoFileId");
