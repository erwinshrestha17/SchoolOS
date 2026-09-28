-- Reviewed Phase 2 domain templates. Modified/custom roles and Platform tenants are preserved.
BEGIN;
INSERT INTO "Permission" ("id", "resource", "action")
SELECT gen_random_uuid()::TEXT, v.resource, v.action FROM (VALUES
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
('accounting:journals', 'post'),
('accounting:journals', 'read'),
('accounting:journals', 'reject'),
('accounting:journals', 'reverse'),
('accounting:journals', 'review'),
('accounting:journals', 'submit'),
('accounting:payables', 'read'),
('accounting:payables', 'write'),
('accounting:payroll-handoff', 'post'),
('accounting:payroll-handoff', 'read'),
('accounting:posting-batches', 'read'),
('accounting:posting-batches', 'retry'),
('accounting', 'read'),
('accounting:reconciliation', 'finalize'),
('accounting:reconciliation', 'manage'),
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
('accounting', 'reverse'),
('accounting:settings', 'read'),
('accounting:settings', 'update'),
('accounting:vendors', 'read'),
('accounting:vendors', 'write'),
('events', 'read'),
('fees', 'adjust'),
('fees', 'bill'),
('fees', 'discount'),
('fees', 'manage'),
('finance:approvals', 'decide'),
('finance:approvals', 'read'),
('finance:approvals', 'review'),
('hr:attendance', 'correct'),
('hr:attendance', 'read'),
('hr:attendance', 'write'),
('hr:bank', 'read'),
('hr:bank', 'write'),
('hr:disciplinary', 'manage'),
('hr:disciplinary', 'read'),
('hr:documents', 'manage'),
('hr:documents', 'read'),
('hr:identity', 'read'),
('hr:identity', 'write'),
('hr:leave', 'adjust'),
('hr:leave', 'approve'),
('hr:leave', 'read'),
('hr:leave', 'request'),
('hr', 'manage'),
('hr', 'read'),
('hr:staff', 'archive'),
('hr:staff', 'create'),
('hr:staff', 'lifecycle'),
('hr:staff', 'read'),
('hr:staff', 'terminate'),
('hr:staff', 'update'),
('hr:tax', 'read'),
('hr:tax', 'write'),
('ledger', 'read'),
('notices', 'create'),
('notices', 'read'),
('payments', 'close'),
('payments', 'collect'),
('payments', 'refund'),
('payments:refund', 'request'),
('payments', 'reverse'),
('payments:reverse', 'request'),
('payroll:payslip', 'generate'),
('payroll:payslip', 'read'),
('payroll', 'read'),
('payroll:reports', 'read'),
('payroll:run', 'create'),
('payroll:run', 'post'),
('payroll:run', 'read'),
('payroll:run', 'review'),
('payroll:salary', 'read'),
('payroll:salary', 'write'),
('receipts', 'manage'),
('receipts', 'read'),
('reports', 'export'),
('reports', 'read'),
('roles', 'read'),
('service_requests', 'manage'),
('service_requests', 'read'),
('settings:accounting', 'manage'),
('settings:finance', 'manage'),
('settings:hr', 'manage'),
('settings', 'read'),
('settings', 'read_public'),
('staff', 'create'),
('staff', 'read'),
('staff', 'update'),
('students', 'read'),
('users', 'read')
) AS v(resource, action) ON CONFLICT ("resource", "action") DO NOTHING;

CREATE TEMP TABLE phase2_domain_template_upgrade ON COMMIT DROP AS
WITH reviewed(name, baseline, replacement) AS (VALUES
('accountant', ARRAY['accounting:accounts:read', 'accounting:accounts:write', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:budgets:write', 'accounting:close', 'accounting:expenses:read', 'accounting:expenses:write', 'accounting:exports:create', 'accounting:fiscal:manage', 'accounting:fiscal:reopen', 'accounting:journals:approve', 'accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:post', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:journals:reverse', 'accounting:journals:submit', 'accounting:payables:read', 'accounting:payables:write', 'accounting:payroll-handoff:post', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:posting-batches:retry', 'accounting:read', 'accounting:reconciliation:finalize', 'accounting:reconciliation:manage', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:reverse', 'accounting:settings:read', 'accounting:settings:update', 'accounting:vendors:read', 'accounting:vendors:write', 'fees:adjust', 'fees:bill', 'fees:discount', 'fees:manage', 'ledger:read', 'payments:close', 'payments:collect', 'payments:refund', 'receipts:manage', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'service_requests:manage', 'service_requests:read', 'settings:accounting:manage', 'settings:finance:manage', 'settings:read', 'settings:read_public', 'staff:read', 'students:read', 'users:read']::TEXT[], ARRAY['accounting:accounts:read', 'accounting:accounts:write', 'accounting:audit:read', 'accounting:budgets:read', 'accounting:budgets:write', 'accounting:close', 'accounting:expenses:read', 'accounting:expenses:write', 'accounting:exports:create', 'accounting:fiscal:manage', 'accounting:fiscal:reopen', 'accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:journals:reverse', 'accounting:journals:review', 'accounting:journals:submit', 'accounting:payables:read', 'accounting:payables:write', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:posting-batches:retry', 'accounting:read', 'accounting:reconciliation:finalize', 'accounting:reconciliation:manage', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:budget-vs-actual', 'accounting:reports:cash-book', 'accounting:reports:cash-flow-statement', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:reverse', 'accounting:settings:read', 'accounting:settings:update', 'accounting:vendors:read', 'accounting:vendors:write', 'fees:adjust', 'fees:bill', 'fees:discount', 'fees:manage', 'finance:approvals:read', 'finance:approvals:review', 'ledger:read', 'payments:close', 'payments:collect', 'receipts:manage', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'service_requests:manage', 'service_requests:read', 'settings:accounting:manage', 'settings:finance:manage', 'settings:read', 'settings:read_public', 'staff:read', 'students:read', 'users:read']::TEXT[]),
('cashier', ARRAY['payments:collect', 'receipts:read', 'settings:read_public']::TEXT[], ARRAY['payments:collect', 'payments:refund:request', 'payments:reverse:request', 'receipts:read', 'settings:read_public']::TEXT[]),
('finance_approver', ARRAY['finance:approvals:decide', 'finance:approvals:read', 'settings:read_public']::TEXT[], ARRAY['accounting:journals:approve', 'accounting:journals:read', 'accounting:journals:reject', 'accounting:read', 'finance:approvals:decide', 'finance:approvals:read', 'settings:read_public']::TEXT[]),
('posting_authority', ARRAY['accounting:journals:post', 'accounting:journals:read', 'accounting:payroll-handoff:post', 'accounting:payroll-handoff:read', 'accounting:read', 'payroll:read', 'payroll:run:post', 'payroll:run:read', 'settings:read_public']::TEXT[], ARRAY['accounting:journals:post', 'accounting:journals:read', 'accounting:payroll-handoff:post', 'accounting:payroll-handoff:read', 'accounting:read', 'finance:approvals:read', 'payments:refund', 'payments:reverse', 'payroll:read', 'payroll:run:post', 'payroll:run:read', 'settings:read_public']::TEXT[]),
('financial_auditor', ARRAY['accounting:accounts:read', 'accounting:audit:read', 'accounting:expenses:read', 'accounting:exports:create', 'accounting:journals:read', 'accounting:payables:read', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:read', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:cash-book', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:settings:read', 'accounting:vendors:read', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'settings:read', 'settings:read_public']::TEXT[], ARRAY['accounting:accounts:read', 'accounting:audit:read', 'accounting:expenses:read', 'accounting:exports:create', 'accounting:journals:read', 'accounting:payables:read', 'accounting:payroll-handoff:read', 'accounting:posting-batches:read', 'accounting:read', 'accounting:reconciliation:read', 'accounting:reports:balance-sheet', 'accounting:reports:cash-book', 'accounting:reports:general-ledger', 'accounting:reports:income-statement', 'accounting:reports:read', 'accounting:reports:tax-summary', 'accounting:reports:trial-balance', 'accounting:settings:read', 'accounting:vendors:read', 'finance:approvals:read', 'receipts:read', 'reports:export', 'reports:read', 'roles:read', 'settings:read', 'settings:read_public']::TEXT[]),
('hr_manager', ARRAY['events:read', 'hr:attendance:correct', 'hr:attendance:read', 'hr:attendance:write', 'hr:leave:adjust', 'hr:leave:approve', 'hr:leave:read', 'hr:leave:request', 'hr:manage', 'hr:read', 'hr:staff:archive', 'hr:staff:create', 'hr:staff:lifecycle', 'hr:staff:read', 'hr:staff:terminate', 'hr:staff:update', 'notices:create', 'notices:read', 'payroll:payslip:generate', 'payroll:payslip:read', 'payroll:read', 'payroll:reports:read', 'payroll:run:create', 'payroll:run:read', 'payroll:run:review', 'payroll:salary:read', 'payroll:salary:write', 'reports:read', 'roles:read', 'settings:hr:manage', 'settings:read', 'settings:read_public', 'staff:create', 'staff:read', 'staff:update', 'users:read']::TEXT[], ARRAY['events:read', 'hr:attendance:correct', 'hr:attendance:read', 'hr:attendance:write', 'hr:bank:read', 'hr:bank:write', 'hr:disciplinary:manage', 'hr:disciplinary:read', 'hr:documents:manage', 'hr:documents:read', 'hr:identity:read', 'hr:identity:write', 'hr:leave:adjust', 'hr:leave:approve', 'hr:leave:read', 'hr:leave:request', 'hr:manage', 'hr:read', 'hr:staff:archive', 'hr:staff:create', 'hr:staff:lifecycle', 'hr:staff:read', 'hr:staff:terminate', 'hr:staff:update', 'hr:tax:read', 'hr:tax:write', 'notices:create', 'notices:read', 'payroll:payslip:generate', 'payroll:payslip:read', 'payroll:read', 'payroll:reports:read', 'payroll:run:create', 'payroll:run:read', 'payroll:run:review', 'payroll:salary:read', 'payroll:salary:write', 'reports:read', 'roles:read', 'settings:hr:manage', 'settings:read', 'settings:read_public', 'staff:create', 'staff:read', 'staff:update', 'users:read']::TEXT[])
)
SELECT r."id", r."tenantId", r."name", reviewed.baseline, reviewed.replacement
FROM "Role" r JOIN "Tenant" t ON t."id" = r."tenantId" JOIN reviewed ON reviewed.name = r."name"
WHERE r."isSystem" = TRUE AND t."securityDomain" = 'SCHOOL'
 AND (SELECT array_agg(p."resource" || ':' || p."action" ORDER BY p."resource" || ':' || p."action") FROM "RolePermission" rp JOIN "Permission" p ON p."id" = rp."permissionId" WHERE rp."roleId" = r."id") = reviewed.baseline;

DELETE FROM "RolePermission" rp USING phase2_domain_template_upgrade u, "Permission" p
WHERE rp."roleId" = u."id" AND rp."permissionId" = p."id" AND NOT (p."resource" || ':' || p."action" = ANY(u.replacement));
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT u."id", p."id" FROM phase2_domain_template_upgrade u JOIN "Permission" p ON p."resource" || ':' || p."action" = ANY(u.replacement) ON CONFLICT DO NOTHING;
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "before", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'upgrade_domain_template', 'system_role_template', "id",
 jsonb_build_object('role', "name", 'version', 1, 'permissions', baseline),
 jsonb_build_object('role', "name", 'version', 2, 'permissions', replacement, 'migration', 'phase2_domain_templates'), gen_random_uuid()::TEXT
FROM phase2_domain_template_upgrade;

CREATE TEMP TABLE phase2_new_finance_clerks ON COMMIT DROP AS
WITH inserted AS (
 INSERT INTO "Role" ("id", "tenantId", "name", "description", "isSystem")
 SELECT gen_random_uuid()::TEXT, t."id", 'finance_clerk', 'Prepare financial corrections and manual journals without review, approval or posting authority', TRUE
 FROM "Tenant" t WHERE t."securityDomain" = 'SCHOOL'
 ON CONFLICT ("tenantId", "name") DO NOTHING RETURNING "id", "tenantId"
) SELECT * FROM inserted;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM phase2_new_finance_clerks r CROSS JOIN "Permission" p WHERE p."resource" || ':' || p."action" = ANY(ARRAY['accounting:journals:cancel', 'accounting:journals:create', 'accounting:journals:read', 'accounting:journals:submit', 'accounting:read', 'payments:refund:request', 'payments:reverse:request', 'receipts:read', 'settings:read_public']::TEXT[]) ON CONFLICT DO NOTHING;
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "after", "requestId")
SELECT gen_random_uuid()::TEXT, "tenantId", 'create_finance_clerk_template', 'system_role_template', "id", jsonb_build_object('role', 'finance_clerk', 'version', 1, 'assignedUsers', 0), gen_random_uuid()::TEXT FROM phase2_new_finance_clerks;
COMMIT;
