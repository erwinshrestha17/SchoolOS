-- Explicit Phase 2 payroll template upgrade. No custom/modified roles are widened.
BEGIN;
INSERT INTO "Permission" ("id", "resource", "action")
SELECT gen_random_uuid()::TEXT, v.resource, v.action FROM (VALUES
('accounting:journals', 'post'),
('accounting:journals', 'read'),
('accounting:payroll-handoff', 'post'),
('accounting:payroll-handoff', 'read'),
('accounting', 'read'),
('payroll', 'read'),
('payroll:run', 'finalize'),
('payroll:run', 'post'),
('payroll:run', 'read'),
('payroll:run', 'validate'),
('settings', 'read_public')
) AS v(resource, action) ON CONFLICT ("resource", "action") DO NOTHING;

CREATE TEMP TABLE phase2_payroll_template_upgrade ON COMMIT DROP AS
WITH reviewed(name, baseline, added) AS (VALUES
('payroll_preparer', ARRAY['hr:attendance:read', 'hr:leave:read', 'hr:staff:read', 'payroll:run:create', 'payroll:run:read', 'payroll:salary:read', 'settings:read_public']::TEXT[], 'payroll:run:validate'),
('payroll_approver', ARRAY['payroll:run:approve', 'payroll:run:read', 'payroll:salary:read', 'settings:read_public']::TEXT[], 'payroll:run:finalize')
)
SELECT r."id", r."tenantId", r."name", reviewed.baseline, reviewed.added
FROM "Role" r JOIN "Tenant" t ON t."id" = r."tenantId"
JOIN reviewed ON reviewed.name = r."name"
WHERE r."isSystem" = TRUE AND t."securityDomain" = 'SCHOOL'
  AND (SELECT array_agg(p."resource" || ':' || p."action" ORDER BY p."resource" || ':' || p."action")
       FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId"
       WHERE rp."roleId" = r."id") = reviewed.baseline;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT upgrade."id", p."id" FROM phase2_payroll_template_upgrade upgrade
JOIN "Permission" p ON p."resource" || ':' || p."action" = upgrade.added
ON CONFLICT DO NOTHING;

INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "before", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'upgrade_payroll_template', 'system_role_template', "id",
 jsonb_build_object('role', "name", 'version', 1, 'permissions', baseline),
 jsonb_build_object('role', "name", 'version', 2, 'addedPermission', added, 'migration', 'phase2_payroll_templates'),
 gen_random_uuid()::TEXT FROM phase2_payroll_template_upgrade;

-- Posting Authority starts unassigned. Existing name collisions are left untouched.
CREATE TEMP TABLE phase2_new_posting_roles ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO "Role" ("id", "tenantId", "name", "description", "isSystem")
  SELECT gen_random_uuid()::TEXT, t."id", 'posting_authority', 'Post independently approved obligations', TRUE
  FROM "Tenant" t WHERE t."securityDomain" = 'SCHOOL'
  ON CONFLICT ("tenantId", "name") DO NOTHING RETURNING "id", "tenantId"
) SELECT * FROM inserted;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM phase2_new_posting_roles r CROSS JOIN "Permission" p
WHERE (p."resource", p."action") IN (VALUES
('accounting:journals', 'post'),
('accounting:journals', 'read'),
('accounting:payroll-handoff', 'post'),
('accounting:payroll-handoff', 'read'),
('accounting', 'read'),
('payroll', 'read'),
('payroll:run', 'post'),
('payroll:run', 'read'),
('settings', 'read_public')
);
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'create_posting_template', 'system_role_template', "id",
 jsonb_build_object('role', 'posting_authority', 'version', 1, 'assignedUsers', 0), gen_random_uuid()::TEXT
FROM phase2_new_posting_roles;
COMMIT;
