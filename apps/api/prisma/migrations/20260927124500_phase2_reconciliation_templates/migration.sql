-- Only exact School system baselines are upgraded; owner modifications and Platform roles are preserved.
BEGIN;
INSERT INTO "Permission" ("id", "resource", "action") SELECT gen_random_uuid()::TEXT, v.resource, v.action FROM (VALUES
('accounting:accounts', 'read'),
('accounting:accounts', 'write'),
('accounting:audit', 'read'),
('accounting:budgets', 'read'),
('accounting:budgets', 'write'),
('accounting', 'close'),
('accounting:expenses', 'read'),
('accounting:expenses', 'write'),
('accounting:exports', 'create'),
('accounting:fiscal', 'manage'),
('accounting:fiscal', 'reopen'),
('accounting:journals', 'approve'),
('accounting:journals', 'cancel'),
('accounting:journals', 'create'),
('accounting:journals', 'read'),
('accounting:journals', 'reject'),
('accounting:journals', 'reverse'),
('accounting:journals', 'review'),
('accounting:journals', 'submit'),
('accounting:payables', 'read'),
('accounting:payables', 'write'),
('accounting:payroll-handoff', 'read'),
('accounting:posting-batches', 'read'),
('accounting:posting-batches', 'retry'),
('accounting', 'read'),
('accounting:reconciliation', 'finalize'),
('accounting:reconciliation', 'manage'),
('accounting:reconciliation', 'read'),
('accounting:reconciliation', 'review'),
('accounting:reports', 'balance-sheet'),
('accounting:reports', 'budget-vs-actual'),
('accounting:reports', 'cash-book'),
('accounting:reports', 'cash-flow-statement'),
('accounting:reports', 'general-ledger'),
('accounting:reports', 'income-statement'),
('accounting:reports', 'read'),
('accounting:reports', 'tax-summary'),
('accounting:reports', 'trial-balance'),
('accounting', 'reverse'),
('accounting:settings', 'read'),
('accounting:settings', 'update'),
('accounting:vendors', 'read'),
('accounting:vendors', 'write'),
('fees', 'adjust'),
('fees', 'bill'),
('fees', 'discount'),
('fees', 'manage'),
('finance:approvals', 'decide'),
('finance:approvals', 'read'),
('finance:approvals', 'review'),
('ledger', 'read'),
('payments', 'close'),
('payments', 'collect'),
('payments:refund', 'request'),
('payments:reverse', 'request'),
('receipts', 'manage'),
('receipts', 'read'),
('reports', 'export'),
('reports', 'read'),
('roles', 'read'),
('service_requests', 'manage'),
('service_requests', 'read'),
('settings:accounting', 'manage'),
('settings:finance', 'manage'),
('settings', 'read'),
('settings', 'read_public'),
('staff', 'read'),
('students', 'read'),
('users', 'read')
) v(resource, action) ON CONFLICT ("resource", "action") DO NOTHING;
CREATE TEMP TABLE phase2_reconciliation_templates ON COMMIT DROP AS
WITH reviewed(name, baseline, replacement, old_version, new_version) AS (VALUES
('accountant', ARRAY['accounting:accounts:read', 'accounting:accounts:write', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:budgets:write', 'accounting:close', 'accounting:expenses:read', 'accounting:expenses:write', 'accounting:exports:create', 'accounting:fiscal:manage', 'accounting:fiscal:reopen', 'accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:journals:reverse', 'accounting:journals:review', 'accounting:journals:submit', 'accounting:payables:read', 'accounting:payables:write', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:posting-batches:retry', 'accounting:read', 'accounting:reconciliation:finalize', 'accounting:reconciliation:manage', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:reverse', 'accounting:settings:read', 'accounting:settings:update', 'accounting:vendors:read', 'accounting:vendors:write', 'fees:adjust', 'fees:bill', 'fees:discount', 'fees:manage', 'finance:approvals:read', 'finance:approvals:review', 'ledger:read', 'payments:close', 'payments:collect', 'receipts:manage', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'service_requests:manage', 'service_requests:read', 'settings:accounting:manage', 'settings:finance:manage', 'settings:read', 'settings:read_public', 'staff:read', 'students:read', 'users:read']::TEXT[], ARRAY['accounting:accounts:read', 'accounting:accounts:write', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:budgets:write', 'accounting:close', 'accounting:expenses:read', 'accounting:expenses:write', 'accounting:exports:create', 'accounting:fiscal:manage', 'accounting:fiscal:reopen', 'accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:journals:reverse', 'accounting:journals:review', 'accounting:journals:submit', 'accounting:payables:read', 'accounting:payables:write', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:posting-batches:retry', 'accounting:read', 'accounting:reconciliation:read', 'accounting:reconciliation:review', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:reverse', 'accounting:settings:read', 'accounting:settings:update', 'accounting:vendors:read', 'accounting:vendors:write', 'fees:adjust', 'fees:bill', 'fees:discount', 'fees:manage', 'finance:approvals:read', 'finance:approvals:review', 'ledger:read', 'payments:close', 'payments:collect', 'receipts:manage', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'service_requests:manage', 'service_requests:read', 'settings:accounting:manage', 'settings:finance:manage', 'settings:read', 'settings:read_public', 'staff:read', 'students:read', 'users:read']::TEXT[], 2, 3),
('finance_clerk', ARRAY['accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:submit', 'accounting:read', 'payments:refund:request', 'payments:reverse:request', 'receipts:read', 'settings:read_public']::TEXT[], ARRAY['accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:submit', 'accounting:read', 'accounting:reconciliation:manage', 'accounting:reconciliation:read', 'payments:refund:request', 'payments:reverse:request', 'receipts:read', 'settings:read_public']::TEXT[], 1, 2),
('finance_approver', ARRAY['accounting:journals:approve', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:read', 'finance:approvals:decide', 'finance:approvals:read', 'settings:read_public']::TEXT[], ARRAY['accounting:journals:approve', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:read', 'accounting:reconciliation:finalize', 'accounting:reconciliation:read', 'finance:approvals:decide', 'finance:approvals:read', 'settings:read_public']::TEXT[], 2, 3)
)
SELECT r."id", r."tenantId", r."name", reviewed.baseline, reviewed.replacement, reviewed.old_version, reviewed.new_version
FROM "Role" r JOIN "Tenant" t ON t."id" = r."tenantId" JOIN reviewed ON reviewed.name = r."name"
WHERE r."isSystem" = TRUE AND t."securityDomain" = 'SCHOOL'
AND (SELECT array_agg(p."resource" || ':' || p."action" ORDER BY p."resource" || ':' || p."action") FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE rp."roleId" = r."id") = reviewed.baseline;
DELETE FROM "RolePermission" rp USING phase2_reconciliation_templates u, "Permission" p WHERE rp."roleId" = u."id" AND rp."permissionId" = p."id" AND NOT (p."resource" || ':' || p."action" = ANY(u.replacement));
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT u."id", p."id" FROM phase2_reconciliation_templates u JOIN "Permission" p ON p."resource" || ':' || p."action" = ANY(u.replacement) ON CONFLICT DO NOTHING;
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "before", "after", "requestId") SELECT gen_random_uuid()::TEXT, "tenantId", 'upgrade_reconciliation_template', 'system_role_template', "id", jsonb_build_object('role', "name", 'version', old_version, 'permissions', baseline), jsonb_build_object('role', "name", 'version', new_version, 'permissions', replacement, 'migration', 'phase2_reconciliation_templates'), gen_random_uuid()::TEXT FROM phase2_reconciliation_templates;
COMMIT;
