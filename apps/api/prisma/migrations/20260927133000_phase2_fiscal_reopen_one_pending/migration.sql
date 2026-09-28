-- A closed fiscal target may have only one unresolved reopen approval at a time.
-- Existing duplicate unresolved requests need an audited decision before migration.
CREATE UNIQUE INDEX "ApprovalRequest_one_pending_fiscal_reopen_target"
ON "ApprovalRequest" ("tenantId", "workflowType", "targetId")
WHERE "workflowType" IN ('FISCAL_PERIOD_REOPEN', 'FISCAL_YEAR_REOPEN')
  AND "status" IN ('PENDING', 'APPROVED');
