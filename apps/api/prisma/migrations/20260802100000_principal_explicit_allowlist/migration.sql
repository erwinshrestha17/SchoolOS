-- PPR-P0-01: narrow academic approval permissions and Principal explicit allowlist.

INSERT INTO "Permission" ("id", "resource", "action", "description")
VALUES
  (
    '019f9e01-0000-7000-8000-000000000001',
    'marks',
    'review_lock',
    'Review and decide mark lock and unlock requests'
  ),
  (
    '019f9e01-0000-7000-8000-000000000002',
    'exam-terms',
    'unlock',
    'Unlock exam terms for controlled correction after leadership review'
  ),
  (
    '019f9e01-0000-7000-8000-000000000003',
    'results',
    'publish',
    'Publish approved exam results to students and guardians'
  ),
  (
    '019f9e01-0000-7000-8000-000000000004',
    'results',
    'unpublish',
    'Withdraw published exam results with audit reason'
  ),
  (
    '019f9e01-0000-7000-8000-000000000005',
    'academics:report_cards',
    'review',
    'Review and decide report card correction requests'
  )
ON CONFLICT ("resource", "action")
DO UPDATE SET "description" = EXCLUDED."description";

DELETE FROM "RolePermission"
WHERE "roleId" IN (
  SELECT "id"
  FROM "Role"
  WHERE "isSystem" = true
    AND "name" = 'principal'
);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission
  ON (permission."resource", permission."action") IN (
    ('academic_years', 'read'),
    ('academics', 'read'),
    ('academics:report_cards', 'review'),
    ('accounting:accounts', 'read'),
    ('accounting:audit', 'read'),
    ('accounting:budgets', 'read'),
    ('accounting:expenses', 'read'),
    ('accounting:journals', 'read'),
    ('accounting:payables', 'read'),
    ('accounting:payroll-handoff', 'read'),
    ('accounting:posting-batches', 'read'),
    ('accounting', 'read'),
    ('accounting:reconciliation', 'read'),
    ('accounting:reports', 'balance-sheet'),
    ('accounting:reports', 'budget-vs-actual'),
    ('accounting:reports', 'cash-book'),
    ('accounting:reports', 'cash-flow-statement'),
    ('accounting:reports', 'general-ledger'),
    ('accounting:reports', 'income-statement'),
    ('accounting:reports', 'read'),
    ('accounting:reports', 'tax-summary'),
    ('accounting:reports', 'trial-balance'),
    ('accounting:settings', 'read'),
    ('accounting:vendors', 'read'),
    ('activity_feed', 'read'),
    ('admission_policy', 'read'),
    ('advanced:approvals', 'decide'),
    ('advanced:approvals', 'read'),
    ('assessment-components', 'read'),
    ('attendance', 'override_lock'),
    ('attendance', 'read'),
    ('attendance', 'review_conflicts'),
    ('cas-records', 'read'),
    ('classes', 'read'),
    ('communications', 'read_deliveries'),
    ('enrollments', 'read'),
    ('events', 'read'),
    ('exam-terms', 'read'),
    ('exam-terms', 'unlock'),
    ('finance:principal', 'read'),
    ('guardians', 'read'),
    ('hr:attendance', 'read'),
    ('hr:leave', 'approve'),
    ('hr:leave', 'read'),
    ('hr', 'read'),
    ('hr:staff', 'read'),
    ('marks', 'read'),
    ('marks', 'review_lock'),
    ('notices', 'approve'),
    ('notices', 'read'),
    ('notices', 'read_reports'),
    ('notifications', 'view_own'),
    ('reports', 'read'),
    ('results', 'publish'),
    ('results', 'read'),
    ('results', 'unpublish'),
    ('roles', 'read'),
    ('sections', 'read'),
    ('service_requests', 'read'),
    ('settings:audit', 'read'),
    ('settings', 'read'),
    ('settings', 'read_public'),
    ('staff', 'read'),
    ('streams', 'read'),
    ('students', 'read')
  )
WHERE role."isSystem" = true
  AND role."name" = 'principal'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Admin and other roles that should gain the new narrow academic approval keys.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission
  ON (permission."resource", permission."action") IN (
    ('marks', 'review_lock'),
    ('exam-terms', 'unlock'),
    ('results', 'publish'),
    ('results', 'unpublish'),
    ('academics:report_cards', 'review')
  )
WHERE role."isSystem" = true
  AND role."name" = 'admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
