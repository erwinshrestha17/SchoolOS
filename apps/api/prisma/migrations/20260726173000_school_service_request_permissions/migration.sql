INSERT INTO "Permission" ("id", "resource", "action", "description")
VALUES
  (
    '019f9d01-0000-7000-8000-000000000001',
    'service_requests',
    'create',
    'Create own scoped school service requests'
  ),
  (
    '019f9d01-0000-7000-8000-000000000002',
    'service_requests',
    'read',
    'Read permitted school service requests'
  ),
  (
    '019f9d01-0000-7000-8000-000000000003',
    'service_requests',
    'manage',
    'Assign, respond to, resolve, and reopen service requests'
  )
ON CONFLICT ("resource", "action")
DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission
  ON permission."resource" = 'service_requests'
WHERE role."isSystem" = true
  AND (
    role."name" IN ('admin', 'principal')
    OR (
      role."name" = 'parent'
      AND permission."action" IN ('create', 'read')
    )
    OR (
      role."name" = 'accountant'
      AND permission."action" IN ('read', 'manage')
    )
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
