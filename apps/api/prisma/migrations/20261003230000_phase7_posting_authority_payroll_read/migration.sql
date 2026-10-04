-- Phase 7.12 security sweep: the Posting Authority system role must not hold
-- the broad legacy `payroll:read`. Through its aliases it implied salary
-- structures (`payroll:salary:read`), statutory deductions and every staff
-- member's payslip, which posting does not need (posting uses
-- `payroll:run:read` and `payroll:run:post`). Tightening only: the grant is
-- removed from SCHOOL-domain system roles named `posting_authority`; custom
-- roles are untouched. Each change is audited.
WITH removed AS (
  DELETE FROM "RolePermission" rp
  USING "Role" r, "Tenant" t, "Permission" p
  WHERE rp."roleId" = r."id"
    AND rp."permissionId" = p."id"
    AND t."id" = r."tenantId"
    AND t."securityDomain" = 'SCHOOL'
    AND r."isSystem" = TRUE
    AND r."name" = 'posting_authority'
    AND p."resource" = 'payroll'
    AND p."action" = 'read'
  RETURNING r."id" AS "roleId", r."tenantId"
)
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "before", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'upgrade_domain_template', 'system_role_template', "roleId",
  jsonb_build_object('role', 'posting_authority', 'removed', 'payroll:read'),
  jsonb_build_object('role', 'posting_authority', 'version', 4, 'migration', 'phase7_posting_authority_payroll_read'),
  gen_random_uuid()::TEXT
FROM removed;
