-- Phase 5F: Principal template v1 -> v2 adds homework:read (Student 360
-- homework oversight). Only School system Principal roles whose grants are
-- exactly the v1 baseline are upgraded; owner-modified roles are preserved.
-- Grants are compared as sets so the result does not depend on collation.
BEGIN;
INSERT INTO "Permission" ("id", "resource", "action")
VALUES (gen_random_uuid()::TEXT, 'homework', 'read')
ON CONFLICT ("resource", "action") DO NOTHING;

CREATE TEMP TABLE phase5_principal_template ON COMMIT DROP AS
WITH reviewed(baseline, replacement) AS (VALUES (
ARRAY['academic_years:read', 'academics:read', 'academics:report_cards:review', 'accounting:accounts:read', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:expenses:read', 'accounting:journals:read', 'accounting:payables:read', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:read', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:settings:read', 'accounting:vendors:read', 'activity_feed:read', 'admission_policy:read', 'advanced:approvals:decide', 'advanced:approvals:read', 'assessment-components:read', 'attendance:override_lock', 'attendance:read', 'attendance:review_conflicts', 'cas-records:read', 'classes:read', 'communications:read_deliveries', 'enrollments:read', 'events:read', 'exam-terms:read', 'exam-terms:unlock', 'finance:principal:read', 'guardians:read', 'hr:attendance:read', 'hr:leave:approve', 'hr:leave:read', 'hr:read', 'hr:staff:read', 'marks:read', 'marks:review_lock', 'notices:approve', 'notices:read', 'notices:read_reports', 'notifications:view_own', 'reports:read', 'results:publish', 'results:read', 'results:unpublish', 'roles:read', 'sections:read', 'service_requests:read', 'settings:audit:read', 'settings:read', 'settings:read_public', 'staff:read', 'streams:read', 'students:read']::TEXT[],
ARRAY['academic_years:read', 'academics:read', 'academics:report_cards:review', 'accounting:accounts:read', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:expenses:read', 'accounting:journals:read', 'accounting:payables:read', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:read', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:settings:read', 'accounting:vendors:read', 'activity_feed:read', 'admission_policy:read', 'advanced:approvals:decide', 'advanced:approvals:read', 'assessment-components:read', 'attendance:override_lock', 'attendance:read', 'attendance:review_conflicts', 'cas-records:read', 'classes:read', 'communications:read_deliveries', 'enrollments:read', 'events:read', 'exam-terms:read', 'exam-terms:unlock', 'finance:principal:read', 'guardians:read', 'homework:read', 'hr:attendance:read', 'hr:leave:approve', 'hr:leave:read', 'hr:read', 'hr:staff:read', 'marks:read', 'marks:review_lock', 'notices:approve', 'notices:read', 'notices:read_reports', 'notifications:view_own', 'reports:read', 'results:publish', 'results:read', 'results:unpublish', 'roles:read', 'sections:read', 'service_requests:read', 'settings:audit:read', 'settings:read', 'settings:read_public', 'staff:read', 'streams:read', 'students:read']::TEXT[]
)),
current_grants AS (
  SELECT r."id", r."tenantId",
    COALESCE(array_agg(p."resource" || ':' || p."action") FILTER (WHERE p."id" IS NOT NULL), ARRAY[]::TEXT[]) AS grants
  FROM "Role" r
  JOIN "Tenant" t ON t."id" = r."tenantId"
  LEFT JOIN "RolePermission" rp ON rp."roleId" = r."id"
  LEFT JOIN "Permission" p ON p."id" = rp."permissionId"
  WHERE r."isSystem" = TRUE AND r."name" = 'principal' AND t."securityDomain" = 'SCHOOL'
  GROUP BY r."id", r."tenantId"
)
SELECT g."id", g."tenantId", reviewed.baseline, reviewed.replacement
FROM current_grants g, reviewed
WHERE g.grants @> reviewed.baseline AND reviewed.baseline @> g.grants;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT u."id", p."id"
FROM phase5_principal_template u
JOIN "Permission" p ON p."resource" = 'homework' AND p."action" = 'read'
ON CONFLICT DO NOTHING;

INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "before", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'upgrade_principal_template', 'system_role_template', "id",
  jsonb_build_object('role', 'principal', 'version', 1, 'permissions', baseline),
  jsonb_build_object('role', 'principal', 'version', 2, 'permissions', replacement, 'migration', 'phase5_principal_homework_oversight'),
  gen_random_uuid()::TEXT
FROM phase5_principal_template;
COMMIT;
