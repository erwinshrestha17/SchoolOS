-- Guardrail for legacy StudentDocument file linkage.
-- Uses jsonb/dynamic record access so it remains safe across existing column names
-- such as fileAssetId/documentFileId while still enforcing tenant and storage boundaries.

CREATE OR REPLACE FUNCTION "enforce_student_document_file_guard"()
RETURNS trigger AS $$
DECLARE
  row_data jsonb;
  document_file_id text;
  document_tenant_id text;
  document_student_id text;
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  file_module text;
  file_entity_id text;
BEGIN
  row_data := to_jsonb(NEW);
  document_file_id := COALESCE(row_data ->> 'fileId', row_data ->> 'fileAssetId', row_data ->> 'documentFileId');
  document_tenant_id := row_data ->> 'tenantId';
  document_student_id := row_data ->> 'studentId';

  IF document_file_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "tenantId", "status"::text, "softDeletedAt", "module", "entityId"
    INTO file_tenant_id, file_status, file_soft_deleted_at, file_module, file_entity_id
  FROM "FileAsset"
  WHERE "id" = document_file_id;

  IF file_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Student document file asset does not exist';
  END IF;

  IF file_tenant_id <> document_tenant_id THEN
    RAISE EXCEPTION 'Student document file asset is outside this tenant';
  END IF;

  IF file_status <> 'UPLOADED' THEN
    RAISE EXCEPTION 'Student document file asset is not uploaded';
  END IF;

  IF file_soft_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Student document file asset is deleted';
  END IF;

  IF file_module IS NOT NULL AND file_module NOT IN ('students', 'student-documents') THEN
    RAISE EXCEPTION 'Student document file asset module is invalid';
  END IF;

  IF file_entity_id IS NOT NULL AND document_student_id IS NOT NULL AND file_entity_id <> document_student_id THEN
    RAISE EXCEPTION 'Student document file asset is not linked to this student';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "student_document_file_guard" ON "StudentDocument";

CREATE TRIGGER "student_document_file_guard"
BEFORE INSERT OR UPDATE
ON "StudentDocument"
FOR EACH ROW
EXECUTE FUNCTION "enforce_student_document_file_guard"();

CREATE INDEX IF NOT EXISTS "StudentDocument_tenant_student_status_idx"
ON "StudentDocument" ("tenantId", "studentId", "status");
