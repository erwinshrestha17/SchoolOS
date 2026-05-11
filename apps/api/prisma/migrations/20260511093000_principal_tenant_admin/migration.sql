-- Replace the legacy tenant-scoped super_admin with principal-as-school-owner.
-- Platform-wide administration remains under platform_* roles only.

-- Give every principal full tenant/school permissions except platform-control and tenant-suspension powers.
DELETE FROM "RolePermission" rp
USING "Role" r
WHERE rp."roleId" = r.id
  AND r.name = 'principal';

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'principal'
  AND p.resource <> 'platform'
  AND NOT (p.resource = 'tenants' AND p.action = 'manage')
ON CONFLICT DO NOTHING;

-- Remove legacy seeded superadmin account and role from tenant databases.
DELETE FROM "RefreshToken" rt
USING "User" u
WHERE rt."userId" = u.id
  AND u.email = 'superadmin@schoolos.com';

DELETE FROM "OtpCode" oc
USING "User" u
WHERE oc."userId" = u.id
  AND u.email = 'superadmin@schoolos.com';

DELETE FROM "UserRole" ur
USING "User" u
WHERE ur."userId" = u.id
  AND u.email = 'superadmin@schoolos.com';

DELETE FROM "User"
WHERE email = 'superadmin@schoolos.com';

DELETE FROM "RolePermission" rp
USING "Role" r
WHERE rp."roleId" = r.id
  AND r.name = 'super_admin';

DELETE FROM "UserRole" ur
USING "Role" r
WHERE ur."roleId" = r.id
  AND r.name = 'super_admin';

DELETE FROM "Role"
WHERE name = 'super_admin';
