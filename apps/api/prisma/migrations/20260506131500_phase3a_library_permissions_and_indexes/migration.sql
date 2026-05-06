-- Phase 3A Library foundation hardening
-- Adds granular RBAC permission records and missing tenant-scoped indexes for library workflows.

-- Granular Library RBAC permissions
INSERT INTO "Permission" ("id", "resource", "action", "description")
VALUES
  (gen_random_uuid()::text, 'library:books', 'create', 'Create library book catalog records'),
  (gen_random_uuid()::text, 'library:books', 'read', 'Read library book catalog records'),
  (gen_random_uuid()::text, 'library:books', 'update', 'Update library book catalog records'),
  (gen_random_uuid()::text, 'library:copies', 'create', 'Create library book copy records'),
  (gen_random_uuid()::text, 'library:copies', 'read', 'Read library book copy records'),
  (gen_random_uuid()::text, 'library:copies', 'update', 'Update library book copy records and status'),
  (gen_random_uuid()::text, 'library:issues', 'create', 'Issue library book copies'),
  (gen_random_uuid()::text, 'library:issues', 'read', 'Read library circulation records'),
  (gen_random_uuid()::text, 'library:issues', 'return', 'Return issued library book copies'),
  (gen_random_uuid()::text, 'library:reports', 'read', 'Read library overdue and circulation reports')
ON CONFLICT ("resource", "action") DO UPDATE
SET "description" = EXCLUDED."description";

-- Keep existing librarian/admin-style roles functional after the permission split.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON (
  p."resource" IN (
    'library:books',
    'library:copies',
    'library:issues',
    'library:reports'
  )
)
WHERE r."name" IN ('super_admin', 'admin', 'principal', 'librarian', 'platform_super_admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Read-only library reporting is useful for school leadership.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON (
  (p."resource" = 'library:books' AND p."action" = 'read') OR
  (p."resource" = 'library:copies' AND p."action" = 'read') OR
  (p."resource" = 'library:issues' AND p."action" = 'read') OR
  (p."resource" = 'library:reports' AND p."action" = 'read')
)
WHERE r."name" IN ('teacher')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Additional query indexes requested for Phase 3A Library.
CREATE INDEX IF NOT EXISTS "LibraryBook_tenantId_author_idx" ON "LibraryBook"("tenantId", "author");
CREATE INDEX IF NOT EXISTS "LibraryBook_tenantId_subjectCategory_idx" ON "LibraryBook"("tenantId", "subjectCategory");
CREATE INDEX IF NOT EXISTS "LibraryCopy_tenantId_barcode_idx" ON "LibraryCopy"("tenantId", "barcode");
CREATE INDEX IF NOT EXISTS "LibraryCopy_tenantId_status_idx" ON "LibraryCopy"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "LibraryIssue_tenantId_dueAt_idx" ON "LibraryIssue"("tenantId", "dueAt");
CREATE INDEX IF NOT EXISTS "LibraryIssue_tenantId_copyId_status_idx" ON "LibraryIssue"("tenantId", "copyId", "status");
